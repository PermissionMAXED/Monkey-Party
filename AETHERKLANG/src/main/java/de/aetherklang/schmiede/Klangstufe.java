package de.aetherklang.schmiede;

import com.mojang.serialization.Codec;
import java.util.Locale;

/**
 * Persistent progression of an instrument forged at the Klangamboss.
 */
public enum Klangstufe {
    BASIS,
    MEISTER,
    VIRTUOS;

    public static final Codec<Klangstufe> CODEC = Codec.STRING.xmap(
            Klangstufe::fromId,
            Klangstufe::id
    );

    public String id() {
        return name().toLowerCase(Locale.ROOT);
    }

    public String translationKey() {
        return "schmiede.aetherklang.stufe." + id();
    }

    public static Klangstufe fromId(String id) {
        for (Klangstufe value : values()) {
            if (value.id().equals(id)) {
                return value;
            }
        }
        throw new IllegalArgumentException("Unknown Klangstufe '" + id + "'");
    }

    public boolean canAdvanceTo(Klangstufe target) {
        return ordinal() + 1 == target.ordinal();
    }
}
