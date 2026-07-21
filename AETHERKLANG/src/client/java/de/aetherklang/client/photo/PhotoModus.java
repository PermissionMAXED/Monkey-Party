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
 * Client-only cinematic camera mode with a clean HUD and lightweight film treatment.
 */
public final class PhotoModus {
    private static final int GRAIN_SAMPLES = 88;

    private static boolean registered;
    private static boolean active;
    private static boolean previousHudHidden;

    private PhotoModus() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        ClientTickEvents.END_CLIENT_TICK.register(PhotoModus::tick);
        HudElementRegistry.addLast(Aetherklang.id("photo_mode"), (context, tickCounter) -> render(context));
    }

    public static void toggle(MinecraftClient client) {
        if (client.player == null || client.world == null) {
            return;
        }

        if (active) {
            deactivate(client);
        } else {
            previousHudHidden = client.options.hudHidden;
            client.options.hudHidden = true;
            active = true;
        }
        client.player.sendMessage(
                Text.translatable(active
                        ? "message.aetherklang.photo_mode.enabled"
                        : "message.aetherklang.photo_mode.disabled"),
                true
        );
    }

    public static boolean isActive() {
        return active;
    }

    private static void tick(MinecraftClient client) {
        if (!active) {
            return;
        }
        if (client.player == null || client.world == null) {
            deactivate(client);
            return;
        }
        client.options.hudHidden = true;
    }

    private static void deactivate(MinecraftClient client) {
        active = false;
        client.options.hudHidden = previousHudHidden;
    }

    private static void render(DrawContext context) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (!active || client.player == null || client.world == null || client.currentScreen != null) {
            return;
        }

        int width = context.getScaledWindowWidth();
        int height = context.getScaledWindowHeight();
        int moodColor = FxPalette.primary(ClientResonanceCache.getMood());
        int secondaryColor = FxPalette.secondary(ClientResonanceCache.getMood());
        long frame = client.inGameHud.getTicks();

        if (FxBudget.tryEmit(FxBudget.Effect.OVERLAY, 5, FxBudget.Priority.CRITICAL)) {
            int breathing = Math.round((MathHelper.sin(frame * 0.035F) + 1.0F) * 2.0F);
            context.fill(0, 0, width, height, FxPalette.withAlpha(moodColor, 13 + breathing));
            drawLetterbox(context, width, height, secondaryColor);
        }
        drawFilmGrain(context, width, height, frame, moodColor);
    }

    private static void drawLetterbox(DrawContext context, int width, int height, int accent) {
        int barHeight = Math.max(12, Math.round(height * 0.085F));
        context.fill(0, 0, width, barHeight, 0xF4050309);
        context.fill(0, height - barHeight, width, height, 0xF4050309);
        context.fill(0, barHeight, width, barHeight + 1, FxPalette.withAlpha(accent, 92));
        context.fill(0, height - barHeight - 1, width, height - barHeight, FxPalette.withAlpha(accent, 72));
    }

    private static void drawFilmGrain(
            DrawContext context,
            int width,
            int height,
            long frame,
            int moodColor
    ) {
        int budget = FxBudget.scale(FxBudget.Effect.OVERLAY, GRAIN_SAMPLES, FxBudget.Priority.CRITICAL);
        int seed = mix((int) frame * 0x45D9F3B);
        for (int sample = 0; sample < budget; sample++) {
            seed = mix(seed + sample * 0x9E3779B9);
            int x = Math.floorMod(seed, Math.max(1, width));
            int y = Math.floorMod(seed >>> 11, Math.max(1, height));
            int alpha = 7 + (seed >>> 27 & 0x0F);
            int color = (seed & 1) == 0
                    ? FxPalette.withAlpha(0xF2EDF8, alpha)
                    : FxPalette.withAlpha(moodColor, alpha + 3);
            int size = (seed & 0x30) == 0 ? 2 : 1;
            context.fill(x, y, Math.min(width, x + size), Math.min(height, y + size), color);
        }
    }

    private static int mix(int value) {
        value = (value ^ value >>> 16) * 0x7FEB352D;
        value = (value ^ value >>> 15) * 0x846CA68B;
        return value ^ value >>> 16;
    }
}
