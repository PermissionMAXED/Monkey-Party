package de.aetherklang.client;

import de.aetherklang.Aetherklang;
import de.aetherklang.resonance.RangService;
import de.aetherklang.resonance.client.ClientResonanceCache;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.text.Text;

/**
 * Compact, text-backed rank sigil attached above the resonance panel.
 */
public final class RangHud {
    private static final int WIDTH = 116;
    private static final int HEIGHT = 26;
    private static final int GOLD = 0xFFF5C95F;
    private static final int MUTED = 0xFFB9A9D0;

    private RangHud() {
    }

    public static void register() {
        HudElementRegistry.addLast(
                Aetherklang.id("rang_hud"),
                (context, tickCounter) -> render(context)
        );
    }

    private static void render(DrawContext context) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.player == null || client.options.hudHidden) {
            return;
        }

        int x = 159;
        int y = context.getScaledWindowHeight()
                - ResonanceHud.PANEL_HEIGHT
                - 14
                - 34
                - 6;
        RangService.Rang rang = ClientResonanceCache.getRang();
        int accent = accent(rang);

        GlassHud.drawPanel(context, x, y, WIDTH, HEIGHT, accent, 218);
        GlassHud.drawInset(context, x + 6, y + 4, 21, 18, accent, true);

        drawSigil(context, x + 16, y + 13, rang, accent);
        context.drawTextWithShadow(
                client.textRenderer,
                Text.translatable(rang.getTranslationKey()),
                x + 29,
                y + 3,
                accent
        );
        context.drawTextWithShadow(
                client.textRenderer,
                Text.literal("ΣRP " + ClientResonanceCache.getGesamtRp()),
                x + 29,
                y + 14,
                MUTED
        );
    }

    private static void drawSigil(
            DrawContext context,
            int centerX,
            int centerY,
            RangService.Rang rang,
            int color
    ) {
        drawDiamond(context, centerX, centerY, 7, 0xA8261745);
        drawDiamondOutline(context, centerX, centerY, 6, color);
        drawDiamond(context, centerX, centerY, 2, GOLD);

        int marks = rang.ordinal();
        if (marks >= 1) {
            context.fill(centerX - 8, centerY, centerX - 6, centerY + 1, color);
            context.fill(centerX + 7, centerY, centerX + 9, centerY + 1, color);
        }
        if (marks >= 2) {
            context.fill(centerX, centerY - 8, centerX + 1, centerY - 6, color);
            context.fill(centerX, centerY + 7, centerX + 1, centerY + 9, color);
        }
        if (marks >= 3) {
            context.fill(centerX - 6, centerY - 6, centerX - 4, centerY - 4, GOLD);
            context.fill(centerX + 5, centerY - 6, centerX + 7, centerY - 4, GOLD);
        }
        if (marks >= 4) {
            context.fill(centerX - 6, centerY + 5, centerX - 4, centerY + 7, GOLD);
            context.fill(centerX + 5, centerY + 5, centerX + 7, centerY + 7, GOLD);
        }
        if (marks >= 5) {
            context.fill(centerX - 5, centerY - 1, centerX + 6, centerY + 2, color);
        }
        if (marks >= 6) {
            drawDiamondOutline(context, centerX, centerY, 9, GOLD);
        }
    }

    private static void drawDiamond(DrawContext context, int centerX, int centerY, int radius, int color) {
        for (int y = -radius; y <= radius; y++) {
            int halfWidth = radius - Math.abs(y);
            context.fill(centerX - halfWidth, centerY + y, centerX + halfWidth + 1, centerY + y + 1, color);
        }
    }

    private static void drawDiamondOutline(
            DrawContext context,
            int centerX,
            int centerY,
            int radius,
            int color
    ) {
        for (int y = -radius; y <= radius; y++) {
            int halfWidth = radius - Math.abs(y);
            context.fill(centerX - halfWidth, centerY + y, centerX - halfWidth + 1, centerY + y + 1, color);
            context.fill(centerX + halfWidth, centerY + y, centerX + halfWidth + 1, centerY + y + 1, color);
        }
    }

    private static int accent(RangService.Rang rang) {
        return switch (rang) {
            case NOVIZE -> 0xFFC5ABFF;
            case ADEPT -> 0xFF5FF5E0;
            case VIRTUOSE -> GOLD;
            case MAESTRO -> 0xFFFF77C8;
            case KOMPONIST -> 0xFF9A8CFF;
            case DIRIGENT -> 0xFF72D6FF;
            case KLANGMEISTER -> 0xFFFFFFFF;
        };
    }

}
