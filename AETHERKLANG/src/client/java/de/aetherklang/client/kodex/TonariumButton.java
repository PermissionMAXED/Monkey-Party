package de.aetherklang.client.kodex;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.narration.NarrationMessageBuilder;
import net.minecraft.client.gui.widget.PressableWidget;
import net.minecraft.client.input.AbstractInput;
import net.minecraft.text.Text;

public final class TonariumButton extends PressableWidget {
    public enum Style {
        CATEGORY,
        ENTRY,
        NAVIGATION,
        CLOSE
    }

    private final Runnable action;
    private final Style style;
    private final int accent;
    private boolean selected;
    private boolean locked;

    public TonariumButton(
            int x,
            int y,
            int width,
            int height,
            Text message,
            Style style,
            int accent,
            Runnable action
    ) {
        super(x, y, width, height, message);
        this.action = action;
        this.style = style;
        this.accent = accent;
    }

    public TonariumButton selected(boolean selected) {
        this.selected = selected;
        return this;
    }

    public TonariumButton locked(boolean locked) {
        this.locked = locked;
        return this;
    }

    @Override
    public void onPress(AbstractInput input) {
        action.run();
    }

    @Override
    protected void renderWidget(DrawContext context, int mouseX, int mouseY, float deltaTicks) {
        int x = getX();
        int y = getY();
        int background = selected
                ? 0xC03D2A6B
                : (isHovered() ? 0xA033245B : 0x70231843);
        int border = selected || isHovered() ? accent : 0xFF4A3A68;

        context.fill(x, y, x + width, y + height, background);
        context.fill(x, y, x + width, y + 1, border);
        context.fill(x, y + height - 1, x + width, y + height, border);
        if (style == Style.CATEGORY || style == Style.ENTRY) {
            context.fill(x, y, x + (selected ? 3 : 1), y + height, accent);
        } else {
            context.fill(x, y, x + 1, y + height, border);
            context.fill(x + width - 1, y, x + width, y + height, border);
        }

        var textRenderer = MinecraftClient.getInstance().textRenderer;
        int color = locked ? 0xFF817592 : (active ? 0xFFF4EEFF : 0xFF776D83);
        int textX = style == Style.CATEGORY || style == Style.ENTRY
                ? x + 8
                : x + (width - textRenderer.getWidth(getMessage())) / 2;
        int textY = y + (height - 8) / 2;
        Text visibleMessage = style == Style.CATEGORY || style == Style.ENTRY
                ? Text.literal(textRenderer.trimToWidth(getMessage().getString(), width - (locked ? 27 : 13)))
                : getMessage();
        context.drawTextWithShadow(textRenderer, visibleMessage, textX, textY, color);

        if (locked) {
            context.drawTextWithShadow(textRenderer, Text.literal("◇"), x + width - 13, textY, 0xFFE03A8C);
        }
    }

    @Override
    protected void appendClickableNarrations(NarrationMessageBuilder builder) {
        appendDefaultNarrations(builder);
    }
}
