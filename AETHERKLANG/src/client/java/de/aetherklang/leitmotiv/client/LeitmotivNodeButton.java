package de.aetherklang.leitmotiv.client;

import de.aetherklang.leitmotiv.LeitmotivNode;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.narration.NarrationMessageBuilder;
import net.minecraft.client.gui.widget.PressableWidget;
import net.minecraft.client.input.AbstractInput;
import net.minecraft.text.Text;

final class LeitmotivNodeButton extends PressableWidget {
    private final LeitmotivNode node;
    private final int accent;
    private final Runnable action;
    private boolean unlocked;
    private boolean available;

    LeitmotivNodeButton(
            int x,
            int y,
            int width,
            int height,
            LeitmotivNode node,
            int accent,
            Runnable action
    ) {
        super(x, y, width, height, Text.translatable(node.titleKey()));
        this.node = node;
        this.accent = accent;
        this.action = action;
    }

    LeitmotivNodeButton state(boolean unlocked, boolean available) {
        this.unlocked = unlocked;
        this.available = available;
        active = !unlocked && available;
        return this;
    }

    LeitmotivNode node() {
        return node;
    }

    @Override
    public void onPress(AbstractInput input) {
        if (active) {
            action.run();
        }
    }

    @Override
    protected void renderWidget(DrawContext context, int mouseX, int mouseY, float deltaTicks) {
        int x = getX();
        int y = getY();
        int background = unlocked
                ? 0xD03B3150
                : (isHovered() && available ? 0xC033245B : 0xA018102D);
        int border = unlocked ? accent : (available ? (isHovered() ? accent : 0xFF67577C) : 0xFF3A3044);
        int marker = unlocked ? accent : (available ? 0xFFF5C95F : 0xFF665A70);

        context.fill(x, y, x + width, y + height, background);
        context.fill(x, y, x + width, y + 1, border);
        context.fill(x, y + height - 1, x + width, y + height, border);
        context.fill(x, y, x + 2, y + height, border);
        context.fill(x + width - 1, y, x + width, y + height, border);

        var textRenderer = MinecraftClient.getInstance().textRenderer;
        Text markerText = Text.literal(unlocked ? "◆" : (available ? "◇" : "·"));
        context.drawTextWithShadow(textRenderer, markerText, x + 6, y + (height - 8) / 2, marker);
        Text label = Text.literal(textRenderer.trimToWidth(getMessage().getString(), width - 48));
        int textColor = unlocked || available ? 0xFFF4EEFF : 0xFF817592;
        context.drawTextWithShadow(textRenderer, label, x + 19, y + (height - 8) / 2, textColor);

        Text cost = Text.literal(node.cost() + " ♫");
        context.drawTextWithShadow(
                textRenderer,
                cost,
                x + width - textRenderer.getWidth(cost) - 6,
                y + (height - 8) / 2,
                unlocked ? 0xFF8D829A : 0xFFF5C95F
        );
    }

    @Override
    protected void appendClickableNarrations(NarrationMessageBuilder builder) {
        appendDefaultNarrations(builder);
    }
}
