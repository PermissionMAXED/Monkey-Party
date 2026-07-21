package de.aetherklang.client;

import com.mojang.blaze3d.pipeline.RenderPipeline;
import de.aetherklang.Aetherklang;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gl.RenderPipelines;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.MathHelper;

/**
 * Shared low-resolution glass treatment for Aetherklang's in-world HUD modules.
 *
 * <p>The panels deliberately retain hard pixel edges so they stay crisp at every
 * Minecraft GUI scale. Translucent layers, a subtle noise texture, and a soft
 * highlight strip provide depth without hiding the world behind the HUD.</p>
 */
public final class GlassHud {
    public static final int CYAN = 0x5FF5E0;
    public static final int GOLD = 0xF5C95F;
    public static final int MAGENTA = 0xE03A8C;
    public static final int PAPER = 0xF4EEFF;
    public static final int MUTED = 0xB9A9D0;

    private static final int NOISE_SIZE = 16;
    private static final int GLINT_WIDTH = 64;
    private static final int GLINT_HEIGHT = 8;
    private static final Identifier NOISE_TEXTURE =
            Aetherklang.id("textures/gui/glass_noise.png");
    private static final Identifier GLINT_TEXTURE =
            Aetherklang.id("textures/gui/glass_glint.png");
    private static final RenderPipeline TEXTURED = RenderPipelines.GUI_TEXTURED;

    private GlassHud() {
    }

    public static void drawPanel(
            DrawContext context,
            int x,
            int y,
            int width,
            int height,
            int accent,
            int alpha
    ) {
        int opacity = MathHelper.clamp(alpha, 0, 255);
        cutCornerFill(context, x + 3, y + 4, width, height, withAlpha(0x000000, opacity * 70 / 255));
        cutCornerFill(context, x + 1, y + 2, width, height, withAlpha(0x090316, opacity * 92 / 255));
        cutCornerFill(context, x, y, width, height, withAlpha(accent, opacity * 205 / 255));
        cutCornerFill(context, x + 1, y + 1, width - 2, height - 2, withAlpha(0x251747, opacity * 220 / 255));
        cutCornerFill(context, x + 2, y + 2, width - 4, height - 4, withAlpha(0x100822, opacity));

        int horizon = y + Math.max(8, height / 2);
        context.fill(x + 3, y + 3, x + width - 3, horizon, withAlpha(0x49366D, opacity * 64 / 255));
        context.fill(x + 3, horizon, x + width - 3, y + height - 3, withAlpha(0x05020E, opacity * 74 / 255));
        drawTiled(context, NOISE_TEXTURE, x + 3, y + 3, width - 6, height - 6, NOISE_SIZE, NOISE_SIZE);
        drawTiled(context, GLINT_TEXTURE, x + 4, y + 3, width - 8, GLINT_HEIGHT, GLINT_WIDTH, GLINT_HEIGHT);

        context.fill(x + 5, y + 4, x + width - 5, y + 5, withAlpha(0xFFFFFF, opacity * 52 / 255));
        context.fill(x + 4, y + 8, x + 5, y + height - 8, withAlpha(accent, opacity * 190 / 255));
        context.fill(x + width - 5, y + 8, x + width - 4, y + height - 8, withAlpha(0xFFFFFF, opacity * 34 / 255));
        drawCornerAccents(context, x, y, width, height, accent, opacity);
    }

    public static void drawInset(
            DrawContext context,
            int x,
            int y,
            int width,
            int height,
            int accent,
            boolean active
    ) {
        cutCornerFill(context, x, y, width, height, active ? withAlpha(accent, 126) : 0x70392B50);
        cutCornerFill(context, x + 1, y + 1, width - 2, height - 2, active ? 0x9A24163C : 0x8A120A21);
        context.fill(x + 3, y + 2, x + width - 3, y + 3, active ? withAlpha(accent, 70) : 0x284F4066);
        context.fill(x + 3, y + height - 3, x + width - 3, y + height - 2, 0x52000000);
    }

    public static void drawBar(
            DrawContext context,
            int x,
            int y,
            int width,
            int height,
            float progress,
            int color,
            int tipColor
    ) {
        int fill = Math.round(width * MathHelper.clamp(progress, 0.0F, 1.0F));
        cutCornerFill(context, x, y, width, height, 0x9A070311);
        cutCornerFill(context, x + 1, y + 1, width - 2, height - 2, 0xA72B1B45);
        if (fill <= 0) {
            return;
        }

        int right = Math.min(x + width - 1, x + Math.max(2, fill));
        context.fill(x + 1, y + 1, right, y + height - 1, withAlpha(color, 170));
        context.fill(x + 1, y + 1, right, y + 3, withAlpha(color, 255));
        context.fill(Math.max(x + 1, right - 2), y + 1, right, y + height - 1, withAlpha(tipColor, 245));
    }

    public static void drawPip(DrawContext context, int centerX, int centerY, int color, boolean active) {
        int outer = active ? withAlpha(color, 126) : 0x5C75668D;
        context.fill(centerX - 2, centerY, centerX + 3, centerY + 1, outer);
        context.fill(centerX - 1, centerY - 1, centerX + 2, centerY + 2, outer);
        if (active) {
            context.fill(centerX, centerY, centerX + 1, centerY + 1, 0xFFFFFFFF);
        }
    }

    public static int withAlpha(int rgb, int alpha) {
        return (MathHelper.clamp(alpha, 0, 255) << 24) | (rgb & 0xFFFFFF);
    }

    public static void cutCornerFill(
            DrawContext context,
            int x,
            int y,
            int width,
            int height,
            int color
    ) {
        if (width <= 0 || height <= 0) {
            return;
        }
        context.fill(x + 2, y, x + width - 2, y + height, color);
        context.fill(x, y + 2, x + width, y + height - 2, color);
        if (width >= 4 && height >= 4) {
            context.fill(x + 1, y + 1, x + width - 1, y + height - 1, color);
        }
    }

    private static void drawCornerAccents(
            DrawContext context,
            int x,
            int y,
            int width,
            int height,
            int accent,
            int alpha
    ) {
        int bright = withAlpha(accent, alpha * 230 / 255);
        int soft = withAlpha(0xFFFFFF, alpha * 88 / 255);
        context.fill(x + 2, y, x + 14, y + 1, bright);
        context.fill(x, y + 2, x + 1, y + 9, bright);
        context.fill(x + width - 14, y + height - 1, x + width - 2, y + height, bright);
        context.fill(x + width - 1, y + height - 9, x + width, y + height - 2, bright);
        context.fill(x + width - 10, y + 1, x + width - 3, y + 2, soft);
    }

    private static void drawTiled(
            DrawContext context,
            Identifier texture,
            int x,
            int y,
            int width,
            int height,
            int textureWidth,
            int textureHeight
    ) {
        for (int offsetY = 0; offsetY < height; offsetY += textureHeight) {
            int tileHeight = Math.min(textureHeight, height - offsetY);
            for (int offsetX = 0; offsetX < width; offsetX += textureWidth) {
                int tileWidth = Math.min(textureWidth, width - offsetX);
                context.drawTexture(
                        TEXTURED,
                        texture,
                        x + offsetX,
                        y + offsetY,
                        0.0F,
                        0.0F,
                        tileWidth,
                        tileHeight,
                        textureWidth,
                        textureHeight
                );
            }
        }
    }
}
