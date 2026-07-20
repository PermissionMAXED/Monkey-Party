package de.aetherklang.client;

import de.aetherklang.Aetherklang;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModPayloads;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.resonance.AkkordEngine;
import de.aetherklang.resonance.Stimmung;
import java.util.List;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.text.Text;

/**
 * Additive HUD layer for the three-note Akkord sequence and ensemble state.
 */
public final class AkkordHud {
    private static final int PANEL_WIDTH = 142;
    private static final int PANEL_HEIGHT = 31;
    private static final int SLOT_WIDTH = 30;
    private static final long COMPLETION_DISPLAY_NANOS = 2_000_000_000L;
    private static final int INDIGO = 0xE61A1033;
    private static final int DEEP_INDIGO = 0xF20D071D;
    private static final int GOLD = 0xFFF5C95F;
    private static final int CYAN = 0xFF5FF5E0;
    private static final int MAGENTA = 0xFFE03A8C;
    private static final int MUTED = 0xFF75668D;

    private static List<Stimmung> sequence = List.of();
    private static AkkordEngine.Akkord completedAkkord;
    private static long completionExpiresAt;
    private static int ensembleSize;
    private static boolean registered;

    private AkkordHud() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;

        HudElementRegistry.addLast(
                Aetherklang.id("akkord_hud"),
                (drawContext, tickCounter) -> render(drawContext)
        );
        ClientPlayNetworking.registerGlobalReceiver(
                ModPayloads.AkkordFxPayload.ID,
                (payload, context) -> context.client().execute(() -> receiveAkkord(payload.akkord()))
        );
        ClientPlayNetworking.registerGlobalReceiver(
                ModPayloads.EnsembleSyncPayload.ID,
                (payload, context) -> context.client().execute(
                        () -> receiveEnsemble(context.client(), payload.ensembleSize())
                )
        );
    }

    private static void receiveAkkord(int payload) {
        if ((payload & AkkordEngine.SEQUENCE_PAYLOAD_FLAG) != 0) {
            sequence = AkkordEngine.decodeSequence(payload);
            completedAkkord = null;
            completionExpiresAt = 0L;
            return;
        }

        AkkordEngine.Akkord.fromNetworkId(payload).ifPresent(akkord -> {
            completedAkkord = akkord;
            completionExpiresAt = System.nanoTime() + COMPLETION_DISPLAY_NANOS;
        });
    }

    private static void receiveEnsemble(MinecraftClient client, int newSize) {
        int clampedSize = Math.max(0, newSize);
        if (clampedSize >= 2 && ensembleSize < 2 && client.player != null) {
            client.player.playSound(ModSounds.ENSEMBLE_CHIME, 0.55F, 1.2F);
            spawnEnsembleBurst(client.world, client.player);
        }
        ensembleSize = clampedSize;
    }

    private static void render(DrawContext context) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client.player == null || client.options.hudHidden) {
            return;
        }
        if (completedAkkord != null && System.nanoTime() >= completionExpiresAt) {
            completedAkkord = null;
            sequence = List.of();
        }

        int x = 12;
        int y = context.getScaledWindowHeight() - 58 - 14 - PANEL_HEIGHT - 5;
        int border = completedAkkord == null ? GOLD : CYAN;
        cutCornerFill(context, x + 2, y + 2, PANEL_WIDTH, PANEL_HEIGHT, 0x70000000);
        cutCornerFill(context, x, y, PANEL_WIDTH, PANEL_HEIGHT, border);
        cutCornerFill(context, x + 1, y + 1, PANEL_WIDTH - 2, PANEL_HEIGHT - 2, INDIGO);
        context.fill(x + 4, y + 4, x + PANEL_WIDTH - 4, y + PANEL_HEIGHT - 4, DEEP_INDIGO);

        Text title = completedAkkord == null
                ? Text.literal("AKKORD")
                : Text.literal(completedAkkord.displayName());
        context.drawTextWithShadow(client.textRenderer, title, x + 7, y + 5, border);
        if (ensembleSize >= 2) {
            Text ensemble = Text.literal("♫" + ensembleSize);
            context.drawTextWithShadow(
                    client.textRenderer,
                    ensemble,
                    x + PANEL_WIDTH - 7 - client.textRenderer.getWidth(ensemble),
                    y + 5,
                    CYAN
            );
        }

        int slotsX = x + 7;
        int slotsY = y + 17;
        for (int slot = 0; slot < 3; slot++) {
            int slotX = slotsX + slot * (SLOT_WIDTH + 3);
            Stimmung mood = slot < sequence.size() ? sequence.get(slot) : null;
            drawSlot(context, client, slotX, slotsY, mood);
        }
    }

    private static void drawSlot(
            DrawContext context,
            MinecraftClient client,
            int x,
            int y,
            Stimmung mood
    ) {
        int color = mood == null ? MUTED : moodColor(mood);
        context.fill(x, y, x + SLOT_WIDTH, y + 9, 0xFF090416);
        context.fill(x + 1, y + 1, x + SLOT_WIDTH - 1, y + 8, mood == null ? 0xFF211538 : 0xFF30204B);
        context.fill(x + 3, y + 5, x + 8, y + 8, color);
        context.fill(x + 7, y + 1, x + 9, y + 7, color);
        if (mood != null) {
            context.drawTextWithShadow(
                    client.textRenderer,
                    Text.literal(mood.name().substring(0, 1)),
                    x + 14,
                    y,
                    color
            );
        }
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

    private static void spawnEnsembleBurst(ClientWorld world, ClientPlayerEntity player) {
        if (world == null) {
            return;
        }
        for (int spark = 0; spark < 16; spark++) {
            double angle = spark * Math.PI * 2.0D / 16.0D;
            world.addParticleClient(
                    ModParticles.ENSEMBLE_FUNKE,
                    player.getX() + Math.cos(angle) * 0.8D,
                    player.getBodyY(0.5D),
                    player.getZ() + Math.sin(angle) * 0.8D,
                    Math.cos(angle) * 0.035D,
                    0.045D,
                    Math.sin(angle) * 0.035D
            );
        }
    }

    private static void cutCornerFill(
            DrawContext context,
            int x,
            int y,
            int width,
            int height,
            int color
    ) {
        context.fill(x + 2, y, x + width - 2, y + height, color);
        context.fill(x, y + 2, x + width, y + height - 2, color);
    }
}
