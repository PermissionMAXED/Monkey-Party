package de.aetherklang.resonance;

import com.mojang.serialization.Codec;
import java.util.Locale;

/**
 * The five resonance moods available to a player.
 */
public enum Stimmung implements ResonanceMood {
    STILLE,
    FREUDE,
    ZORN,
    TRAUER,
    WUNDER;

    public static final Codec<Stimmung> CODEC = Codec.STRING.xmap(Stimmung::fromId, Stimmung::asString);

    public String asString() {
        return name().toLowerCase(Locale.ROOT);
    }

    public String getTranslationKey() {
        return "mood.aetherklang." + asString();
    }

    public static Stimmung fromId(String id) {
        if (id == null) {
            return STILLE;
        }

        try {
            return valueOf(id.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            return STILLE;
        }
    }
}
