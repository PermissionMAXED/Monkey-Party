package de.aetherklang.sturmfront;

import de.aetherklang.Aetherklang;
import de.aetherklang.client.GlassHud;
import de.aetherklang.client.fx.FxBudget;
import de.aetherklang.client.fx.FxPalette;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModPayloads;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.text.Text;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.Vec3d;
import net.minecraft.util.math.random.Random;

/**
 * Renders the synced Sturmfront bearing and local dissonance weather.
 */
public final class SturmfrontClient {
    private static final double MARCH_SPEED = 0.22D;

    private static boolean active;
    private static double centerX;
    private static double centerZ;
    private static float radius;
    private static float directionX;
    private static float directionZ;
    private static float intensity;
    private static long revision;
    private static long receivedAtWorldTime;
    private static int clientTicks;
    private static float responsePulse;
    private static boolean registered;

    private SturmfrontClient() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        ClientPlayNetworking.registerGlobalReceiver(
                ModPayloads.SturmfrontSyncPayload.ID,
                (payload, context) -> context.client().execute(() -> accept(context.client(), payload))
        );
        ClientTickEvents.END_CLIENT_TICK.register(SturmfrontClient::tick);
        HudElementRegistry.addLast(
                Aetherklang.id("sturmfront_weather"),
                (context, tickCounter) -> render(context)
        );
    }

    private static void accept(MinecraftClient client, ModPayloads.SturmfrontSyncPayload payload) {
        boolean pushed = active && payload.active() && payload.revision() != revision;
        active = payload.active();
        centerX = payload.centerX();
        centerZ = payload.centerZ();
        radius = payload.radius();
        directionX = payload.directionX();
        directionZ = payload.directionZ();
        intensity = payload.intensity();
        revision = payload.revision();
        receivedAtWorldTime = client.world == null ? 0L : client.world.getTime();
        if (pushed) {
            responsePulse = 1.0F;
            spawnResponseBurst(client);
        }
    }

    private static void tick(MinecraftClient client) {
        clientTicks++;
        responsePulse *= 0.84F;
        if (!active
                || client.world == null
                || client.player == null
                || !isKammerton(client.world)) {
            return;
        }
        float exposure = exposure(client.world, client.player);
        if (exposure <= 0.02F || clientTicks % 2 != 0) {
            return;
        }
        spawnWeather(client.world, client.player, exposure);
    }

    private static void spawnWeather(ClientWorld world, ClientPlayerEntity player, float exposure) {
        Random random = world.getRandom();
        int budget = FxBudget.claimParticles(
                2 + Math.round(exposure * 6.0F),
                exposure >= 0.55F ? FxBudget.Priority.NORMAL : FxBudget.Priority.AMBIENT
        );
        for (int particle = 0; particle < budget; particle++) {
            double side = (random.nextDouble() - 0.5D) * (5.0D + exposure * 8.0D);
            double forward = (random.nextDouble() - 0.5D) * (4.0D + exposure * 5.0D);
            double x = player.getX() + directionX * forward - directionZ * side;
            double z = player.getZ() + directionZ * forward + directionX * side;
            double y = player.getY() + random.nextDouble() * (3.0D + exposure * 4.5D);
            world.addParticleClient(
                    particle % 4 == 0 ? ModParticles.GENERALPAUSE_NEBEL : ModParticles.DISSONANZ_SMOKE,
                    x,
                    y,
                    z,
                    directionX * (0.045D + exposure * 0.08D),
                    -0.006D + random.nextDouble() * 0.016D,
                    directionZ * (0.045D + exposure * 0.08D)
            );
        }
    }

    private static void spawnResponseBurst(MinecraftClient client) {
        if (client.world == null || client.player == null || !isKammerton(client.world)) {
            return;
        }
        int budget = FxBudget.claimParticles(72, FxBudget.Priority.CRITICAL);
        Vec3d center = client.player.getEntityPos().add(0.0D, 0.45D, 0.0D);
        for (int particle = 0; particle < budget; particle++) {
            double angle = particle * 2.399963229728653D;
            double speed = 0.045D + particle / (double) Math.max(1, budget) * 0.12D;
            client.world.addParticleClient(
                    particle % 3 == 0 ? ModParticles.AKKORD_GLYPH : ModParticles.DISSONANZ_SMOKE,
                    center.x,
                    center.y + particle % 7 * 0.08D,
                    center.z,
                    Math.cos(angle) * speed,
                    0.035D + particle % 5 * 0.008D,
                    Math.sin(angle) * speed
            );
        }
    }

    private static void render(DrawContext context) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (!active
                || client.world == null
                || client.player == null
                || client.currentScreen != null
                || client.options.hudHidden
                || !isKammerton(client.world)) {
            return;
        }

        Vec3d estimatedCenter = estimatedCenter(client.world);
        double deltaX = estimatedCenter.x - client.player.getX();
        double deltaZ = estimatedCenter.z - client.player.getZ();
        int distance = (int) Math.round(Math.hypot(deltaX, deltaZ));
        float exposure = exposure(estimatedCenter, client.player);
        String bearing = bearing(deltaX, deltaZ);
        Text label = Text.translatable(
                "hud.aetherklang.sturmfront",
                Math.round(intensity * 100.0F),
                distance,
                bearing
        );

        int width = Math.max(176, client.textRenderer.getWidth(label) + 24);
        int x = (context.getScaledWindowWidth() - width) / 2;
        int y = 8;
        int accent = mix(FxPalette.INDIGO, FxPalette.MAGENTA, 0.55F + exposure * 0.45F);
        GlassHud.drawPanel(context, x, y, width, 28, accent, 190);
        context.drawTextWithShadow(client.textRenderer, label, x + 10, y + 6, 0xFFF4EEFF);

        int trackX = x + 10;
        int trackY = y + 19;
        int trackWidth = width - 20;
        context.fill(trackX, trackY, trackX + trackWidth, trackY + 3, FxPalette.withAlpha(0x211632, 230));
        int fill = Math.round(trackWidth * Math.max(0.025F, exposure));
        context.fill(trackX, trackY, trackX + fill, trackY + 3, FxPalette.withAlpha(accent, 245));

        if (exposure > 0.0F || responsePulse > 0.01F) {
            renderStormFrame(context, exposure);
        }
    }

    private static void renderStormFrame(DrawContext context, float exposure) {
        float strength = MathHelper.clamp(exposure + responsePulse * 0.65F, 0.0F, 1.0F);
        int width = context.getScaledWindowWidth();
        int height = context.getScaledWindowHeight();
        int thickness = 2 + Math.round(strength * 5.0F);
        int alpha = 18 + Math.round(strength * 76.0F);
        int color = FxPalette.withAlpha(FxPalette.MAGENTA, alpha);
        context.fill(0, 0, width, thickness, color);
        context.fill(0, height - thickness, width, height, color);
        context.fill(0, thickness, thickness, height - thickness, color);
        context.fill(width - thickness, thickness, width, height - thickness, color);
    }

    private static float exposure(ClientWorld world, ClientPlayerEntity player) {
        return exposure(estimatedCenter(world), player);
    }

    private static float exposure(Vec3d frontCenter, ClientPlayerEntity player) {
        if (radius <= 0.0F) {
            return 0.0F;
        }
        double distance = Math.hypot(frontCenter.x - player.getX(), frontCenter.z - player.getZ());
        return MathHelper.clamp((1.0F - (float) (distance / radius)) * intensity, 0.0F, 1.0F);
    }

    private static Vec3d estimatedCenter(ClientWorld world) {
        long elapsed = Math.clamp(world.getTime() - receivedAtWorldTime, 0L, 40L);
        return new Vec3d(
                centerX + directionX * MARCH_SPEED * elapsed,
                0.0D,
                centerZ + directionZ * MARCH_SPEED * elapsed
        );
    }

    private static String bearing(double deltaX, double deltaZ) {
        double angle = Math.atan2(deltaZ, deltaX);
        int sector = Math.floorMod((int) Math.round(angle / (Math.PI / 4.0D)), 8);
        return switch (sector) {
            case 0 -> "→";
            case 1 -> "↘";
            case 2 -> "↓";
            case 3 -> "↙";
            case 4 -> "←";
            case 5 -> "↖";
            case 6 -> "↑";
            default -> "↗";
        };
    }

    private static int mix(int from, int to, float amount) {
        float clamped = MathHelper.clamp(amount, 0.0F, 1.0F);
        int red = Math.round(MathHelper.lerp(clamped, from >> 16 & 0xFF, to >> 16 & 0xFF));
        int green = Math.round(MathHelper.lerp(clamped, from >> 8 & 0xFF, to >> 8 & 0xFF));
        int blue = Math.round(MathHelper.lerp(clamped, from & 0xFF, to & 0xFF));
        return red << 16 | green << 8 | blue;
    }

    private static boolean isKammerton(ClientWorld world) {
        return world.getRegistryKey().getValue().equals(Aetherklang.id("kammerton"));
    }
}
