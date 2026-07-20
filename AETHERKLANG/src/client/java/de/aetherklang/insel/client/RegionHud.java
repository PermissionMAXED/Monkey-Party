package de.aetherklang.insel.client;

import de.aetherklang.Aetherklang;
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
        int panelWidth = Math.max(132, Math.max(
                client.textRenderer.getWidth(name) + 28,
                client.textRenderer.getWidth(sector) + 28
        ));
        int x = context.getScaledWindowWidth() - panelWidth - 12;
        int y = 12;
        int accent = regionColor(ClientRegionState.regionId());
        int panelAlpha = Math.round(MathHelper.lerp(reveal, 112.0F, 188.0F));
        int lineAlpha = Math.round(MathHelper.lerp(reveal, 148.0F, 255.0F));

        cutCornerFill(context, x + 2, y + 2, panelWidth, 34, 0x65000000);
        cutCornerFill(context, x, y, panelWidth, 34, FxPalette.withAlpha(accent, lineAlpha));
        cutCornerFill(context, x + 1, y + 1, panelWidth - 2, 32, FxPalette.withAlpha(FxPalette.INDIGO, panelAlpha));
        context.fill(x + 7, y + 6, x + panelWidth - 7, y + 7, FxPalette.withAlpha(accent, lineAlpha));
        context.fill(x + 7, y + 27, x + 31, y + 28, FxPalette.withAlpha(FxPalette.GOLD, lineAlpha));

        context.drawTextWithShadow(client.textRenderer, name, x + 12, y + 10, 0xFFF4EEFF);
        context.drawTextWithShadow(client.textRenderer, sector, x + 12, y + 21, FxPalette.withAlpha(accent, 0xFF));

        if (reveal > 0.01F) {
            int sweep = Math.round((panelWidth - 16) * reveal);
            context.fill(
                    x + 8,
                    y + 30,
                    x + 8 + sweep,
                    y + 31,
                    FxPalette.withAlpha(FxPalette.CYAN, Math.round(reveal * 205.0F))
            );
        }
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

    private static void cutCornerFill(DrawContext context, int x, int y, int width, int height, int color) {
        context.fill(x + 2, y, x + width - 2, y + height, color);
        context.fill(x, y + 2, x + width, y + height - 2, color);
    }
}
