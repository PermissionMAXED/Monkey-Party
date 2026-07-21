package de.aetherklang.client.fx.sky;

import de.aetherklang.Aetherklang;
import de.aetherklang.client.fx.FxPalette;
import de.aetherklang.crescendo.AuroraHooks;
import de.aetherklang.insel.client.ClientRegionState;
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
    private static final RegionStyle DEFAULT_STYLE = new RegionStyle(
            FxPalette.INDIGO, FxPalette.CYAN, FxPalette.GOLD, 5, 1.0F, 0.08F, 0.065F, 0.018F, 3, 1
    );
    private static final RegionStyle WEST_STYLE = new RegionStyle(
            0x12082A, 0x9C82FF, FxPalette.MAGENTA, 4, 0.68F, 0.12F, 0.078F, 0.026F, 4, 1
    );
    private static final RegionStyle EAST_STYLE = new RegionStyle(
            0x06252D, FxPalette.CYAN, FxPalette.GOLD, 7, 1.34F, 0.055F, 0.046F, 0.013F, 2, 2
    );
    private static final RegionStyle SOUTH_STYLE = new RegionStyle(
            0x2A071C, FxPalette.MAGENTA, FxPalette.GOLD, 6, 1.58F, 0.07F, 0.058F, 0.027F, 3, 3
    );
    private static final RegionStyle OEDE_STYLE = new RegionStyle(
            0x0C0D18, 0xC8C7DA, 0x75658D, 3, 0.42F, 0.14F, 0.088F, 0.012F, 5, 1
    );

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
        float yaw = client.player.getYaw();
        float pitch = client.player.getPitch();
        double cameraX = client.player.getX();
        double cameraY = client.player.getY();
        double cameraZ = client.player.getZ();
        RegionStyle style = style(ClientRegionState.regionId());
        int mood = FxPalette.primary(ClientResonanceCache.getMood());
        int echo = FxPalette.secondary(ClientResonanceCache.getMood());
        int regionalMood = mix(style.primary(), mood, 0.38F);
        int regionalEcho = mix(style.secondary(), echo, 0.30F);
        int shifted = mix(regionalMood, FxPalette.MAGENTA, dissonanz * 0.72F);
        int echoShifted = mix(regionalEcho, FxPalette.MAGENTA, dissonanz * 0.42F);

        int indigoAlpha = 20 + Math.round(dissonanz * 13.0F + beatPulse * 8.0F);
        context.fill(
                0,
                0,
                width,
                Math.max(1, height * 3 / 5),
                FxPalette.withAlpha(style.background(), indigoAlpha)
        );
        Sternenfeld.render(
                context,
                width,
                height,
                time,
                cameraX,
                cameraY,
                cameraZ,
                yaw,
                pitch,
                regionalMood,
                regionalEcho,
                dissonanz,
                beatPulse
        );
        NebulaLayer.render(
                context,
                width,
                height,
                time,
                cameraX,
                cameraZ,
                yaw,
                pitch,
                mix(style.background(), shifted, 0.42F),
                mix(style.background(), echoShifted, 0.34F),
                dissonanz,
                beatPulse
        );
        drawRegionHorizon(context, width, height, style, time, yaw, pitch, cameraX, cameraZ);

        for (int band = 0; band < style.bandCount(); band++) {
            drawBand(
                    context,
                    width,
                    height,
                    band,
                    time,
                    band % 2 == 0 ? shifted : echoShifted,
                    dissonanz,
                    style,
                    yaw,
                    pitch,
                    cameraX,
                    cameraZ
            );
        }
        drawDissonanceStorm(context, width, height, time, dissonanz, shifted, yaw);
    }

    private static void drawBand(
            DrawContext context,
            int width,
            int height,
            int band,
            float time,
            int color,
            float dissonanz,
            RegionStyle style,
            float yaw,
            float pitch,
            double cameraX,
            double cameraZ
    ) {
        float depth = 0.36F + band / (float) Math.max(1, style.bandCount()) * 0.48F;
        float parallax = yaw / 360.0F * width * depth
                + (float) (cameraX * 0.035D + cameraZ * 0.022D) * depth;
        float bandPhase = time * style.speed() * (0.028F + band * 0.004F)
                + band * 1.37F
                + parallax / Math.max(1.0F, width) * 8.0F;
        float baseY = height * (style.baseY() + band * style.spacing() + pitch / 980.0F * depth);
        float amplitude = height * (style.amplitude() + band * 0.0025F) * (1.0F + beatPulse * 0.72F);
        float storm = MathHelper.clamp((dissonanz - 0.50F) / 0.50F, 0.0F, 1.0F);
        int coreAlpha = MathHelper.clamp(
                24 + band * 3 + Math.round(beatPulse * 42.0F + dissonanz * 15.0F),
                0,
                96
        );
        int outerGlowAlpha = Math.max(2, coreAlpha / 7);
        int glowAlpha = Math.max(3, coreAlpha / 3);
        int thickness = 2 + band % 2 + Math.round(beatPulse * 2.0F);

        int horizontalStep = style.horizontalStep();
        for (int x = -horizontalStep; x < width + horizontalStep; x += horizontalStep) {
            float normalized = x / (float) Math.max(1, width);
            float wave = MathHelper.sin(normalized * 12.0F + bandPhase)
                    + MathHelper.sin(normalized * 25.0F - bandPhase * 0.63F) * 0.42F
                    + MathHelper.sin(normalized * 5.0F + bandPhase * 0.31F) * 0.55F
                    + MathHelper.sin(normalized * 53.0F + time * 0.17F) * storm * 0.28F;
            int y = Math.round(baseY + wave * amplitude);
            int shimmer = Math.round(
                    MathHelper.sin(normalized * 37.0F + bandPhase * 2.1F)
                            * (1.0F + beatPulse * 2.0F + storm * 2.0F)
            );

            int curtainLength = Math.max(
                    3,
                    Math.round(height * (0.018F + (0.5F + wave * 0.25F) * 0.025F + beatPulse * 0.014F))
            );
            context.fill(
                    x,
                    y - thickness * 3 + shimmer,
                    x + horizontalStep + 1,
                    y + thickness * 5 + curtainLength + shimmer,
                    FxPalette.withAlpha(color, outerGlowAlpha)
            );
            context.fill(
                    x,
                    y - thickness * 2 + shimmer,
                    x + horizontalStep + 1,
                    y + thickness * 3 + curtainLength / 2 + shimmer,
                    FxPalette.withAlpha(color, glowAlpha)
            );
            context.fill(
                    x,
                    y + shimmer,
                    x + horizontalStep + 1,
                    y + thickness + shimmer,
                    FxPalette.withAlpha(color, coreAlpha)
            );
            if (Math.floorMod(x / Math.max(1, horizontalStep) + band * 3, 7) == 0) {
                context.fill(
                        x,
                        y + thickness + shimmer,
                        x + 1,
                        y + curtainLength + shimmer,
                        FxPalette.withAlpha(color, Math.max(4, coreAlpha / 3))
                );
            }
        }
    }

    private static void spawnSkyWisps(ClientWorld world, ClientPlayerEntity player) {
        Random random = world.getRandom();
        RegionStyle style = style(ClientRegionState.regionId());
        int amount = style.wispCount() + (beatPulse > 0.35F ? 2 : 0);
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

    private static void drawRegionHorizon(
            DrawContext context,
            int width,
            int height,
            RegionStyle style,
            float time,
            float yaw,
            float pitch,
            double cameraX,
            double cameraZ
    ) {
        int horizonY = Math.round(
                height * (style.baseY() + style.bandCount() * style.spacing() + 0.055F + pitch / 1100.0F)
        );
        context.fill(
                0,
                Math.max(0, horizonY),
                width,
                Math.min(height, horizonY + 2),
                FxPalette.withAlpha(style.secondary(), 12 + Math.round(beatPulse * 18.0F))
        );
        if (style != OEDE_STYLE) {
            return;
        }

        int offset = Math.floorMod(
                (int) (time * 0.18F + yaw / 360.0F * width * 0.24F + (cameraX + cameraZ) * 0.012D),
                31
        );
        for (int x = offset; x < width; x += 31) {
            int y = 12 + Math.floorMod(x * 17, Math.max(18, height / 3));
            int alpha = 18 + Math.floorMod(x * 13, 18);
            context.fill(x, y, x + 1, y + 1, FxPalette.withAlpha(style.primary(), alpha));
        }
    }

    private static void drawDissonanceStorm(
            DrawContext context,
            int width,
            int height,
            float time,
            float dissonanz,
            int auroraColor,
            float yaw
    ) {
        float storm = MathHelper.clamp((dissonanz - 0.50F) / 0.50F, 0.0F, 1.0F);
        if (storm <= 0.0F) {
            return;
        }

        int skyHeight = Math.max(1, height * 3 / 5);
        int pulse = Math.max(0, Math.round(
                MathHelper.sin(time * 0.21F) * 4.0F + MathHelper.sin(time * 0.047F) * 5.0F
        ));
        context.fill(
                0,
                0,
                width,
                skyHeight,
                FxPalette.withAlpha(FxPalette.MAGENTA, Math.round(storm * (5.0F + pulse)))
        );

        int stormTick = (int) Math.floor(time * (0.22F + storm * 0.18F));
        int tearCount = 3 + Math.round(storm * 9.0F);
        for (int tear = 0; tear < tearCount; tear++) {
            int seed = stormHash(stormTick * 41 + tear * 97);
            int x = Math.floorMod(seed + Math.round(yaw * 0.7F), Math.max(1, width));
            int y = Math.floorMod(seed >>> 9, Math.max(1, skyHeight * 2 / 3));
            int length = 8 + Math.floorMod(seed >>> 17, Math.max(9, skyHeight / 7));
            int direction = (seed & 1) == 0 ? -1 : 1;
            drawStormTear(
                    context,
                    x,
                    y,
                    length,
                    direction,
                    FxPalette.withAlpha(
                            tear % 3 == 0 ? auroraColor : FxPalette.MAGENTA,
                            Math.round(10.0F + storm * 30.0F)
                    )
            );
        }

        int lightningWindow = Math.floorMod((int) time, 53);
        if (lightningWindow < 2 && storm > 0.72F) {
            int flashAlpha = Math.round((storm - 0.72F) * 68.0F);
            context.fill(
                    0,
                    0,
                    width,
                    skyHeight,
                    FxPalette.withAlpha(0xE7D8FF, MathHelper.clamp(flashAlpha, 0, 24))
            );
        }
    }

    private static void drawStormTear(
            DrawContext context,
            int startX,
            int startY,
            int length,
            int direction,
            int color
    ) {
        int x = startX;
        int y = startY;
        int segments = Math.max(3, length / 4);
        for (int segment = 0; segment < segments; segment++) {
            int nextX = x + direction * (2 + Math.floorMod(segment * 3 + startX, 4));
            int nextY = y + 3 + Math.floorMod(segment + startY, 3);
            context.fill(
                    Math.min(x, nextX),
                    y,
                    Math.max(x, nextX) + 1,
                    nextY,
                    color
            );
            x = nextX;
            y = nextY;
        }
    }

    private static int stormHash(int value) {
        int mixed = value * 0x45D9F3B;
        mixed = (mixed ^ mixed >>> 16) * 0x45D9F3B;
        return mixed ^ mixed >>> 16;
    }

    private static RegionStyle style(String regionId) {
        return switch (regionId == null ? "" : regionId) {
            case "bassgewoelbe" -> WEST_STYLE;
            case "arpeggienmeer" -> EAST_STYLE;
            case "kakophonie_riff" -> SOUTH_STYLE;
            case "generalpause_oede" -> OEDE_STYLE;
            default -> DEFAULT_STYLE;
        };
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

    private record RegionStyle(
            int background,
            int primary,
            int secondary,
            int bandCount,
            float speed,
            float baseY,
            float spacing,
            float amplitude,
            int horizontalStep,
            int wispCount
    ) {
    }
}
