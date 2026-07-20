package de.aetherklang.client.fx;

import de.aetherklang.Aetherklang;
import de.aetherklang.resonance.Stimmung;
import de.aetherklang.resonance.client.ClientResonanceCache;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.util.math.MathHelper;

/**
 * Mood tint, beat flash, and dissonance edge distortion rendered over the world HUD.
 */
public final class MoodVignette {
    private static boolean registered;

    private MoodVignette() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        HudElementRegistry.addLast(Aetherklang.id("mood_vignette"), (context, tickCounter) -> render(context));
    }

    private static void render(DrawContext context) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.player == null || client.world == null || client.currentScreen != null) {
            return;
        }

        int width = client.getWindow().getScaledWidth();
        int height = client.getWindow().getScaledHeight();
        float dissonanz = ClientResonanceCache.getDissonanz();
        float beat = ClientFxController.beatPulse();
        float spike = ClientFxController.dissonanzPulse();
        Stimmung mood = ClientResonanceCache.getMood();
        int primary = FxPalette.primary(mood);
        int secondary = FxPalette.secondary(mood);

        int washAlpha = MathHelper.clamp((int) (3.0F + dissonanz * 11.0F + beat * 5.0F), 0, 22);
        context.fill(0, 0, width, height, FxPalette.withAlpha(primary, washAlpha));

        int edgeDepth = 17;
        int baseAlpha = MathHelper.clamp((int) (13.0F + dissonanz * 72.0F + spike * 42.0F), 8, 112);
        int jitter = spike > 0.08F
                ? Math.round(MathHelper.sin((client.world.getTime() + spike * 13.0F) * 2.4F) * spike * 3.0F)
                : 0;

        for (int band = 0; band < edgeDepth; band++) {
            float fade = 1.0F - band / (float) edgeDepth;
            int alpha = Math.max(1, (int) (baseAlpha * fade * fade));
            int color = FxPalette.withAlpha((band & 3) == 0 ? secondary : primary, alpha);
            context.fill(jitter, band, width + jitter, band + 1, color);
            context.fill(-jitter, height - band - 1, width - jitter, height - band, color);
            context.fill(band, jitter, band + 1, height + jitter, color);
            context.fill(width - band - 1, -jitter, width - band, height - jitter, color);
        }

        if (beat > 0.025F) {
            drawBeatFrame(context, width, height, beat, primary, secondary);
        }
        if (dissonanz > 0.45F) {
            drawDissonanzFractures(context, width, height, dissonanz, spike, client.world.getTime());
        }
    }

    private static void drawBeatFrame(
            DrawContext context,
            int width,
            int height,
            float pulse,
            int primary,
            int secondary
    ) {
        float expansion = 1.0F - pulse;
        int inset = 5 + (int) (expansion * Math.min(width, height) * 0.16F);
        int alpha = MathHelper.clamp((int) (pulse * 155.0F), 0, 155);
        int bright = FxPalette.withAlpha(primary, alpha);
        int echo = FxPalette.withAlpha(secondary, alpha / 2);
        int corner = Math.max(12, Math.min(width, height) / 11);

        context.fill(inset, inset, inset + corner, inset + 2, bright);
        context.fill(inset, inset, inset + 2, inset + corner, bright);
        context.fill(width - inset - corner, inset, width - inset, inset + 2, bright);
        context.fill(width - inset - 2, inset, width - inset, inset + corner, bright);
        context.fill(inset, height - inset - 2, inset + corner, height - inset, bright);
        context.fill(inset, height - inset - corner, inset + 2, height - inset, bright);
        context.fill(width - inset - corner, height - inset - 2, width - inset, height - inset, bright);
        context.fill(width - inset - 2, height - inset - corner, width - inset, height - inset, bright);

        int echoInset = inset + 4;
        context.fill(echoInset, echoInset, width - echoInset, echoInset + 1, echo);
        context.fill(echoInset, height - echoInset - 1, width - echoInset, height - echoInset, echo);
    }

    private static void drawDissonanzFractures(
            DrawContext context,
            int width,
            int height,
            float dissonanz,
            float spike,
            long tick
    ) {
        int fractureAlpha = MathHelper.clamp((int) ((dissonanz - 0.4F) * 80.0F + spike * 90.0F), 5, 80);
        int magenta = FxPalette.withAlpha(FxPalette.MAGENTA, fractureAlpha);
        int indigo = FxPalette.withAlpha(FxPalette.INDIGO, fractureAlpha + 12);
        int seed = (int) (tick * 31L + ClientResonanceCache.getLastBeat() * 17L);

        for (int fracture = 0; fracture < 5; fracture++) {
            int y = Math.floorMod(seed + fracture * 73, Math.max(1, height - 8)) + 4;
            int length = 18 + Math.floorMod(seed * (fracture + 3), Math.max(20, width / 4));
            int offset = Math.floorMod(seed + fracture * 41, Math.max(1, width - length));
            context.fill(0, y, Math.min(width, 5 + length / 4), y + 1, fracture % 2 == 0 ? magenta : indigo);
            context.fill(
                    Math.max(0, width - 5 - length / 3),
                    height - y,
                    width,
                    height - y + 1,
                    fracture % 2 == 0 ? indigo : magenta
            );
            if (spike > 0.16F && fracture < 2) {
                context.fill(offset, y + 2, Math.min(width, offset + length), y + 3, magenta);
            }
        }
    }
}
