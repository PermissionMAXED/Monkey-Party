package de.aetherklang.client.photo;

import de.aetherklang.Aetherklang;
import de.aetherklang.client.fx.FxBudget;
import de.aetherklang.client.fx.FxPalette;
import de.aetherklang.resonance.client.ClientResonanceCache;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.text.Text;
import net.minecraft.util.math.MathHelper;

/**
 * Mood-reactive resonance viewfinder that can be layered over normal play or photo mode.
 */
public final class Resonanzlinse {
    private static final int RING_SEGMENTS = 64;

    private static boolean registered;
    private static boolean active;

    private Resonanzlinse() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            if (client.player == null || client.world == null) {
                active = false;
            }
        });
        HudElementRegistry.addLast(Aetherklang.id("resonance_lens"), (context, tickCounter) -> render(context));
    }

    public static void toggle(MinecraftClient client) {
        if (client.player == null || client.world == null) {
            return;
        }
        active = !active;
        client.player.sendMessage(
                Text.translatable(active
                        ? "message.aetherklang.resonance_lens.enabled"
                        : "message.aetherklang.resonance_lens.disabled"),
                true
        );
    }

    public static boolean isActive() {
        return active;
    }

    private static void render(DrawContext context) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (!active || client.player == null || client.world == null || client.currentScreen != null) {
            return;
        }

        int width = context.getScaledWindowWidth();
        int height = context.getScaledWindowHeight();
        int primary = FxPalette.primary(ClientResonanceCache.getMood());
        int secondary = FxPalette.secondary(ClientResonanceCache.getMood());
        float dissonanz = ClientResonanceCache.getDissonanz();
        float pulse = 0.5F + MathHelper.sin(client.world.getTime() * 0.11F) * 0.5F;

        int vignetteBudget = FxBudget.claimScreen(37, FxBudget.Priority.CRITICAL);
        if (vignetteBudget > 0) {
            int washAlpha = MathHelper.clamp(Math.round(9.0F + pulse * 5.0F + dissonanz * 12.0F), 0, 28);
            context.fill(0, 0, width, height, FxPalette.withAlpha(primary, washAlpha));
            vignetteBudget--;
            drawVignette(context, width, height, primary, secondary, vignetteBudget);
        }
        drawReticle(context, width, height, primary, secondary, pulse);
    }

    private static void drawVignette(
            DrawContext context,
            int width,
            int height,
            int primary,
            int secondary,
            int budget
    ) {
        int depth = Math.min(9, budget / 4);
        for (int band = 0; band < depth; band++) {
            int alpha = 46 - band * 4;
            int color = FxPalette.withAlpha((band & 1) == 0 ? primary : secondary, alpha);
            context.fill(0, band, width, band + 1, color);
            context.fill(0, height - band - 1, width, height - band, color);
            context.fill(band, band + 1, band + 1, height - band - 1, color);
            context.fill(width - band - 1, band + 1, width - band, height - band - 1, color);
        }
    }

    private static void drawReticle(
            DrawContext context,
            int width,
            int height,
            int primary,
            int secondary,
            float pulse
    ) {
        int budget = FxBudget.claimScreen(RING_SEGMENTS + 12, FxBudget.Priority.CRITICAL);
        if (budget < 12) {
            return;
        }

        int centerX = width / 2;
        int centerY = height / 2;
        float radius = Math.min(width, height) * (0.195F + pulse * 0.006F);
        int ringAlpha = Math.round(82.0F + pulse * 38.0F);
        int segments = Math.min(RING_SEGMENTS, budget - 12);
        for (int segment = 0; segment < segments; segment++) {
            double angle = segment * Math.PI * 2.0D / RING_SEGMENTS;
            int x = centerX + Math.round((float) Math.cos(angle) * radius);
            int y = centerY + Math.round((float) Math.sin(angle) * radius);
            int color = FxPalette.withAlpha((segment & 7) == 0 ? secondary : primary, ringAlpha);
            int size = (segment & 7) == 0 ? 2 : 1;
            context.fill(x, y, x + size, y + size, color);
        }

        int bracket = Math.max(9, Math.round(radius * 0.18F));
        int gap = 5;
        int bright = FxPalette.withAlpha(primary, 164);
        int accent = FxPalette.withAlpha(secondary, 132);
        context.fill(centerX - bracket, centerY - gap, centerX - gap, centerY - gap + 1, bright);
        context.fill(centerX + gap, centerY - gap, centerX + bracket, centerY - gap + 1, bright);
        context.fill(centerX - bracket, centerY + gap, centerX - gap, centerY + gap + 1, bright);
        context.fill(centerX + gap, centerY + gap, centerX + bracket, centerY + gap + 1, bright);
        context.fill(centerX - gap, centerY - bracket, centerX - gap + 1, centerY - gap, accent);
        context.fill(centerX - gap, centerY + gap, centerX - gap + 1, centerY + bracket, accent);
        context.fill(centerX + gap, centerY - bracket, centerX + gap + 1, centerY - gap, accent);
        context.fill(centerX + gap, centerY + gap, centerX + gap + 1, centerY + bracket, accent);
        context.fill(centerX - 1, centerY, centerX + 2, centerY + 1, 0xD8FFFFFF);
        context.fill(centerX, centerY - 1, centerX + 1, centerY + 2, 0xD8FFFFFF);
        context.fill(centerX - 2, centerY - 2, centerX - 1, centerY - 1, accent);
        context.fill(centerX + 2, centerY + 2, centerX + 3, centerY + 3, accent);
    }
}
