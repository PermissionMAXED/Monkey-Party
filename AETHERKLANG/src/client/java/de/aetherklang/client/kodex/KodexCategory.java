package de.aetherklang.client.kodex;

import net.minecraft.text.Text;

public enum KodexCategory {
    LORE("lore", "✦", 0xFFBFA7FF),
    MOODS("moods", "♫", 0xFF5FF5E0),
    RHYTHM("rhythm", "◆", 0xFFF5C95F),
    INSTRUMENTS("instruments", "♬", 0xFF74D7FF),
    BLOCKS("blocks", "▣", 0xFFC49BFF),
    CREATURES("creatures", "◈", 0xFFE989C4),
    DIMENSION("dimension", "◎", 0xFF8CE7D7),
    BOSS("boss", "♛", 0xFFFF759F),
    TIPS("tips", "?", 0xFFF5C95F),
    ENSEMBLE("ensemble", "♯", 0xFF72E8D8),
    TONARIUM_EXPANSION("tonarium_expansion", "⌂", 0xFF9EDBFF),
    RANKS("ranks", "✧", 0xFFF5C95F),
    CRESCENDO_INSTRUMENTS("crescendo_instruments", "♬", 0xFFFFB45F),
    ARMOR("armor", "◇", 0xFFBFA7FF),
    CRESCENDO_CREATURES("crescendo_creatures", "◉", 0xFFFF87BD);

    private final String id;
    private final String glyph;
    private final int accent;

    KodexCategory(String id, String glyph, int accent) {
        this.id = id;
        this.glyph = glyph;
        this.accent = accent;
    }

    public String id() {
        return id;
    }

    public String glyph() {
        return glyph;
    }

    public int accent() {
        return accent;
    }

    public Text title() {
        return Text.translatable("kodex.aetherklang.category." + id);
    }

    public static KodexCategory byId(String id) {
        for (KodexCategory category : values()) {
            if (category.id.equals(id)) {
                return category;
            }
        }
        return LORE;
    }
}
