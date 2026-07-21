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
    private static final int PANEL_HEIGHT = 34;
    private static final int SLOT_WIDTH = 30;
    private static final long COMPLETION_DISPLAY_NANOS = 2_000_000_000L;
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
        int y = context.getScaledWindowHeight()
                - ResonanceHud.PANEL_HEIGHT
                - 14
                - PANEL_HEIGHT
                - 6;
        int border = completedAkkord == null ? GOLD : CYAN;
        GlassHud.drawPanel(context, x, y, PANEL_WIDTH, PANEL_HEIGHT, border, 218);

        Text title = completedAkkord == null
                ? Text.literal("AKKORD")
                : Text.literal(completedAkkord.displayName());
        GlassHud.drawPip(context, x + 10, y + 10, border, completedAkkord != null);
        context.drawTextWithShadow(client.textRenderer, title, x + 17, y + 6, border);
        if (ensembleSize >= 2) {
            Text ensemble = Text.literal("♫" + ensembleSize);
            int chipWidth = client.textRenderer.getWidth(ensemble) + 7;
            GlassHud.drawInset(
                    context,
                    x + PANEL_WIDTH - chipWidth - 5,
                    y + 5,
                    chipWidth,
                    11,
                    CYAN,
                    true
            );
            context.drawTextWithShadow(
                    client.textRenderer,
                    ensemble,
                    x + PANEL_WIDTH - 8 - client.textRenderer.getWidth(ensemble),
                    y + 6,
                    CYAN
            );
        }

        int slotsX = x + 7;
        int slotsY = y + 20;
        for (int slot = 0; slot < 3; slot++) {
            int slotX = slotsX + slot * (SLOT_WIDTH + 3);
            boolean populated = slot < sequence.size();
            Stimmung mood = populated ? sequence.get(slot) : null;
            drawSlot(context, client, slotX, slotsY, mood, populated);
            if (slot < 2) {
                int connectorX = slotX + SLOT_WIDTH;
                context.fill(
                        connectorX,
                        slotsY + 4,
                        connectorX + 3,
                        slotsY + 5,
                        populated ? GlassHud.withAlpha(border, 150) : 0x5075668D
                );
            }
        }
    }

    private static void drawSlot(
            DrawContext context,
            MinecraftClient client,
            int x,
            int y,
            Stimmung mood,
            boolean populated
    ) {
        int color = mood == null ? MUTED : moodColor(mood);
        GlassHud.drawInset(context, x, y, SLOT_WIDTH, 9, color, populated);
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

}
