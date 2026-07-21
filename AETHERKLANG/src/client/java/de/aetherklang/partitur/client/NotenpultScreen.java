package de.aetherklang.partitur.client;

import de.aetherklang.client.PaintedScreenArt;
import de.aetherklang.partitur.PartiturPayloads;
import java.util.ArrayList;
import java.util.List;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.item.Item;
import net.minecraft.registry.Registries;
import net.minecraft.text.OrderedText;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import net.minecraft.util.Identifier;

public final class NotenpultScreen extends Screen {
    private static final int PANEL = 0xD81D1238;
    private static final int CARD = 0xC02B1B50;
    private static final int CARD_COMPLETE = 0xC01B4B49;
    private static final int CYAN = 0xFF5FF5E0;
    private static final int GOLD = 0xFFF5C95F;
    private static final int MAGENTA = 0xFFE03A8C;
    private static final int PAPER = 0xFFF4EEFF;
    private static final int MUTED = 0xFFB4A7C6;

    private int panelX;
    private int panelY;
    private int panelWidth;
    private int panelHeight;
    private boolean wide;
    private static int selectedContract;

    public NotenpultScreen() {
        super(Text.translatable("partitur.aetherklang.title"));
    }

    @Override
    protected void init() {
        panelWidth = Math.min(width - 20, Math.max(820, Math.min(1260, width * 4 / 5)));
        panelHeight = Math.min(height - 20, Math.max(440, Math.min(700, height * 4 / 5)));
        panelX = (width - panelWidth) / 2;
        panelY = (height - panelHeight) / 2;
        wide = panelWidth >= 610;

        List<PartiturPayloads.Entry> entries = ClientPartiturState.entries();
        selectedContract = Math.clamp(selectedContract, 0, Math.max(0, entries.size() - 1));
        if (wide) {
            for (int index = 0; index < entries.size(); index++) {
                addClaimButton(entries.get(index), cardBounds(index, entries.size()));
            }
        } else if (!entries.isEmpty()) {
            addClaimButton(entries.get(selectedContract), cardBounds(0, 1));
            ButtonWidget previous = ButtonWidget.builder(Text.literal("‹"), ignored -> select(-1))
                    .dimensions(panelX + 10, panelY + 29, 28, 18)
                    .build();
            previous.active = selectedContract > 0;
            addDrawableChild(previous);
            ButtonWidget next = ButtonWidget.builder(Text.literal("›"), ignored -> select(1))
                    .dimensions(panelX + panelWidth - 38, panelY + 29, 28, 18)
                    .build();
            next.active = selectedContract + 1 < entries.size();
            addDrawableChild(next);
        }

        addDrawableChild(ButtonWidget.builder(Text.literal("×"), ignored -> close())
                .dimensions(panelX + panelWidth - 28, panelY + 9, 18, 18)
                .build());
    }

    private void addClaimButton(PartiturPayloads.Entry entry, CardBounds bounds) {
        Text label = entry.claimed()
                ? Text.translatable("partitur.aetherklang.claimed")
                : entry.complete()
                        ? Text.translatable("partitur.aetherklang.claim")
                        : Text.translatable("partitur.aetherklang.in_progress");
        ButtonWidget button = ButtonWidget.builder(label, ignored -> claim(entry))
                .dimensions(
                        bounds.x() + 10,
                        bounds.y() + bounds.height() - 25,
                        bounds.width() - 20,
                        18
                )
                .build();
        button.active = entry.complete() && !entry.claimed();
        addDrawableChild(button);
    }

    private void select(int direction) {
        int last = ClientPartiturState.entries().size() - 1;
        selectedContract = Math.clamp(selectedContract + direction, 0, Math.max(0, last));
        clearAndInit();
    }

    private void claim(PartiturPayloads.Entry entry) {
        if (entry.complete()
                && !entry.claimed()
                && ClientPlayNetworking.canSend(PartiturPayloads.ClaimPayload.ID)) {
            ClientPlayNetworking.send(new PartiturPayloads.ClaimPayload(entry.id()));
        }
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float deltaTicks) {
        renderBackdrop(context);
        renderFrame(context);
        renderHeader(context);

        List<PartiturPayloads.Entry> entries = ClientPartiturState.entries();
        if (entries.isEmpty()) {
            context.drawCenteredTextWithShadow(
                    textRenderer,
                    Text.translatable("partitur.aetherklang.empty"),
                    width / 2,
                    height / 2,
                    MUTED
            );
        } else if (wide) {
            for (int index = 0; index < entries.size(); index++) {
                renderContract(context, entries.get(index), cardBounds(index, entries.size()));
            }
        } else {
            renderContract(context, entries.get(selectedContract), cardBounds(0, 1));
        }
        super.render(context, mouseX, mouseY, deltaTicks);
    }

    private void renderBackdrop(DrawContext context) {
        PaintedScreenArt.draw(context, PaintedScreenArt.Scene.NOTENPULT, width, height);
    }

    private void renderFrame(DrawContext context) {
        context.fill(panelX - 2, panelY - 2, panelX + panelWidth + 2, panelY + panelHeight + 2, CYAN);
        context.fill(panelX - 1, panelY - 1, panelX + panelWidth + 1, panelY + panelHeight + 1, GOLD);
        context.fill(panelX, panelY, panelX + panelWidth, panelY + panelHeight, PANEL);
        context.fill(panelX + 8, panelY + 51, panelX + panelWidth - 8, panelY + 52, 0x80F5C95F);
    }

    private void renderHeader(DrawContext context) {
        context.drawCenteredTextWithShadow(
                textRenderer,
                title.copy().formatted(Formatting.BOLD),
                panelX + panelWidth / 2,
                panelY + 11,
                PAPER
        );
        Text timer = Text.translatable(
                "partitur.aetherklang.rotation",
                formatTime(ClientPartiturState.ticksRemaining())
        );
        context.drawCenteredTextWithShadow(
                textRenderer,
                timer,
                panelX + panelWidth / 2,
                panelY + 30,
                CYAN
        );
    }

    private void renderContract(
            DrawContext context,
            PartiturPayloads.Entry entry,
            CardBounds bounds
    ) {
        int fill = entry.complete() ? CARD_COMPLETE : CARD;
        int accent = entry.claimed() ? MUTED : entry.complete() ? GOLD : CYAN;
        context.fill(bounds.x(), bounds.y(), bounds.x() + bounds.width(), bounds.y() + bounds.height(), fill);
        context.fill(bounds.x(), bounds.y(), bounds.x() + 3, bounds.y() + bounds.height(), accent);
        context.fill(bounds.x() + 4, bounds.y() + 3, bounds.x() + bounds.width() - 3, bounds.y() + 4, accent);

        int x = bounds.x() + 11;
        int y = bounds.y() + 10;
        int textWidth = bounds.width() - 22;
        context.drawTextWithShadow(
                textRenderer,
                Text.translatable(entry.titleKey()).formatted(Formatting.BOLD),
                x,
                y,
                PAPER
        );
        y += 14;
        context.drawTextWithShadow(
                textRenderer,
                Text.translatable("partitur.aetherklang.objective." + entry.objective()),
                x,
                y,
                accent
        );
        y += 13;

        int descriptionLines = wide ? 4 : 2;
        List<OrderedText> wrapped = textRenderer.wrapLines(Text.translatable(entry.descriptionKey()), textWidth);
        for (int index = 0; index < Math.min(descriptionLines, wrapped.size()); index++) {
            context.drawTextWithShadow(textRenderer, wrapped.get(index), x, y, MUTED);
            y += 10;
        }

        int progressY = bounds.y() + bounds.height() - (wide ? 69 : 57);
        int progressWidth = bounds.width() - 22;
        float completion = Math.min(1.0F, (float) entry.progress() / entry.amount());
        context.fill(x, progressY, x + progressWidth, progressY + 7, 0xFF100820);
        context.fill(x, progressY, x + Math.round(progressWidth * completion), progressY + 7, accent);
        context.drawCenteredTextWithShadow(
                textRenderer,
                Text.translatable(
                        "partitur.aetherklang.progress",
                        Math.min(entry.progress(), entry.amount()),
                        entry.amount()
                ),
                x + progressWidth / 2,
                progressY - 1,
                PAPER
        );

        Text rewards = rewards(entry);
        context.drawTextWithShadow(
                textRenderer,
                textRenderer.trimToWidth(rewards.getString(), textWidth),
                x,
                progressY + 12,
                GOLD
        );
    }

    private Text rewards(PartiturPayloads.Entry entry) {
        List<Text> rewards = new ArrayList<>();
        if (entry.rewardRp() > 0) {
            rewards.add(Text.translatable("partitur.aetherklang.reward.rp", entry.rewardRp()));
        }
        if (entry.rewardNotenschluessel() > 0) {
            rewards.add(Text.translatable(
                    "partitur.aetherklang.reward.notenschluessel",
                    entry.rewardNotenschluessel()
            ));
        }
        Identifier materialId = Identifier.tryParse(entry.rewardMaterial());
        if (materialId != null && entry.rewardMaterialCount() > 0) {
            Item material = Registries.ITEM.get(materialId);
            rewards.add(Text.translatable(
                    "partitur.aetherklang.reward.material",
                    entry.rewardMaterialCount(),
                    material.getName()
            ));
        }

        Text line = Text.translatable("partitur.aetherklang.rewards").append(" ");
        for (int index = 0; index < rewards.size(); index++) {
            if (index > 0) {
                line = line.copy().append(" · ");
            }
            line = line.copy().append(rewards.get(index));
        }
        return line;
    }

    private CardBounds cardBounds(int index, int count) {
        int top = panelY + 62;
        int availableHeight = panelHeight - 72;
        if (wide) {
            int gap = 8;
            int availableWidth = panelWidth - 20 - gap * Math.max(0, count - 1);
            int cardWidth = availableWidth / Math.max(1, count);
            return new CardBounds(
                    panelX + 10 + index * (cardWidth + gap),
                    top,
                    cardWidth,
                    availableHeight
            );
        }
        int gap = 6;
        int cardHeight = (availableHeight - gap * Math.max(0, count - 1)) / Math.max(1, count);
        return new CardBounds(
                panelX + 10,
                top + index * (cardHeight + gap),
                panelWidth - 20,
                cardHeight
        );
    }

    private static String formatTime(int ticks) {
        int seconds = Math.max(0, ticks) / 20;
        return "%02d:%02d".formatted(seconds / 60, seconds % 60);
    }

    @Override
    public boolean shouldPause() {
        return false;
    }

    private record CardBounds(int x, int y, int width, int height) {
    }
}
