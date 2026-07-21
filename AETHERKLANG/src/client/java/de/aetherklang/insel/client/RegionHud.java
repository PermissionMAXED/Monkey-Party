package de.aetherklang.insel.client;

import de.aetherklang.Aetherklang;
import de.aetherklang.client.GlassHud;
import de.aetherklang.client.fx.FxPalette;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.text.Text;
import net.minecraft.util.math.MathHelper;

/**
 * Compact Klangmeer nameplate backed exclusively by {@code region_sync}.
 */
public final class RegionHud {
    private static boolean registered;

    private RegionHud() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        ClientTickEvents.END_CLIENT_TICK.register(ClientRegionState::tick);
        HudElementRegistry.addLast(Aetherklang.id("klangmeer_region"), (context, tickCounter) -> render(context));
    }

    private static void render(DrawContext context) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (!ClientRegionState.isActive()
                || client.player == null
                || client.currentScreen != null
                || client.options.hudHidden) {
            return;
        }

        Text name = ClientRegionState.displayName();
        Text sector = ClientRegionState.sectorName();
        float reveal = ClientRegionState.reveal();
        int panelWidth = Math.max(152, Math.max(
                client.textRenderer.getWidth(name) + 52,
                client.textRenderer.getWidth(sector) + 52
        ));
        int x = context.getScaledWindowWidth() - panelWidth - 12;
        int y = Math.round(MathHelper.lerp(reveal, 5.0F, 12.0F));
        int accent = regionColor(ClientRegionState.regionId());
        int panelAlpha = Math.round(MathHelper.lerp(reveal, 96.0F, 226.0F));
        int lineAlpha = Math.round(MathHelper.lerp(reveal, 148.0F, 255.0F));

        GlassHud.drawPanel(context, x, y, panelWidth, 40, accent, panelAlpha);
        GlassHud.drawInset(context, x + 8, y + 8, 27, 24, accent, true);
        drawRegionMark(context, x + 21, y + 20, accent, lineAlpha);

        context.drawTextWithShadow(client.textRenderer, name, x + 42, y + 9, 0xFFF4EEFF);
        context.drawTextWithShadow(
                client.textRenderer,
                sector,
                x + 42,
                y + 21,
                FxPalette.withAlpha(accent, lineAlpha)
        );
        GlassHud.drawPip(context, x + panelWidth - 13, y + 12, accent, true);
        GlassHud.drawPip(context, x + panelWidth - 13, y + 20, accent, reveal > 0.4F);
        GlassHud.drawPip(context, x + panelWidth - 13, y + 28, accent, reveal > 0.8F);

        if (reveal > 0.01F) {
            int sweep = Math.round((panelWidth - 48) * reveal);
            context.fill(
                    x + 42,
                    y + 34,
                    x + 42 + sweep,
                    y + 35,
                    FxPalette.withAlpha(FxPalette.CYAN, Math.round(reveal * 205.0F))
            );
        }
    }

    private static void drawRegionMark(DrawContext context, int centerX, int centerY, int accent, int alpha) {
        int color = FxPalette.withAlpha(accent, alpha);
        for (int radius = 9; radius >= 3; radius -= 3) {
            int ringAlpha = Math.max(40, alpha - (9 - radius) * 22);
            int ringColor = FxPalette.withAlpha(accent, ringAlpha);
            context.fill(centerX - radius, centerY, centerX - radius + 2, centerY + 1, ringColor);
            context.fill(centerX + radius - 1, centerY, centerX + radius + 1, centerY + 1, ringColor);
            context.fill(centerX, centerY - radius, centerX + 1, centerY - radius + 2, ringColor);
            context.fill(centerX, centerY + radius - 1, centerX + 1, centerY + radius + 1, ringColor);
        }
        context.fill(centerX - 2, centerY - 2, centerX + 3, centerY + 3, color);
        context.fill(centerX - 1, centerY - 3, centerX + 2, centerY + 4, color);
    }

    private static int regionColor(String regionId) {
        return switch (regionId == null ? "" : regionId) {
            case "bassgewoelbe" -> 0x9C82FF;
            case "arpeggienmeer" -> FxPalette.CYAN;
            case "kakophonie_riff" -> FxPalette.MAGENTA;
            case "generalpause_oede" -> 0xC8C7DA;
            default -> FxPalette.GOLD;
        };
    }
}
