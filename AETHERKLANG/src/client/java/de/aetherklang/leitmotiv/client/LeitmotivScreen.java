package de.aetherklang.leitmotiv.client;

import de.aetherklang.leitmotiv.LeitmotivBranch;
import de.aetherklang.leitmotiv.LeitmotivNode;
import de.aetherklang.leitmotiv.LeitmotivTree;
import de.aetherklang.registry.ModPayloads;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.OrderedText;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;

public final class LeitmotivScreen extends Screen {
    private static final int BACKGROUND = 0xFF100820;
    private static final int PANEL = 0xF21A1033;
    private static final int PAPER = 0xFFF4EEFF;
    private static final int MUTED = 0xFFB4A7C6;
    private static final int GOLD = 0xFFF5C95F;
    private static final int[] BRANCH_COLORS = {0xFFE03A8C, 0xFF5FF5E0, 0xFF72A7FF};

    private final Screen parent;
    private final Map<String, LeitmotivNodeButton> nodeButtons = new LinkedHashMap<>();
    private int panelX;
    private int panelY;
    private int panelWidth;
    private int panelHeight;

    public LeitmotivScreen(Screen parent) {
        super(Text.translatable("leitmotiv.aetherklang.title"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        panelWidth = Math.min(width - 20, 900);
        panelHeight = Math.min(height - 20, 560);
        panelX = (width - panelWidth) / 2;
        panelY = (height - panelHeight) / 2;
        rebuildWidgets();
        requestSync();
    }

    public void refresh() {
        if (client != null) {
            rebuildWidgets();
        }
    }

    private void rebuildWidgets() {
        clearChildren();
        nodeButtons.clear();

        int sidePadding = 16;
        int gap = 10;
        int columnWidth = (panelWidth - sidePadding * 2 - gap * 2) / 3;
        int nodeTop = panelY + 66;
        int footerTop = panelY + panelHeight - 55;
        int step = Math.max(14, (footerTop - nodeTop - 22) / 7);
        int nodeHeight = Math.clamp(step - 4, 10, 24);

        LeitmotivBranch[] branches = LeitmotivBranch.values();
        for (int branchIndex = 0; branchIndex < branches.length; branchIndex++) {
            LeitmotivBranch branch = branches[branchIndex];
            int columnX = panelX + sidePadding + branchIndex * (columnWidth + gap);
            for (LeitmotivNode node : LeitmotivTree.branch(branch)) {
                int y = nodeTop + node.tier() * step;
                LeitmotivNodeButton button = new LeitmotivNodeButton(
                        columnX + 4,
                        y,
                        columnWidth - 8,
                        nodeHeight,
                        node,
                        BRANCH_COLORS[branchIndex],
                        () -> unlock(node)
                ).state(ClientLeitmotivCache.isUnlocked(node.id()), isAvailable(node));
                nodeButtons.put(node.id(), button);
                addDrawableChild(button);
            }
        }

        addDrawableChild(ButtonWidget.builder(Text.literal("×"), button -> close())
                .dimensions(panelX + panelWidth - 28, panelY + 10, 18, 18)
                .build());
    }

    private boolean isAvailable(LeitmotivNode node) {
        boolean prerequisitesMet = node.prerequisites().stream().allMatch(ClientLeitmotivCache::isUnlocked);
        boolean creative = client != null && client.player != null && client.player.getAbilities().creativeMode;
        return prerequisitesMet && (creative || ClientLeitmotivCache.getKeys() >= node.cost());
    }

    private void unlock(LeitmotivNode node) {
        if (ClientPlayNetworking.canSend(ModPayloads.LeitmotivUnlockPayload.ID)) {
            ClientPlayNetworking.send(new ModPayloads.LeitmotivUnlockPayload(node.id()));
        }
    }

    private void requestSync() {
        if (client != null
                && client.getNetworkHandler() != null
                && ClientPlayNetworking.canSend(ModPayloads.LeitmotivUnlockPayload.ID)) {
            ClientPlayNetworking.send(new ModPayloads.LeitmotivUnlockPayload(""));
        }
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float deltaTicks) {
        renderBackground(context);
        renderFrame(context);
        renderHeader(context);
        renderConnections(context);
        super.render(context, mouseX, mouseY, deltaTicks);
        renderDetails(context);
    }

    private void renderBackground(DrawContext context) {
        context.fill(0, 0, width, height, BACKGROUND);
        context.fillGradient(0, 0, width, height, 0xFF24134A, BACKGROUND);
        for (int index = 0; index < 36; index++) {
            int x = Math.floorMod(index * 83 + 19, Math.max(1, width));
            int y = Math.floorMod(index * 47 + 31, Math.max(1, height));
            context.fill(x, y, x + 1, y + 1, index % 3 == 0 ? 0x805FF5E0 : 0x60F5C95F);
        }
    }

    private void renderFrame(DrawContext context) {
        context.fill(panelX - 2, panelY - 2, panelX + panelWidth + 2, panelY + panelHeight + 2, 0x905FF5E0);
        context.fill(panelX - 1, panelY - 1, panelX + panelWidth + 1, panelY + panelHeight + 1, GOLD);
        context.fill(panelX, panelY, panelX + panelWidth, panelY + panelHeight, PANEL);

        int columnWidth = (panelWidth - 52) / 3;
        for (int split = 1; split < 3; split++) {
            int x = panelX + 16 + split * (columnWidth + 10) - 5;
            context.fill(x, panelY + 39, x + 1, panelY + panelHeight - 58, 0x505FF5E0);
        }
        context.fill(
                panelX + 12,
                panelY + panelHeight - 55,
                panelX + panelWidth - 12,
                panelY + panelHeight - 54,
                0x80F5C95F
        );
    }

    private void renderHeader(DrawContext context) {
        context.drawCenteredTextWithShadow(
                textRenderer,
                getTitle().copy().formatted(Formatting.BOLD),
                panelX + panelWidth / 2,
                panelY + 11,
                PAPER
        );
        context.drawCenteredTextWithShadow(
                textRenderer,
                Text.translatable("leitmotiv.aetherklang.subtitle"),
                panelX + panelWidth / 2,
                panelY + 25,
                MUTED
        );

        int sidePadding = 16;
        int gap = 10;
        int columnWidth = (panelWidth - sidePadding * 2 - gap * 2) / 3;
        LeitmotivBranch[] branches = LeitmotivBranch.values();
        for (int index = 0; index < branches.length; index++) {
            int center = panelX + sidePadding + index * (columnWidth + gap) + columnWidth / 2;
            context.drawCenteredTextWithShadow(
                    textRenderer,
                    Text.translatable(branches[index].translationKey()).formatted(Formatting.BOLD),
                    center,
                    panelY + 46,
                    BRANCH_COLORS[index]
            );
        }

        Text keys = Text.translatable("leitmotiv.aetherklang.keys", ClientLeitmotivCache.getKeys());
        context.drawTextWithShadow(textRenderer, keys, panelX + 13, panelY + 13, GOLD);
    }

    private void renderConnections(DrawContext context) {
        for (LeitmotivNode node : LeitmotivTree.all()) {
            LeitmotivNodeButton target = nodeButtons.get(node.id());
            if (target == null) {
                continue;
            }
            for (String prerequisite : node.prerequisites()) {
                LeitmotivNodeButton source = nodeButtons.get(prerequisite);
                if (source == null) {
                    continue;
                }
                int x = source.getX() + source.getWidth() / 2;
                int color = ClientLeitmotivCache.isUnlocked(prerequisite) ? 0xC0F5C95F : 0x70544761;
                context.fill(x - 1, source.getY() + source.getHeight(), x + 1, target.getY(), color);
            }
        }
    }

    private void renderDetails(DrawContext context) {
        LeitmotivNode hovered = nodeButtons.values().stream()
                .filter(LeitmotivNodeButton::isHovered)
                .map(LeitmotivNodeButton::node)
                .findFirst()
                .orElse(null);
        Text details = hovered == null
                ? Text.translatable("leitmotiv.aetherklang.hint")
                : Text.translatable(hovered.descriptionKey());
        List<OrderedText> lines = textRenderer.wrapLines(details, panelWidth - 42);
        int y = panelY + panelHeight - 45;
        for (OrderedText line : lines.stream().limit(3).toList()) {
            context.drawCenteredTextWithShadow(
                    textRenderer,
                    line,
                    panelX + panelWidth / 2,
                    y,
                    hovered == null ? MUTED : PAPER
            );
            y += 10;
        }
    }

    @Override
    public void close() {
        if (client != null) {
            client.setScreen(parent);
        }
    }

    @Override
    public boolean shouldPause() {
        return false;
    }
}
