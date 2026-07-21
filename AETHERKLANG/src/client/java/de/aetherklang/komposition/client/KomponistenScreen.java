package de.aetherklang.komposition.client;

import de.aetherklang.klangwerk.Klangoperation;
import de.aetherklang.komposition.KompositionPayloads;
import de.aetherklang.komposition.Zauberpartitur;
import java.util.ArrayList;
import java.util.List;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import net.minecraft.util.Hand;

/**
 * Compact server-authoritative phrase editor opened from a scroll or Notenpult.
 */
public final class KomponistenScreen extends Screen {
    private static final int PANEL_WIDTH = 370;
    private static final int PANEL_HEIGHT = 246;
    private static final int INDIGO = 0xF01A1033;
    private static final int CYAN = 0xFF5FF5E0;
    private static final int GOLD = 0xFFF5C95F;
    private static final int PAPER = 0xFFF4EEFF;
    private static final int MUTED = 0xFFB4A7C6;

    private final Hand hand;
    private final List<Klangoperation> operations;
    private int panelX;
    private int panelY;

    public KomponistenScreen(Hand hand, Zauberpartitur score) {
        super(Text.translatable("komposition.aetherklang.screen.title"));
        this.hand = hand;
        this.operations = new ArrayList<>(score.operations());
    }

    @Override
    protected void init() {
        panelX = (width - PANEL_WIDTH) / 2;
        panelY = (height - PANEL_HEIGHT) / 2;
        rebuildWidgets();
    }

    private void rebuildWidgets() {
        clearChildren();
        int rowX = panelX + 32;
        int rowWidth = PANEL_WIDTH - 64;
        for (int index = 0; index < operations.size(); index++) {
            int operationIndex = index;
            int y = panelY + 53 + index * 28;
            addDrawableChild(ButtonWidget.builder(Text.literal("‹"), ignored -> cycle(operationIndex, -1))
                    .dimensions(rowX, y, 24, 20)
                    .build());
            addDrawableChild(ButtonWidget.builder(
                            Text.translatable(Zauberpartitur.operationTranslationKey(operations.get(index))),
                            ignored -> cycle(operationIndex, 1)
                    )
                    .dimensions(rowX + 29, y, rowWidth - 58, 20)
                    .build());
            addDrawableChild(ButtonWidget.builder(Text.literal("›"), ignored -> cycle(operationIndex, 1))
                    .dimensions(rowX + rowWidth - 24, y, 24, 20)
                    .build());
        }

        int controlsY = panelY + 196;
        ButtonWidget remove = ButtonWidget.builder(
                        Text.translatable("komposition.aetherklang.screen.remove"),
                        ignored -> removeOperation()
                )
                .dimensions(panelX + 32, controlsY, 82, 20)
                .build();
        remove.active = operations.size() > Zauberpartitur.MIN_OPERATIONS;
        addDrawableChild(remove);

        ButtonWidget add = ButtonWidget.builder(
                        Text.translatable("komposition.aetherklang.screen.add"),
                        ignored -> addOperation()
                )
                .dimensions(panelX + 119, controlsY, 82, 20)
                .build();
        add.active = operations.size() < Zauberpartitur.MAX_OPERATIONS;
        addDrawableChild(add);

        addDrawableChild(ButtonWidget.builder(
                        Text.translatable("komposition.aetherklang.screen.save"),
                        ignored -> save()
                )
                .dimensions(panelX + 206, controlsY, 62, 20)
                .build());
        addDrawableChild(ButtonWidget.builder(
                        Text.translatable("gui.cancel"),
                        ignored -> close()
                )
                .dimensions(panelX + 273, controlsY, 65, 20)
                .build());
    }

    private void cycle(int index, int direction) {
        Klangoperation[] available = Klangoperation.values();
        int next = Math.floorMod(operations.get(index).ordinal() + direction, available.length);
        operations.set(index, available[next]);
        rebuildWidgets();
    }

    private void addOperation() {
        if (operations.size() < Zauberpartitur.MAX_OPERATIONS) {
            operations.add(operations.getLast());
            rebuildWidgets();
        }
    }

    private void removeOperation() {
        if (operations.size() > Zauberpartitur.MIN_OPERATIONS) {
            operations.removeLast();
            rebuildWidgets();
        }
    }

    private void save() {
        if (ClientPlayNetworking.canSend(KompositionPayloads.SavePayload.ID)) {
            ClientPlayNetworking.send(
                    new KompositionPayloads.SavePayload(hand, new Zauberpartitur(operations))
            );
        }
        close();
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float deltaTicks) {
        context.fillGradient(0, 0, width, height, 0xE00B0617, 0xE0250E3D);
        context.fill(panelX - 2, panelY - 2, panelX + PANEL_WIDTH + 2, panelY + PANEL_HEIGHT + 2, CYAN);
        context.fill(panelX - 1, panelY - 1, panelX + PANEL_WIDTH + 1, panelY + PANEL_HEIGHT + 1, GOLD);
        context.fill(panelX, panelY, panelX + PANEL_WIDTH, panelY + PANEL_HEIGHT, INDIGO);
        context.drawCenteredTextWithShadow(
                textRenderer,
                title.copy().formatted(Formatting.BOLD),
                width / 2,
                panelY + 12,
                PAPER
        );
        context.drawCenteredTextWithShadow(
                textRenderer,
                Text.translatable("komposition.aetherklang.screen.subtitle", operations.size()),
                width / 2,
                panelY + 29,
                MUTED
        );
        for (int index = 0; index < operations.size(); index++) {
            context.drawTextWithShadow(
                    textRenderer,
                    Text.literal((index + 1) + ".").formatted(Formatting.GOLD),
                    panelX + 13,
                    panelY + 59 + index * 28,
                    GOLD
            );
        }
        context.fill(panelX + 12, panelY + 186, panelX + PANEL_WIDTH - 12, panelY + 187, 0x805FF5E0);
        super.render(context, mouseX, mouseY, deltaTicks);
    }

    @Override
    public boolean shouldPause() {
        return false;
    }
}
