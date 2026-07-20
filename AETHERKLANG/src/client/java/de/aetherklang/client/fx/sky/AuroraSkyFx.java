package de.aetherklang.client.fx.sky;

import de.aetherklang.Aetherklang;
import de.aetherklang.client.fx.FxPalette;
import de.aetherklang.crescendo.AuroraHooks;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.resonance.client.ClientResonanceCache;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.random.Random;

/**
 * A layered, animated Kammerton skyscape rendered behind the vanilla HUD.
 *
 * <p>Fabric 1.21.9 no longer exposes the old {@code DimensionRenderingRegistry}
 * sky callback. A first HUD layer is used instead so the aurora remains isolated
 * to Kammerton without replacing Minecraft's render graph.</p>
 */
public final class AuroraSkyFx {
    private static final int BAND_COUNT = 5;
    private static final int HORIZONTAL_STEP = 3;

    private static boolean registered;
    private static int clientTicks;
    private static float beatPulse;

    private AuroraSkyFx() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        HudElementRegistry.addFirst(Aetherklang.id("kammerton_aurora"), (context, tickCounter) -> render(context));
        ClientTickEvents.END_CLIENT_TICK.register(AuroraSkyFx::tick);
    }

    public static void onBeat() {
        beatPulse = 1.0F;
    }

    private static void tick(MinecraftClient client) {
        clientTicks++;
        beatPulse *= 0.82F;
        if (client.player == null || client.world == null || !isKammerton(client.world)) {
            return;
        }

        if (clientTicks % 3 == 0) {
            spawnSkyWisps(client.world, client.player);
        }
    }

    private static void render(DrawContext context) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.world == null
                || client.player == null
                || client.currentScreen != null
                || !isKammerton(client.world)) {
            return;
        }

        int width = client.getWindow().getScaledWidth();
        int height = client.getWindow().getScaledHeight();
        float time = client.world.getTime() + clientTicks * 0.05F;
        float dissonanz = ClientResonanceCache.getDissonanz();
        int mood = FxPalette.primary(ClientResonanceCache.getMood());
        int echo = FxPalette.secondary(ClientResonanceCache.getMood());
        int shifted = mix(mood, FxPalette.MAGENTA, dissonanz * 0.72F);
        int echoShifted = mix(echo, FxPalette.MAGENTA, dissonanz * 0.42F);

        int indigoAlpha = 20 + Math.round(dissonanz * 13.0F + beatPulse * 8.0F);
        context.fill(0, 0, width, Math.max(1, height * 3 / 5), FxPalette.withAlpha(FxPalette.INDIGO, indigoAlpha));

        for (int band = 0; band < BAND_COUNT; band++) {
            drawBand(
                    context,
                    width,
                    height,
                    band,
                    time,
                    band % 2 == 0 ? shifted : echoShifted,
                    dissonanz
            );
        }
    }

    private static void drawBand(
            DrawContext context,
            int width,
            int height,
            int band,
            float time,
            int color,
            float dissonanz
    ) {
        float bandPhase = time * (0.028F + band * 0.004F) + band * 1.37F;
        float baseY = height * (0.08F + band * 0.065F);
        float amplitude = height * (0.018F + band * 0.003F) * (1.0F + beatPulse * 0.72F);
        int coreAlpha = MathHelper.clamp(
                22 + band * 3 + Math.round(beatPulse * 42.0F + dissonanz * 15.0F),
                0,
                88
        );
        int glowAlpha = Math.max(3, coreAlpha / 4);
        int thickness = 2 + band % 2 + Math.round(beatPulse * 2.0F);

        for (int x = -HORIZONTAL_STEP; x < width + HORIZONTAL_STEP; x += HORIZONTAL_STEP) {
            float normalized = x / (float) Math.max(1, width);
            float wave = MathHelper.sin(normalized * 12.0F + bandPhase)
                    + MathHelper.sin(normalized * 25.0F - bandPhase * 0.63F) * 0.42F
                    + MathHelper.sin(normalized * 5.0F + bandPhase * 0.31F) * 0.55F;
            int y = Math.round(baseY + wave * amplitude);
            int shimmer = Math.round(
                    MathHelper.sin(normalized * 37.0F + bandPhase * 2.1F) * (1.0F + beatPulse * 2.0F)
            );

            context.fill(
                    x,
                    y - thickness * 2 + shimmer,
                    x + HORIZONTAL_STEP + 1,
                    y + thickness * 3 + shimmer,
                    FxPalette.withAlpha(color, glowAlpha)
            );
            context.fill(
                    x,
                    y + shimmer,
                    x + HORIZONTAL_STEP + 1,
                    y + thickness + shimmer,
                    FxPalette.withAlpha(color, coreAlpha)
            );
        }
    }

    private static void spawnSkyWisps(ClientWorld world, ClientPlayerEntity player) {
        Random random = world.getRandom();
        int amount = beatPulse > 0.35F ? 3 : 1;
        for (int index = 0; index < amount; index++) {
            double angle = random.nextDouble() * Math.PI * 2.0D;
            double radius = 9.0D + random.nextDouble() * 15.0D;
            double height = 8.0D + random.nextDouble() * 10.0D;
            double drift = 0.012D + random.nextDouble() * 0.018D;
            world.addParticleClient(
                    ModParticles.AURORA_WISP,
                    player.getX() + Math.cos(angle) * radius,
                    player.getY() + height,
                    player.getZ() + Math.sin(angle) * radius,
                    -Math.sin(angle) * drift,
                    0.002D + random.nextDouble() * 0.005D,
                    Math.cos(angle) * drift
            );
        }
    }

    private static boolean isKammerton(ClientWorld world) {
        return world.getRegistryKey().getValue().equals(Aetherklang.id(AuroraHooks.KAMMERTON_PATH));
    }

    private static int mix(int from, int to, float amount) {
        float clamped = MathHelper.clamp(amount, 0.0F, 1.0F);
        int red = Math.round(MathHelper.lerp(clamped, from >> 16 & 0xFF, to >> 16 & 0xFF));
        int green = Math.round(MathHelper.lerp(clamped, from >> 8 & 0xFF, to >> 8 & 0xFF));
        int blue = Math.round(MathHelper.lerp(clamped, from & 0xFF, to & 0xFF));
        return red << 16 | green << 8 | blue;
    }
}
