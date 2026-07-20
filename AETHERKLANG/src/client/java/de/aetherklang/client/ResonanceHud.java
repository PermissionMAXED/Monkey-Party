package de.aetherklang.client;

import de.aetherklang.Aetherklang;
import de.aetherklang.crescendo.ArmorHooks;
import de.aetherklang.resonance.BeatEngine;
import de.aetherklang.resonance.Stimmung;
import de.aetherklang.resonance.client.ClientResonanceCache;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.text.Text;
import net.minecraft.util.math.ColorHelper;

public final class ResonanceHud {
    private static final int PANEL_WIDTH = 194;
    private static final int PANEL_HEIGHT = 58;
    private static final int INDIGO = 0xE61A1033;
    private static final int DEEP_INDIGO = 0xF20D071D;
    private static final int CYAN = 0xFF5FF5E0;
    private static final int CYAN_DARK = 0xFF237E86;
    private static final int GOLD = 0xFFF5C95F;
    private static final int MAGENTA = 0xFFE03A8C;
    private static final int PAPER = 0xFFF4EEFF;
    private static final int MUTED = 0xFFB9A9D0;
    private static final long BEAT_PERIOD_NANOS = 500_000_000L;

    private static int observedBeat = Integer.MIN_VALUE;
    private static long beatAnchorNanos;

    private ResonanceHud() {
    }

    public static void register() {
        HudElementRegistry.addLast(
                Aetherklang.id("resonance_hud"),
                (drawContext, tickCounter) -> render(drawContext)
        );
    }

    private static void render(DrawContext context) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.player == null || client.options.hudHidden) {
            return;
        }

        int x = 12;
        int y = context.getScaledWindowHeight() - PANEL_HEIGHT - 14;
        Stimmung mood = ClientResonanceCache.getMood();
        int moodColor = moodColor(mood);
        int rp = ClientResonanceCache.getRp();
        int rpCap = ArmorHooks.getRpCap(client.player);
        float dissonanz = ClientResonanceCache.getDissonanz();
        float phase = currentBeatPhase();
        float beatDistance = Math.min(phase, 1.0F - phase);
        boolean onBeat = beatDistance <= BeatEngine.PERFECT_WINDOW;
        float pulse = onBeat ? 1.0F - beatDistance / BeatEngine.PERFECT_WINDOW : 0.0F;

        drawPanel(context, x, y);
        drawMood(context, client, x, y, mood, moodColor);
        drawRp(context, client, x, y, rp, rpCap);
        drawBeat(context, client, x, y, phase, pulse);
        drawDissonanz(context, client, x, y, dissonanz);
    }

    private static void drawPanel(DrawContext context, int x, int y) {
        cutCornerFill(context, x + 2, y + 3, PANEL_WIDTH, PANEL_HEIGHT, 0x70000000);
        cutCornerFill(context, x, y, PANEL_WIDTH, PANEL_HEIGHT, 0xD0F5C95F);
        cutCornerFill(context, x + 1, y + 1, PANEL_WIDTH - 2, PANEL_HEIGHT - 2, INDIGO);
        context.fill(x + 5, y + 5, x + PANEL_WIDTH - 5, y + PANEL_HEIGHT - 5, DEEP_INDIGO);
        context.fill(x + 5, y + 5, x + PANEL_WIDTH - 5, y + 6, 0xA05FF5E0);
        context.fill(x + 5, y + 6, x + 37, y + 7, GOLD);
        context.fill(x + PANEL_WIDTH - 18, y + PANEL_HEIGHT - 6, x + PANEL_WIDTH - 5, y + PANEL_HEIGHT - 5, GOLD);
    }

    private static void drawMood(
            DrawContext context,
            MinecraftClient client,
            int x,
            int y,
            Stimmung mood,
            int moodColor
    ) {
        int iconX = x + 9;
        int iconY = y + 12;
        context.fill(iconX, iconY, iconX + 27, iconY + 27, 0x802E1B52);
        context.fill(iconX + 1, iconY + 1, iconX + 26, iconY + 26, 0xC0140A28);
        drawMoodIcon(context, mood, iconX + 7, iconY + 6, moodColor);

        context.drawTextWithShadow(
                client.textRenderer,
                Text.translatable(mood.getTranslationKey()),
                x + 43,
                y + 8,
                moodColor
        );
    }

    private static void drawRp(
            DrawContext context,
            MinecraftClient client,
            int x,
            int y,
            int rp,
            int rpCap
    ) {
        int barX = x + 43;
        int barY = y + 22;
        int barWidth = 111;
        int fill = Math.round(barWidth * rp / (float) rpCap);
        context.drawTextWithShadow(client.textRenderer, Text.literal("RP"), barX, barY - 1, PAPER);
        Text amount = Text.literal(rp + " / " + rpCap);
        context.drawTextWithShadow(
                client.textRenderer,
                amount,
                barX + barWidth - client.textRenderer.getWidth(amount),
                barY - 1,
                MUTED
        );
        barY += 10;
        context.fill(barX, barY, barX + barWidth, barY + 7, 0xFF080413);
        context.fill(barX + 1, barY + 1, barX + barWidth - 1, barY + 6, 0xFF261745);
        if (fill > 0) {
            context.fill(barX + 1, barY + 1, barX + fill, barY + 6, CYAN_DARK);
            context.fill(barX + 1, barY + 1, barX + fill, barY + 3, CYAN);
            context.fill(barX + Math.max(1, fill - 1), barY + 1, barX + fill, barY + 6, GOLD);
        }
    }

    private static void drawBeat(
            DrawContext context,
            MinecraftClient client,
            int x,
            int y,
            float phase,
            float pulse
    ) {
        int centerX = x + 173;
        int top = y + 10;
        int pulseAlpha = Math.round(95 + pulse * 160.0F);
        int beatColor = ColorHelper.withAlpha(pulseAlpha, GOLD);

        if (pulse > 0.0F) {
            int radius = pulse > 0.55F ? 12 : 11;
            context.fill(centerX - radius, top - 3, centerX + radius + 1, top - 2, beatColor);
            context.fill(centerX - radius, top + 20, centerX + radius + 1, top + 21, beatColor);
            context.fill(centerX - radius, top - 2, centerX - radius + 1, top + 20, beatColor);
            context.fill(centerX + radius, top - 2, centerX + radius + 1, top + 20, beatColor);
        }

        context.fill(centerX - 8, top + 17, centerX + 9, top + 19, 0xFF6D568A);
        context.fill(centerX - 5, top + 15, centerX + 6, top + 17, 0xFFB99B55);
        context.fill(centerX - 4, top + 3, centerX - 3, top + 15, 0xA0F5C95F);
        context.fill(centerX + 3, top + 3, centerX + 4, top + 15, 0xA0F5C95F);

        float swing = (float) Math.sin(phase * Math.PI * 2.0D);
        int pendulumX = centerX + Math.round(swing * 7.0F);
        drawLine(context, centerX, top + 3, pendulumX, top + 13, beatColor);
        context.fill(pendulumX - 1, top + 12, pendulumX + 2, top + 15, beatColor);
        context.drawCenteredTextWithShadow(
                client.textRenderer,
                Text.literal(pulse > 0.0F ? "TAKT" : "· · ·"),
                centerX,
                y + 40,
                pulse > 0.0F ? GOLD : MUTED
        );
    }

    private static void drawDissonanz(
            DrawContext context,
            MinecraftClient client,
            int x,
            int y,
            float dissonanz
    ) {
        int meterX = x + 43;
        int meterY = y + 45;
        int meterWidth = 111;
        int fill = Math.round(meterWidth * dissonanz);
        context.drawTextWithShadow(client.textRenderer, Text.literal("DIS"), meterX, meterY - 2, MUTED);
        int trackX = meterX + 22;
        int trackWidth = meterWidth - 22;
        context.fill(trackX, meterY, trackX + trackWidth, meterY + 4, 0xFF261745);
        int dissonanzFill = Math.round(trackWidth * dissonanz);
        if (dissonanzFill > 0) {
            context.fill(trackX, meterY, trackX + dissonanzFill, meterY + 4, MAGENTA);
            context.fill(trackX, meterY, trackX + dissonanzFill, meterY + 1, 0xFFF59AC7);
        }

        Text amount = Text.literal(Math.round(dissonanz * 100.0F) + "%");
        context.drawTextWithShadow(
                client.textRenderer,
                amount,
                meterX + meterWidth - client.textRenderer.getWidth(amount),
                meterY - 2,
                fill >= 78 ? MAGENTA : MUTED
        );
    }

    private static float currentBeatPhase() {
        long now = System.nanoTime();
        int beat = ClientResonanceCache.getLastBeat();
        if (beatAnchorNanos == 0L || beat != observedBeat) {
            observedBeat = beat;
            beatAnchorNanos = now - (long) (ClientResonanceCache.getBeatPhase() * BEAT_PERIOD_NANOS);
        }
        return (float) Math.floorMod(now - beatAnchorNanos, BEAT_PERIOD_NANOS) / BEAT_PERIOD_NANOS;
    }

    private static int moodColor(Stimmung mood) {
        return switch (mood) {
            case STILLE -> 0xFFC5ABFF;
            case FREUDE -> GOLD;
            case ZORN -> MAGENTA;
            case TRAUER -> 0xFF70B8FF;
            case WUNDER -> CYAN;
        };
    }

    private static void drawMoodIcon(DrawContext context, Stimmung mood, int x, int y, int color) {
        switch (mood) {
            case STILLE -> {
                context.fill(x + 1, y + 4, x + 12, y + 6, color);
                context.fill(x + 3, y + 8, x + 10, y + 10, color);
                context.fill(x + 5, y + 12, x + 8, y + 14, color);
            }
            case FREUDE -> {
                context.fill(x + 4, y + 4, x + 10, y + 10, color);
                context.fill(x + 6, y, x + 8, y + 14, color);
                context.fill(x, y + 6, x + 14, y + 8, color);
                context.fill(x + 2, y + 2, x + 4, y + 4, color);
                context.fill(x + 10, y + 10, x + 12, y + 12, color);
            }
            case ZORN -> {
                context.fill(x + 7, y, x + 12, y + 3, color);
                context.fill(x + 5, y + 3, x + 10, y + 7, color);
                context.fill(x + 3, y + 7, x + 8, y + 10, color);
                context.fill(x + 1, y + 10, x + 6, y + 14, color);
            }
            case TRAUER -> {
                context.fill(x + 6, y, x + 8, y + 3, color);
                context.fill(x + 4, y + 3, x + 10, y + 7, color);
                context.fill(x + 2, y + 7, x + 12, y + 11, color);
                context.fill(x + 4, y + 11, x + 10, y + 14, color);
            }
            case WUNDER -> {
                context.fill(x + 6, y, x + 8, y + 14, color);
                context.fill(x, y + 6, x + 14, y + 8, color);
                context.fill(x + 3, y + 3, x + 5, y + 5, color);
                context.fill(x + 9, y + 9, x + 11, y + 11, color);
            }
        }
    }

    private static void cutCornerFill(DrawContext context, int x, int y, int width, int height, int color) {
        context.fill(x + 2, y, x + width - 2, y + height, color);
        context.fill(x, y + 2, x + width, y + height - 2, color);
    }

    private static void drawLine(DrawContext context, int x0, int y0, int x1, int y1, int color) {
        int dx = Math.abs(x1 - x0);
        int direction = x0 < x1 ? 1 : -1;
        int dy = -Math.abs(y1 - y0);
        int verticalDirection = y0 < y1 ? 1 : -1;
        int error = dx + dy;
        while (true) {
            context.fill(x0, y0, x0 + 1, y0 + 1, color);
            if (x0 == x1 && y0 == y1) {
                return;
            }
            int doubledError = error * 2;
            if (doubledError >= dy) {
                error += dy;
                x0 += direction;
            }
            if (doubledError <= dx) {
                error += dx;
                y0 += verticalDirection;
            }
        }
    }
}
