package de.aetherklang.client.fx;

import de.aetherklang.resonance.Stimmung;

/**
 * Canonical Aetherklang colors for particles, beams, and screen-space effects.
 */
public final class FxPalette {
    public static final int INDIGO = 0x1A1033;
    public static final int CYAN = 0x5FF5E0;
    public static final int GOLD = 0xF5C95F;
    public static final int MAGENTA = 0xE03A8C;

    private FxPalette() {
    }

    public static int primary(Stimmung mood) {
        return switch (mood) {
            case STILLE -> CYAN;
            case FREUDE -> GOLD;
            case ZORN -> MAGENTA;
            case TRAUER -> INDIGO;
            case WUNDER -> CYAN;
        };
    }

    public static int secondary(Stimmung mood) {
        return switch (mood) {
            case STILLE -> INDIGO;
            case FREUDE -> CYAN;
            case ZORN -> GOLD;
            case TRAUER -> MAGENTA;
            case WUNDER -> GOLD;
        };
    }

    public static int withAlpha(int rgb, int alpha) {
        return (alpha & 0xFF) << 24 | rgb & 0xFFFFFF;
    }
}
