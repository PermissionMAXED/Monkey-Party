package de.aetherklang.dirigent.client;

import de.aetherklang.Aetherklang;
import de.aetherklang.client.GlassHud;
import de.aetherklang.client.ResonanceHud;
import de.aetherklang.registry.ModPayloads;
import de.aetherklang.resonance.AkkordEngine;
import de.aetherklang.resonance.Stimmung;
import java.util.Locale;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.text.Text;

/**
 * Displays the conductor's active call and the amplified ensemble resolution.
 */
public final class DirigentHud {
    private static final int PANEL_WIDTH = 176;
    private static final int PANEL_HEIGHT = 31;
    private static final int AKKORD_PANEL_HEIGHT = 34;
    private static final int GOLD = 0xFFF5C95F;
    private static final int CYAN = 0xFF5FF5E0;
    private static final int MAGENTA = 0xFFE03A8C;
    private static final int MUTED = 0xFF75668D;
    private static final long RESOLUTION_DISPLAY_NANOS = 2_500_000_000L;

    private static AkkordEngine.Akkord calledChord;
    private static int ensembleSize;
    private static int amplificationPercent = 100;
    private static long expiresAt;
    private static boolean resolved;
    private static boolean registered;

    private DirigentHud() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;

        HudElementRegistry.addLast(
                Aetherklang.id("dirigent_hud"),
                (drawContext, tickCounter) -> render(drawContext)
        );
        ClientPlayNetworking.registerGlobalReceiver(
                ModPayloads.DirigentSyncPayload.ID,
                (payload, context) -> context.client().execute(() -> receive(payload))
        );
    }

    private static void receive(ModPayloads.DirigentSyncPayload payload) {
        if (payload.akkord() == 0) {
            clear();
            return;
        }
        AkkordEngine.Akkord.fromNetworkId(payload.akkord()).ifPresentOrElse(chord -> {
            calledChord = chord;
            ensembleSize = payload.ensembleSize();
            amplificationPercent = payload.amplificationPercent();
            resolved = payload.resolved();
            long duration = resolved
                    ? RESOLUTION_DISPLAY_NANOS
                    : payload.remainingTicks() * 50_000_000L;
            expiresAt = System.nanoTime() + duration;
        }, DirigentHud::clear);
    }

    private static void render(DrawContext context) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.player == null || client.options.hudHidden || calledChord == null) {
            return;
        }
        if (System.nanoTime() >= expiresAt) {
            clear();
            return;
        }

        int x = 12;
        int y = context.getScaledWindowHeight()
                - ResonanceHud.PANEL_HEIGHT
                - 14
                - AKKORD_PANEL_HEIGHT
                - PANEL_HEIGHT
                - 12;
        int accent = resolved ? CYAN : GOLD;
        GlassHud.drawPanel(context, x, y, PANEL_WIDTH, PANEL_HEIGHT, accent, 224);
        GlassHud.drawPip(context, x + 9, y + 10, accent, resolved);

        Text title = Text.translatable(
                resolved
                        ? "hud.aetherklang.dirigent.resolved"
                        : "hud.aetherklang.dirigent.called",
                calledChord.displayName()
        );
        context.drawTextWithShadow(client.textRenderer, title, x + 16, y + 5, accent);

        String multiplier = "×" + String.format(
                Locale.ROOT,
                "%.2f",
                amplificationPercent / 100.0F
        );
        Text status = Text.literal("♫" + ensembleSize + "  " + multiplier);
        context.drawTextWithShadow(
                client.textRenderer,
                status,
                x + PANEL_WIDTH - client.textRenderer.getWidth(status) - 7,
                y + 18,
                resolved ? CYAN : GOLD
        );

        int slotX = x + 8;
        for (Stimmung mood : calledChord.sequence()) {
            drawMoodSlot(context, client, slotX, y + 18, mood);
            slotX += 19;
        }
    }

    private static void drawMoodSlot(
            DrawContext context,
            MinecraftClient client,
            int x,
            int y,
            Stimmung mood
    ) {
        int color = moodColor(mood);
        GlassHud.drawInset(context, x, y, 16, 9, color, true);
        context.drawTextWithShadow(
                client.textRenderer,
                Text.literal(mood.name().substring(0, 1)),
                x + 5,
                y,
                color
        );
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

    private static void clear() {
        calledChord = null;
        ensembleSize = 0;
        amplificationPercent = 100;
        expiresAt = 0L;
        resolved = false;
    }
}
