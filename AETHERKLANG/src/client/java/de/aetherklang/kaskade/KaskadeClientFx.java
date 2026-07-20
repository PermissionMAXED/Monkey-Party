package de.aetherklang.kaskade;

import de.aetherklang.Aetherklang;
import de.aetherklang.client.fx.FxPalette;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModPayloads;
import de.aetherklang.registry.ModSounds;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.particle.DustParticleEffect;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.Vec3d;
import net.minecraft.util.math.random.Random;

/**
 * Client-side bursts for the dedicated Kaskade and Weltakkord payloads.
 */
public final class KaskadeClientFx {
    private static float weltakkordPulse;
    private static int weltakkordPower;
    private static boolean reduced;
    private static boolean registered;

    private KaskadeClientFx() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        ClientPlayNetworking.registerGlobalReceiver(
                ModPayloads.KaskadeFxPayload.ID,
                (payload, context) -> context.client().execute(() -> onKaskade(payload))
        );
        ClientPlayNetworking.registerGlobalReceiver(
                ModPayloads.WeltakkordFxPayload.ID,
                (payload, context) -> context.client().execute(() -> onWeltakkord(payload))
        );
        ClientTickEvents.END_CLIENT_TICK.register(client -> weltakkordPulse *= 0.9F);
        HudElementRegistry.addLast(
                Aetherklang.id("weltakkord_flash"),
                (context, tickCounter) -> renderWeltakkordFlash(context)
        );
    }

    private static void onKaskade(ModPayloads.KaskadeFxPayload payload) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.world == null || client.player == null) {
            return;
        }
        Vec3d center = new Vec3d(payload.x() + 0.5D, payload.y() + 0.65D, payload.z() + 0.5D);
        boolean complete = payload.stage() == KaskadeEventEngine.COMPLETE_FX;
        int amount = complete ? 110 : 45 + payload.stage() * 18;
        Random random = client.world.getRandom();
        for (int index = 0; index < amount; index++) {
            double angle = random.nextDouble() * Math.PI * 2.0D;
            double radius = 0.4D + random.nextDouble() * (complete ? 5.0D : 3.0D);
            double y = center.y + random.nextDouble() * (complete ? 3.4D : 2.2D);
            client.world.addParticleClient(
                    complete
                            ? (index % 3 == 0 ? ModParticles.ENSEMBLE_FUNKE : ModParticles.BEAM_MOTE)
                            : ModParticles.DISSONANZ_SMOKE,
                    center.x + Math.cos(angle) * radius,
                    y,
                    center.z + Math.sin(angle) * radius,
                    -Math.sin(angle) * 0.025D,
                    complete ? 0.06D : 0.025D,
                    Math.cos(angle) * 0.025D
            );
        }
        client.player.playSound(
                complete ? ModSounds.AKKORD_COMPLETE : ModSounds.DISSONANZ_HIT,
                complete ? 1.25F : 0.9F,
                complete ? 1.4F : 0.7F + payload.stage() * 0.08F
        );
    }

    private static void onWeltakkord(ModPayloads.WeltakkordFxPayload payload) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.world == null || client.player == null) {
            return;
        }
        weltakkordPulse = 1.0F;
        weltakkordPower = payload.power();
        reduced = payload.reduced();
        spawnWeltakkordBurst(
                client.world,
                new Vec3d(payload.x(), payload.y(), payload.z()),
                payload.power(),
                payload.reduced()
        );
        client.player.playSound(
                ModSounds.AKKORD_COMPLETE,
                payload.reduced() ? 0.9F : 1.5F,
                payload.reduced() ? 1.25F : 0.95F + payload.power() * 0.07F
        );
    }

    private static void spawnWeltakkordBurst(
            ClientWorld world,
            Vec3d center,
            int power,
            boolean reduced
    ) {
        int rings = reduced ? 3 : 5;
        long tick = world.getTime();
        for (int ring = 0; ring < rings; ring++) {
            int points = 28 + ring * 10;
            double radius = 1.0D + ring * (reduced ? 0.85D : 1.35D);
            for (int point = 0; point < points; point++) {
                double angle = point * Math.PI * 2.0D / points + ring * 0.41D + tick * 0.03D;
                double cos = Math.cos(angle);
                double sin = Math.sin(angle);
                world.addParticleClient(
                        ring % 2 == 0 ? ModParticles.AKKORD_GLYPH : ModParticles.ENSEMBLE_FUNKE,
                        center.x + cos * radius,
                        center.y + 0.25D + ring * 0.38D,
                        center.z + sin * radius,
                        cos * (0.03D + power * 0.005D),
                        0.045D,
                        sin * (0.03D + power * 0.005D)
                );
            }
        }

        Random random = world.getRandom();
        int motes = reduced ? 35 : 75 + power * 12;
        for (int mote = 0; mote < motes; mote++) {
            double angle = random.nextDouble() * Math.PI * 2.0D;
            double radius = random.nextDouble() * (reduced ? 3.0D : 5.0D + power * 0.4D);
            int color = switch (mote % 3) {
                case 0 -> FxPalette.CYAN;
                case 1 -> FxPalette.GOLD;
                default -> FxPalette.MAGENTA;
            };
            world.addParticleClient(
                    new DustParticleEffect(color, reduced ? 0.9F : 1.2F),
                    center.x + Math.cos(angle) * radius,
                    center.y + 0.2D + random.nextDouble() * (2.0D + power * 0.25D),
                    center.z + Math.sin(angle) * radius,
                    -Math.sin(angle) * 0.025D,
                    0.04D + random.nextDouble() * 0.05D,
                    Math.cos(angle) * 0.025D
            );
        }
    }

    private static void renderWeltakkordFlash(DrawContext context) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.player == null || client.world == null || weltakkordPulse < 0.01F) {
            return;
        }
        int width = client.getWindow().getScaledWidth();
        int height = client.getWindow().getScaledHeight();
        int alpha = MathHelper.clamp(Math.round(weltakkordPulse * (reduced ? 70.0F : 120.0F)), 0, 150);
        int thickness = 3 + (int) (weltakkordPulse * (reduced ? 5 : 9 + weltakkordPower));
        int color = FxPalette.withAlpha(reduced ? FxPalette.GOLD : FxPalette.CYAN, alpha);
        context.fill(0, 0, width, thickness, color);
        context.fill(0, height - thickness, width, height, color);
        context.fill(0, thickness, thickness, height - thickness, color);
        context.fill(width - thickness, thickness, width, height - thickness, color);
    }
}
