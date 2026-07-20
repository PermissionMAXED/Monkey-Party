package de.aetherklang.client.kodex;

import de.aetherklang.leitmotiv.client.LeitmotivOpener;
import de.aetherklang.resonance.client.ClientResonanceCache;
import java.util.List;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.OrderedText;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;

public final class KodexScreen extends Screen {
    private static final int INDIGO = 0xFF1A1033;
    private static final int DEEP_INDIGO = 0xFF100820;
    private static final int PANEL = 0xF2221642;
    private static final int PANEL_LIGHT = 0xD02B1B50;
    private static final int CYAN = 0xFF5FF5E0;
    private static final int GOLD = 0xFFF5C95F;
    private static final int MAGENTA = 0xFFE03A8C;
    private static final int PAPER = 0xFFF4EEFF;
    private static final int MUTED = 0xFFB4A7C6;

    private final List<KodexEntry> entries;
    private KodexCategory category = KodexCategory.LORE;
    private KodexEntry selectedEntry;
    private int panelX;
    private int panelY;
    private int panelWidth;
    private int panelHeight;
    private int sidebarWidth;
    private int indexWidth;
    private boolean compact;
    private int categoryScroll;

    public KodexScreen() {
        super(Text.translatable("kodex.aetherklang.title"));
        entries = KodexContent.load();
        selectedEntry = entries.getFirst();
    }

    @Override
    protected void init() {
        panelWidth = Math.min(width - 24, 920);
        panelHeight = Math.min(height - 24, 520);
        panelX = (width - panelWidth) / 2;
        panelY = (height - panelHeight) / 2;
        compact = panelWidth < 560;
        sidebarWidth = compact ? 110 : Math.max(112, Math.min(148, panelWidth / 5));
        indexWidth = compact ? 0 : Math.max(136, Math.min(180, panelWidth / 4));
        rebuildWidgets();
    }

    private void rebuildWidgets() {
        clearChildren();
        addCategoryButtons();
        addEntryButtons();
        addNavigationButtons();
    }

    private void addCategoryButtons() {
        int x = panelX + 10;
        int y = panelY + (compact ? 45 : 63);
        int buttonWidth = sidebarWidth - 20;
        int buttonHeight = compact ? 17 : 26;
        int buttonStep = compact ? 18 : 29;
        KodexCategory[] categories = KodexCategory.values();
        int visibleCount = visibleCategoryCount();
        int maxScroll = Math.max(0, categories.length - visibleCount);
        categoryScroll = Math.clamp(categoryScroll, 0, maxScroll);
        int end = Math.min(categories.length, categoryScroll + visibleCount);
        for (int index = categoryScroll; index < end; index++) {
            KodexCategory value = categories[index];
            Text label = Text.literal(value.glyph() + "  ").append(value.title());
            addDrawableChild(new TonariumButton(
                    x,
                    y,
                    buttonWidth,
                    buttonHeight,
                    label,
                    TonariumButton.Style.CATEGORY,
                    value.accent(),
                    () -> selectCategory(value)
            ).selected(category == value));
            y += buttonStep;
        }
        if (maxScroll > 0) {
            addCategoryScrollButtons(x, buttonWidth, maxScroll);
        }
    }

    private int visibleCategoryCount() {
        int top = panelY + (compact ? 45 : 63);
        int controlsTop = panelY + panelHeight - (compact ? 25 : 31);
        int buttonStep = compact ? 18 : 29;
        return Math.max(1, (controlsTop - top) / buttonStep);
    }

    private void addCategoryScrollButtons(int x, int buttonWidth, int maxScroll) {
        int gap = 4;
        int buttonY = panelY + panelHeight - (compact ? 24 : 30);
        int halfWidth = (buttonWidth - gap) / 2;

        TonariumButton previous = new TonariumButton(
                x,
                buttonY,
                halfWidth,
                18,
                Text.literal("▲"),
                TonariumButton.Style.NAVIGATION,
                CYAN,
                () -> scrollCategories(-1)
        );
        previous.active = categoryScroll > 0;
        addDrawableChild(previous);

        TonariumButton next = new TonariumButton(
                x + halfWidth + gap,
                buttonY,
                buttonWidth - halfWidth - gap,
                18,
                Text.literal("▼"),
                TonariumButton.Style.NAVIGATION,
                GOLD,
                () -> scrollCategories(1)
        );
        next.active = categoryScroll < maxScroll;
        addDrawableChild(next);
    }

    private void addEntryButtons() {
        if (compact) {
            return;
        }
        List<KodexEntry> categoryEntries = entriesForCategory();
        int x = panelX + sidebarWidth + 8;
        int y = panelY + 75;
        int buttonWidth = indexWidth - 16;
        for (KodexEntry entry : categoryEntries) {
            boolean unlocked = isUnlocked(entry);
            addDrawableChild(new TonariumButton(
                    x,
                    y,
                    buttonWidth,
                    34,
                    entry.title(),
                    TonariumButton.Style.ENTRY,
                    category.accent(),
                    () -> selectEntry(entry)
            ).selected(selectedEntry == entry).locked(!unlocked));
            y += 38;
        }
    }

    private void addNavigationButtons() {
        int contentX = panelX + sidebarWidth + indexWidth + 10;
        int contentWidth = panelWidth - sidebarWidth - indexWidth - 20;
        int bottom = panelY + panelHeight - 32;
        List<KodexEntry> categoryEntries = entriesForCategory();
        int currentIndex = Math.max(0, categoryEntries.indexOf(selectedEntry));

        TonariumButton previous = new TonariumButton(
                contentX,
                bottom,
                28,
                20,
                Text.literal("‹"),
                TonariumButton.Style.NAVIGATION,
                CYAN,
                () -> movePage(-1)
        );
        previous.active = currentIndex > 0;
        addDrawableChild(previous);

        TonariumButton next = new TonariumButton(
                contentX + contentWidth - 28,
                bottom,
                28,
                20,
                Text.literal("›"),
                TonariumButton.Style.NAVIGATION,
                GOLD,
                () -> movePage(1)
        );
        next.active = currentIndex + 1 < categoryEntries.size();
        addDrawableChild(next);

        addDrawableChild(new TonariumButton(
                panelX + panelWidth - 128,
                panelY + 12,
                90,
                19,
                Text.translatable("leitmotiv.aetherklang.button"),
                TonariumButton.Style.NAVIGATION,
                GOLD,
                () -> LeitmotivOpener.open(MinecraftClient.getInstance(), this)
        ));

        addDrawableChild(new TonariumButton(
                panelX + panelWidth - 31,
                panelY + 12,
                19,
                19,
                Text.literal("×"),
                TonariumButton.Style.CLOSE,
                MAGENTA,
                this::close
        ));
    }

    private void selectCategory(KodexCategory newCategory) {
        category = newCategory;
        selectedEntry = entriesForCategory().getFirst();
        rebuildWidgets();
    }

    private void selectEntry(KodexEntry entry) {
        selectedEntry = entry;
        rebuildWidgets();
    }

    private void scrollCategories(int direction) {
        int maxScroll = Math.max(0, KodexCategory.values().length - visibleCategoryCount());
        int target = Math.clamp(categoryScroll + direction, 0, maxScroll);
        if (target != categoryScroll) {
            categoryScroll = target;
            rebuildWidgets();
        }
    }

    private void movePage(int direction) {
        List<KodexEntry> categoryEntries = entriesForCategory();
        int index = categoryEntries.indexOf(selectedEntry);
        int target = Math.max(0, Math.min(categoryEntries.size() - 1, index + direction));
        selectedEntry = categoryEntries.get(target);
        rebuildWidgets();
    }

    private List<KodexEntry> entriesForCategory() {
        List<KodexEntry> filtered = entries.stream()
                .filter(entry -> entry.category() == category)
                .toList();
        return filtered.isEmpty() ? entries : filtered;
    }

    private boolean isUnlocked(KodexEntry entry) {
        if (entry.alwaysUnlocked()) {
            return true;
        }
        var player = MinecraftClient.getInstance().player;
        if (player == null) {
            return false;
        }
        if (player.getAbilities().creativeMode) {
            return true;
        }
        return ClientResonanceCache.isCodexPageUnlocked(entries.indexOf(entry));
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float deltaTicks) {
        renderTonariumBackground(context);
        renderFrame(context);
        renderHeader(context);
        renderIndexHeadings(context);
        renderPage(context);
        renderFooter(context);
        super.render(context, mouseX, mouseY, deltaTicks);
    }

    @Override
    public boolean mouseScrolled(
            double mouseX,
            double mouseY,
            double horizontalAmount,
            double verticalAmount
    ) {
        boolean overSidebar = mouseX >= panelX + 5
                && mouseX < panelX + sidebarWidth
                && mouseY >= panelY + (compact ? 40 : 54)
                && mouseY < panelY + panelHeight - 6;
        if (overSidebar && verticalAmount != 0.0D) {
            scrollCategories(verticalAmount > 0.0D ? -1 : 1);
            return true;
        }
        return super.mouseScrolled(mouseX, mouseY, horizontalAmount, verticalAmount);
    }

    private void renderTonariumBackground(DrawContext context) {
        context.fill(0, 0, width, height, INDIGO);
        context.fillGradient(0, 0, width, height, 0xFF24134A, DEEP_INDIGO);

        long time = System.currentTimeMillis() / 80L;
        for (int i = 0; i < 42; i++) {
            int x = Math.floorMod(i * 97 + 31, Math.max(1, width));
            int y = Math.floorMod(i * 53 + 17, Math.max(1, height));
            int pulse = (int) ((time + i * 11L) % 40L);
            int alpha = 45 + Math.abs(20 - pulse) * 3;
            int color = (Math.min(120, alpha) << 24) | (i % 3 == 0 ? 0x5FF5E0 : 0xBFA7FF);
            context.fill(x, y, x + 1, y + 1, color);
        }

        int waveY = panelY + panelHeight + 8;
        for (int x = 0; x < width; x += 4) {
            int y = waveY + (int) (Math.sin((x + time) * 0.055) * 5.0);
            context.fill(x, y, x + 3, y + 1, 0x405FF5E0);
        }
    }

    private void renderFrame(DrawContext context) {
        context.fill(panelX - 2, panelY - 2, panelX + panelWidth + 2, panelY + panelHeight + 2, 0x905FF5E0);
        context.fill(panelX - 1, panelY - 1, panelX + panelWidth + 1, panelY + panelHeight + 1, 0xFFF5C95F);
        context.fill(panelX, panelY, panelX + panelWidth, panelY + panelHeight, PANEL);
        context.fill(panelX + 4, panelY + 4, panelX + panelWidth - 4, panelY + panelHeight - 4, 0x302E1B52);

        int sidebarEdge = panelX + sidebarWidth;
        int indexEdge = sidebarEdge + indexWidth;
        int contentTop = panelY + (compact ? 40 : 54);
        context.fill(panelX + 5, contentTop, sidebarEdge, panelY + panelHeight - 6, 0xA0170D2D);
        context.fill(sidebarEdge, contentTop, sidebarEdge + 1, panelY + panelHeight - 6, 0x805FF5E0);
        context.fill(sidebarEdge + 1, contentTop, indexEdge, panelY + panelHeight - 6, 0x6520163A);
        context.fill(indexEdge, contentTop, indexEdge + 1, panelY + panelHeight - 6, 0x70F5C95F);
    }

    private void renderHeader(DrawContext context) {
        int centerX = panelX + panelWidth / 2;
        context.drawCenteredTextWithShadow(
                textRenderer,
                Text.translatable("kodex.aetherklang.title").formatted(Formatting.BOLD),
                centerX,
                panelY + (compact ? 7 : 13),
                PAPER
        );
        context.drawCenteredTextWithShadow(
                textRenderer,
                Text.translatable("kodex.aetherklang.subtitle"),
                centerX,
                panelY + (compact ? 22 : 30),
                CYAN
        );
        int separatorY = panelY + (compact ? 36 : 49);
        context.fill(panelX + 10, separatorY, panelX + panelWidth - 10, separatorY + 1, 0x80F5C95F);
        if (!compact) {
            context.drawTextWithShadow(textRenderer, Text.literal("♫"), panelX + 16, panelY + 20, GOLD);
            context.drawTextWithShadow(
                    textRenderer,
                    Text.literal("♫"),
                    panelX + panelWidth - 26,
                    panelY + 20,
                    CYAN
            );
        }
    }

    private void renderIndexHeadings(DrawContext context) {
        if (!compact) {
            context.drawTextWithShadow(
                    textRenderer,
                    Text.translatable("kodex.aetherklang.categories").formatted(Formatting.BOLD),
                    panelX + 12,
                    panelY + 55,
                    MUTED
            );
        }
        context.drawTextWithShadow(
                textRenderer,
                category.title().copy().formatted(Formatting.BOLD),
                panelX + sidebarWidth + 10,
                panelY + (compact ? 44 : 61),
                category.accent()
        );
    }

    private void renderPage(DrawContext context) {
        int x = panelX + sidebarWidth + indexWidth + 22;
        int y = panelY + (compact ? 59 : 68);
        int availableWidth = panelWidth - sidebarWidth - indexWidth - 45;
        if (!isUnlocked(selectedEntry)) {
            renderLockedPage(context, x, y, availableWidth);
            return;
        }

        context.drawTextWithShadow(
                textRenderer,
                selectedEntry.title().copy().formatted(Formatting.BOLD),
                x,
                y,
                PAPER
        );
        if (selectedEntry.status().isMarked()) {
            Text status = selectedEntry.status().title().copy().formatted(Formatting.BOLD);
            context.drawTextWithShadow(
                    textRenderer,
                    status,
                    x + availableWidth - textRenderer.getWidth(status),
                    y,
                    selectedEntry.status().accent()
            );
        }
        y += 16;
        context.drawTextWithShadow(textRenderer, selectedEntry.subtitle(), x, y, category.accent());
        y += 16;
        context.fill(x, y, x + availableWidth, y + 1, 0xB0F5C95F);
        y += 12;

        context.enableScissor(x, y, x + availableWidth, panelY + panelHeight - 42);
        for (String bodyKey : selectedEntry.bodyKeys()) {
            List<OrderedText> lines = textRenderer.wrapLines(Text.translatable(bodyKey), availableWidth);
            for (OrderedText line : lines) {
                context.drawTextWithShadow(textRenderer, line, x, y, PAPER);
                y += compact ? 10 : 11;
            }
            y += compact ? 2 : 7;
        }
        context.disableScissor();
    }

    private void renderLockedPage(DrawContext context, int x, int y, int availableWidth) {
        context.drawCenteredTextWithShadow(
                textRenderer,
                Text.literal("◇").formatted(Formatting.BOLD),
                x + availableWidth / 2,
                y + 58,
                MAGENTA
        );
        context.drawCenteredTextWithShadow(
                textRenderer,
                Text.translatable("kodex.aetherklang.locked").formatted(Formatting.BOLD),
                x + availableWidth / 2,
                y + 82,
                PAPER
        );
        for (int i = 0; i < textRenderer.wrapLines(
                Text.translatable("kodex.aetherklang.locked.hint"),
                availableWidth - 28
        ).size(); i++) {
            OrderedText line = textRenderer.wrapLines(
                    Text.translatable("kodex.aetherklang.locked.hint"),
                    availableWidth - 28
            ).get(i);
            context.drawCenteredTextWithShadow(
                    textRenderer,
                    line,
                    x + availableWidth / 2,
                    y + 103 + i * 11,
                    MUTED
            );
        }
    }

    private void renderFooter(DrawContext context) {
        List<KodexEntry> categoryEntries = entriesForCategory();
        int current = Math.max(0, categoryEntries.indexOf(selectedEntry)) + 1;
        Text pageNumber = Text.translatable(
                "kodex.aetherklang.page_number",
                current,
                categoryEntries.size()
        );
        int contentX = panelX + sidebarWidth + indexWidth + 10;
        int contentWidth = panelWidth - sidebarWidth - indexWidth - 20;
        context.drawCenteredTextWithShadow(
                textRenderer,
                pageNumber,
                contentX + contentWidth / 2,
                panelY + panelHeight - 26,
                MUTED
        );
    }

    @Override
    public boolean shouldPause() {
        return false;
    }
}
