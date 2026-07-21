package de.aetherklang.kanon.client;

import de.aetherklang.Aetherklang;
import de.aetherklang.client.GlassHud;
import de.aetherklang.kanon.KanonAction;
import de.aetherklang.kanon.KanonEngine;
import de.aetherklang.kanon.KanonNote;
import de.aetherklang.kanon.KanonPayloads;
import de.aetherklang.resonance.Stimmung;
import java.util.List;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.text.Text;

/**
 * Compact four-slot call-and-response strip.
 */
public final class KanonHud {
    private static final int PANEL_WIDTH = 248;
    private static final int PANEL_HEIGHT = 47;
    private static final int SLOT_WIDTH = 54;
    private static final int SLOT_GAP = 4;
    private static final int GOLD = 0xFFF5C95F;
    private static final int CYAN = 0xFF5FF5E0;
    private static final int MAGENTA = 0xFFE03A8C;
    private static final int MUTED = 0xFF75668D;
    private static final long RESULT_DISPLAY_NANOS = 2_750_000_000L;

    private static List<KanonNote> phrase = List.of();
    private static int phase;
    private static int progress;
    private static int revealed;
    private static int ticksUntilNote;
    private static boolean duel;
    private static String counterpart = "";
    private static long receivedAtNanos;
    private static long resultExpiresAt;
    private static boolean registered;

    private KanonHud() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        HudElementRegistry.addLast(
                Aetherklang.id("kanon_hud"),
                (context, tickCounter) -> render(context)
        );
        ClientPlayNetworking.registerGlobalReceiver(
                KanonPayloads.KanonSyncPayload.ID,
                (payload, context) -> context.client().execute(() -> receive(payload))
        );
    }

    private static void receive(KanonPayloads.KanonSyncPayload payload) {
        if (payload.phase() == 0) {
            clear();
            return;
        }
        phrase = payload.decodedNotes();
        phase = payload.phase();
        progress = payload.progress();
        revealed = payload.revealed();
        ticksUntilNote = payload.ticksUntilNote();
        duel = payload.duel();
        counterpart = payload.counterpart();
        receivedAtNanos = System.nanoTime();
        resultExpiresAt = phase >= KanonEngine.Phase.SUCCESS.networkId()
                ? receivedAtNanos + RESULT_DISPLAY_NANOS
                : 0L;
    }

    private static void render(DrawContext context) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.player == null || client.options.hudHidden || phrase.size() != KanonEngine.PHRASE_LENGTH) {
            return;
        }
        if (resultExpiresAt != 0L && System.nanoTime() >= resultExpiresAt) {
            clear();
            return;
        }

        int x = (context.getScaledWindowWidth() - PANEL_WIDTH) / 2;
        int y = 12;
        int accent = phaseColor();
        GlassHud.drawPanel(context, x, y, PANEL_WIDTH, PANEL_HEIGHT, accent, 228);
        GlassHud.drawPip(context, x + 9, y + 10, accent, phase >= KanonEngine.Phase.SUCCESS.networkId());

        Text title = Text.translatable(phaseTranslationKey());
        if (duel && !counterpart.isBlank()) {
            title = Text.translatable("hud.aetherklang.kanon.duel", counterpart, title);
        }
        context.drawTextWithShadow(client.textRenderer, title, x + 16, y + 5, accent);

        int slotsX = x + 8;
        int slotsY = y + 20;
        for (int index = 0; index < KanonEngine.PHRASE_LENGTH; index++) {
            int slotX = slotsX + index * (SLOT_WIDTH + SLOT_GAP);
            boolean visible = phase != KanonEngine.Phase.CALL.networkId() || index < revealed;
            boolean completed = phase == KanonEngine.Phase.RESPONSE.networkId() && index < progress;
            boolean active = (phase == KanonEngine.Phase.CALL.networkId() && index == revealed - 1)
                    || (phase == KanonEngine.Phase.RESPONSE.networkId() && index == progress);
            drawSlot(context, client, slotX, slotsY, index, visible, completed, active);
        }
    }

    private static void drawSlot(
            DrawContext context,
            MinecraftClient client,
            int x,
            int y,
            int index,
            boolean visible,
            boolean completed,
            boolean active
    ) {
        KanonNote note = phrase.get(index);
        int color = visible ? moodColor(note.mood()) : MUTED;
        if (completed) {
            color = CYAN;
        }
        GlassHud.drawInset(context, x, y, SLOT_WIDTH, 19, color, visible);
        if (active) {
            context.fill(x + 1, y + 17, x + SLOT_WIDTH - 1, y + 19, color);
            drawCountdown(context, x + 2, y + 15, SLOT_WIDTH - 4, color);
        }

        Text mood = visible
                ? Text.literal(note.mood().name().substring(0, 1))
                : Text.literal("?");
        context.drawTextWithShadow(client.textRenderer, mood, x + 5, y + 5, color);
        if (visible) {
            Text action = shortAction(note.action());
            context.drawTextWithShadow(
                    client.textRenderer,
                    action,
                    x + SLOT_WIDTH - client.textRenderer.getWidth(action) - 5,
                    y + 5,
                    color
            );
        }
    }

    private static void drawCountdown(DrawContext context, int x, int y, int width, int color) {
        if (ticksUntilNote <= 0) {
            return;
        }
        long elapsedTicks = (System.nanoTime() - receivedAtNanos) / 50_000_000L;
        float remaining = Math.clamp(
                (ticksUntilNote - elapsedTicks) / (float) Math.max(1, ticksUntilNote),
                0.0F,
                1.0F
        );
        context.fill(x, y, x + Math.round(width * remaining), y + 1, GlassHud.withAlpha(color, 190));
    }

    private static Text shortAction(KanonAction action) {
        return switch (action) {
            case RESONATE -> Text.literal("♪");
            case STRIKE -> Text.literal("×");
            case STIMMGABEL -> Text.literal("Y");
        };
    }

    private static String phaseTranslationKey() {
        return switch (phase) {
            case 1 -> "hud.aetherklang.kanon.call";
            case 2 -> "hud.aetherklang.kanon.response";
            case 3 -> "hud.aetherklang.kanon.success";
            default -> "hud.aetherklang.kanon.failure";
        };
    }

    private static int phaseColor() {
        return switch (phase) {
            case 2, 3 -> CYAN;
            case 4 -> MAGENTA;
            default -> GOLD;
        };
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
        phrase = List.of();
        phase = 0;
        progress = 0;
        revealed = 0;
        ticksUntilNote = 0;
        duel = false;
        counterpart = "";
        receivedAtNanos = 0L;
        resultExpiresAt = 0L;
    }
}
