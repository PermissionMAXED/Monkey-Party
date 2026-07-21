package de.aetherklang.client.fx.sky;

import de.aetherklang.client.fx.FxPalette;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.util.math.MathHelper;

/**
 * Broad translucent clouds that drift at a slower camera-parallax rate than the
 * aurora curtains.
 */
final class NebulaLayer {
    private NebulaLayer() {
    }

    static void render(
            DrawContext context,
            int width,
            int height,
            float time,
            double cameraX,
            double cameraZ,
            float yaw,
            float pitch,
            int primary,
            int secondary,
            float dissonanz,
            float beatPulse
    ) {
        int skyBottom = MathHelper.clamp(
                Math.round(height * (0.56F + pitch / 420.0F)),
                Math.max(1, height / 3),
                Math.max(1, height * 3 / 4)
        );
        float storm = MathHelper.clamp((dissonanz - 0.50F) / 0.50F, 0.0F, 1.0F);

        context.fillGradient(
                0,
                0,
                width,
                skyBottom,
                FxPalette.withAlpha(primary, 7 + Math.round(beatPulse * 4.0F)),
                FxPalette.withAlpha(secondary, 1)
        );

        drawCloud(
                context,
                width,
                skyBottom,
                time,
                cameraX,
                cameraZ,
                yaw,
                pitch,
                primary,
                0,
                0.17F,
                dissonanz,
                beatPulse
        );
        drawCloud(
                context,
                width,
                skyBottom,
                time,
                cameraX,
                cameraZ,
                yaw,
                pitch,
                secondary,
                1,
                0.31F,
                dissonanz,
                beatPulse
        );
        drawCloud(
                context,
                width,
                skyBottom,
                time,
                cameraX,
                cameraZ,
                yaw,
                pitch,
                storm > 0.0F ? FxPalette.MAGENTA : primary,
                2,
                0.49F,
                dissonanz,
                beatPulse
        );
    }

    private static void drawCloud(
            DrawContext context,
            int width,
            int skyHeight,
            float time,
            double cameraX,
            double cameraZ,
            float yaw,
            float pitch,
            int color,
            int layer,
            float depth,
            float dissonanz,
            float beatPulse
    ) {
        int cellWidth = 13 + layer * 4;
        int drift = Math.round(
                time * (0.013F + layer * 0.004F)
                        + yaw / 360.0F * width * depth
                        + (float) (cameraX * 0.025D + cameraZ * 0.018D) * depth
        );
        int offset = Math.floorMod(drift, cellWidth);
        float storm = MathHelper.clamp((dissonanz - 0.50F) / 0.50F, 0.0F, 1.0F);
        float center = skyHeight * (0.20F + layer * 0.115F + pitch / 720.0F);
        float spread = skyHeight * (0.10F + layer * 0.018F);

        for (int x = -cellWidth - offset; x < width + cellWidth; x += cellWidth) {
            float normalized = (x + drift) / (float) Math.max(1, width);
            float broadWave = MathHelper.sin(normalized * 8.5F + time * 0.006F + layer * 2.1F);
            float detailWave = MathHelper.sin(normalized * 21.0F - time * 0.011F + layer) * 0.42F;
            float density = 0.5F + 0.5F * MathHelper.sin(normalized * 13.0F + layer * 1.71F);
            int y = Math.round(center + (broadWave + detailWave) * spread);
            int thickness = Math.max(2, Math.round(
                    3.0F + density * (7.0F + layer * 2.0F) + beatPulse * 2.0F
            ));
            int alpha = MathHelper.clamp(
                    Math.round(4.0F + density * 10.0F + beatPulse * 4.0F + storm * 5.0F),
                    2,
                    24
            );
            int glow = FxPalette.withAlpha(color, Math.max(2, alpha / 3));
            context.fill(
                    x,
                    Math.max(0, y - thickness),
                    x + cellWidth + 1,
                    Math.min(skyHeight, y + thickness * 2),
                    glow
            );
            context.fill(
                    x,
                    Math.max(0, y),
                    x + cellWidth + 1,
                    Math.min(skyHeight, y + thickness),
                    FxPalette.withAlpha(color, alpha)
            );
        }
    }
}
