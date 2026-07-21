package de.aetherklang.client.fx.sky;

import de.aetherklang.client.fx.FxPalette;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.util.math.MathHelper;

/**
 * Deterministic, camera-parallax stars for Kammerton's otherwise timeless sky.
 */
final class Sternenfeld {
    private static final int FAR_STARS = 54;
    private static final int MID_STARS = 42;
    private static final int NEAR_STARS = 30;

    private Sternenfeld() {
    }

    static void render(
            DrawContext context,
            int width,
            int height,
            float time,
            double cameraX,
            double cameraY,
            double cameraZ,
            float yaw,
            float pitch,
            int primary,
            int secondary,
            float dissonanz,
            float beatPulse
    ) {
        float skyBottom = MathHelper.clamp(
                height * (0.52F + pitch / 360.0F),
                height * 0.30F,
                height * 0.72F
        );
        drawLayer(
                context,
                width,
                Math.max(1, Math.round(skyBottom)),
                FAR_STARS,
                0xD9E3FF,
                time,
                cameraX,
                cameraY,
                cameraZ,
                yaw,
                pitch,
                0.18F,
                dissonanz,
                beatPulse,
                0x51A3
        );
        drawLayer(
                context,
                width,
                Math.max(1, Math.round(skyBottom)),
                MID_STARS,
                primary,
                time,
                cameraX,
                cameraY,
                cameraZ,
                yaw,
                pitch,
                0.43F,
                dissonanz,
                beatPulse,
                0x9E37
        );
        drawLayer(
                context,
                width,
                Math.max(1, Math.round(skyBottom)),
                NEAR_STARS,
                secondary,
                time,
                cameraX,
                cameraY,
                cameraZ,
                yaw,
                pitch,
                0.82F,
                dissonanz,
                beatPulse,
                0xC7F1
        );
    }

    private static void drawLayer(
            DrawContext context,
            int width,
            int skyHeight,
            int count,
            int color,
            float time,
            double cameraX,
            double cameraY,
            double cameraZ,
            float yaw,
            float pitch,
            float depth,
            float dissonanz,
            float beatPulse,
            int salt
    ) {
        double horizontalParallax = yaw / 360.0D * width * depth
                + (cameraX * 0.11D + cameraZ * 0.075D) * depth;
        double verticalParallax = pitch / 180.0D * skyHeight * depth
                + cameraY * 0.012D * depth;
        int stormTick = (int) Math.floor(time * (0.11F + dissonanz * 0.19F));
        float storm = MathHelper.clamp((dissonanz - 0.48F) / 0.52F, 0.0F, 1.0F);

        for (int index = 0; index < count; index++) {
            int seed = mixBits(index * 0x45D9F3B + salt);
            int verticalSeed = mixBits(seed ^ 0x6C8E9CF5);
            double baseX = unit(seed) * width;
            double baseY = unit(verticalSeed) * skyHeight;
            int jitterSeed = mixBits(seed ^ stormTick * 0x1F123BB5);
            double jitterX = (unit(jitterSeed) - 0.5D) * storm * 7.0D * depth;
            double jitterY = (unit(mixBits(jitterSeed ^ 0x55AA33CC)) - 0.5D) * storm * 4.0D * depth;
            int x = Math.floorMod(
                    (int) Math.round(baseX - horizontalParallax + jitterX),
                    Math.max(1, width)
            );
            int y = Math.floorMod(
                    (int) Math.round(baseY + verticalParallax + jitterY),
                    Math.max(1, skyHeight)
            );

            float twinkle = 0.5F + 0.5F * MathHelper.sin(
                    time * (0.035F + depth * 0.022F) + index * 2.399F + salt
            );
            int alpha = MathHelper.clamp(
                    Math.round(18.0F + depth * 28.0F + twinkle * 32.0F + beatPulse * 24.0F),
                    8,
                    96
            );
            int starColor = dissonanz > 0.58F && Math.floorMod(seed, 7) < 2
                    ? FxPalette.MAGENTA
                    : color;
            context.fill(x, y, x + 1, y + 1, FxPalette.withAlpha(starColor, alpha));

            boolean bright = (seed & 15) == 0 || depth > 0.75F && (seed & 7) == 0;
            if (bright) {
                int rayAlpha = Math.max(5, alpha / 3);
                int rayColor = FxPalette.withAlpha(starColor, rayAlpha);
                context.fill(x - 1, y, x + 2, y + 1, rayColor);
                context.fill(x, y - 1, x + 1, y + 2, rayColor);
            }
        }
    }

    private static int mixBits(int value) {
        int mixed = value;
        mixed = (mixed ^ mixed >>> 16) * 0x7FEB352D;
        mixed = (mixed ^ mixed >>> 15) * 0x846CA68B;
        return mixed ^ mixed >>> 16;
    }

    private static double unit(int value) {
        return (value & 0x7FFFFFFF) / (double) Integer.MAX_VALUE;
    }
}
