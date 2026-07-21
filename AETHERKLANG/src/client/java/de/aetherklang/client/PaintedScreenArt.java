package de.aetherklang.client;

import com.mojang.blaze3d.pipeline.RenderPipeline;
import de.aetherklang.Aetherklang;
import net.minecraft.client.gl.RenderPipelines;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.MathHelper;

/**
 * Shared UHD background plates and restrained ambient motion for the three
 * full-screen Aetherklang interfaces.
 */
public final class PaintedScreenArt {
    private static final int CYAN = 0x5FF5E0;
    private static final int GOLD = 0xF5C95F;
    private static final int MAGENTA = 0xE03A8C;
    private static final int TEXTURE_WIDTH = 3840;
    private static final int TEXTURE_HEIGHT = 2160;
    private static final RenderPipeline TEXTURED = RenderPipelines.GUI_TEXTURED;

    private PaintedScreenArt() {
    }

    public enum Scene {
        KODEX("kodex_uhd", CYAN, GOLD),
        LEITMOTIV("leitmotiv_uhd", MAGENTA, 0x72A7FF),
        NOTENPULT("notenpult_uhd", GOLD, CYAN);

        private final Identifier texture;
        private final int primary;
        private final int secondary;

        Scene(String textureName, int primary, int secondary) {
            texture = Aetherklang.id("textures/gui/" + textureName + ".png");
            this.primary = primary;
            this.secondary = secondary;
        }
    }

    public static void draw(DrawContext context, Scene scene, int width, int height) {
        drawCoverTexture(context, scene.texture, width, height);
        context.fillGradient(0, 0, width, height, 0x281A1033, 0x78070210);
        drawMotes(context, scene, width, height);

        double time = System.currentTimeMillis() / 1000.0D;
        switch (scene) {
            case KODEX -> drawCodexWave(context, width, height, time);
            case LEITMOTIV -> drawLeitmotivPulse(context, width, height, time);
            case NOTENPULT -> drawNotenpultHalos(context, width, height, time);
        }

        int vignette = Math.max(10, height / 12);
        context.fillGradient(0, 0, width, vignette, 0xB0080412, 0x00100820);
        context.fillGradient(0, height - vignette, width, height, 0x00100820, 0xC005020D);
    }

    private static void drawCoverTexture(DrawContext context, Identifier texture, int width, int height) {
        float targetAspect = width / (float) Math.max(1, height);
        float textureAspect = TEXTURE_WIDTH / (float) TEXTURE_HEIGHT;
        int sourceWidth = TEXTURE_WIDTH;
        int sourceHeight = TEXTURE_HEIGHT;
        float sourceX = 0.0F;
        float sourceY = 0.0F;

        if (targetAspect > textureAspect) {
            sourceHeight = Math.max(1, Math.round(TEXTURE_WIDTH / targetAspect));
            sourceY = (TEXTURE_HEIGHT - sourceHeight) / 2.0F;
        } else if (targetAspect < textureAspect) {
            sourceWidth = Math.max(1, Math.round(TEXTURE_HEIGHT * targetAspect));
            sourceX = (TEXTURE_WIDTH - sourceWidth) / 2.0F;
        }

        context.drawTexture(
                TEXTURED,
                texture,
                0,
                0,
                sourceX,
                sourceY,
                width,
                height,
                sourceWidth,
                sourceHeight,
                TEXTURE_WIDTH,
                TEXTURE_HEIGHT
        );
    }

    private static void drawMotes(DrawContext context, Scene scene, int width, int height) {
        long clock = System.currentTimeMillis() / 35L;
        for (int index = 0; index < 48; index++) {
            int speed = 1 + index % 3;
            int x = Math.floorMod(index * 197 + (int) (clock * speed / 5L), Math.max(1, width));
            int y = Math.floorMod(index * 113 - (int) (clock * speed / 7L), Math.max(1, height));
            int pulse = (int) ((clock + index * 17L) % 90L);
            int alpha = 28 + (45 - Math.abs(45 - pulse));
            int color = withAlpha(index % 4 == 0 ? scene.secondary : scene.primary, alpha);
            int size = index % 11 == 0 ? 2 : 1;
            context.fill(x, y, x + size, y + size, color);
        }
    }

    private static void drawCodexWave(DrawContext context, int width, int height, double time) {
        int baseline = height * 79 / 100;
        int step = Math.max(3, width / 420);
        for (int x = 0; x < width; x += step) {
            double phase = x * 0.028D + time * 1.4D;
            int y = baseline + (int) Math.round(Math.sin(phase) * 4.0D + Math.sin(phase * 0.37D) * 2.0D);
            float blend = x / (float) Math.max(1, width);
            int color = blend < 0.5F ? 0x565FF5E0 : 0x56F5C95F;
            context.fill(x, y, Math.min(width, x + Math.max(1, step - 1)), y + 1, color);
        }
    }

    private static void drawLeitmotivPulse(DrawContext context, int width, int height, double time) {
        int[] colors = {MAGENTA, CYAN, 0x72A7FF};
        for (int branch = 0; branch < colors.length; branch++) {
            int centerX = width * (branch * 2 + 2) / 8;
            int travel = Math.max(1, height * 3 / 5);
            int centerY = height * 4 / 5 - Math.floorMod((int) (time * 34.0D) + branch * travel / 3, travel);
            int radius = 6 + (int) Math.round((Math.sin(time * 2.0D + branch) + 1.0D) * 3.0D);
            drawDiamond(context, centerX, centerY, radius, withAlpha(colors[branch], 135));
            context.fill(centerX, centerY - radius * 2, centerX + 1, centerY + radius * 2 + 1,
                    withAlpha(colors[branch], 48));
        }
    }

    private static void drawNotenpultHalos(DrawContext context, int width, int height, double time) {
        int[] colors = {CYAN, GOLD, CYAN};
        for (int score = 0; score < 3; score++) {
            int centerX = width * (score + 1) / 4;
            int centerY = height * 27 / 100;
            int radius = 10 + (int) Math.round((Math.sin(time * 1.7D + score * 1.4D) + 1.0D) * 5.0D);
            drawDiamond(context, centerX, centerY, radius, withAlpha(colors[score], 105));
            drawDiamond(context, centerX, centerY, radius + 7, withAlpha(colors[score], 42));
        }
    }

    private static void drawDiamond(DrawContext context, int centerX, int centerY, int radius, int color) {
        int safeRadius = MathHelper.clamp(radius, 2, 32);
        for (int offset = -safeRadius; offset <= safeRadius; offset++) {
            int yOffset = safeRadius - Math.abs(offset);
            context.fill(centerX + offset, centerY - yOffset, centerX + offset + 1, centerY - yOffset + 1, color);
            context.fill(centerX + offset, centerY + yOffset, centerX + offset + 1, centerY + yOffset + 1, color);
        }
    }

    private static int withAlpha(int rgb, int alpha) {
        return (MathHelper.clamp(alpha, 0, 255) << 24) | (rgb & 0xFFFFFF);
    }
}
