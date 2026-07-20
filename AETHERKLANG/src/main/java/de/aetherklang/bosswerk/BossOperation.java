package de.aetherklang.bosswerk;

import java.util.Locale;

/**
 * Stable operation identifiers understood by JSON boss scores and the boss FX payload.
 */
public enum BossOperation {
    SCHOCKWELLE,
    NOTENRING,
    STRAHL_LINIE,
    STILLE_ZONE,
    BESCHWOERE_MOTIV,
    KAKOPHONIE,
    GLEITSTOSS,
    FERMATE;

    public static BossOperation parse(String value) {
        try {
            return valueOf(value.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Unknown Bosswerk operation '" + value + "'", exception);
        }
    }

    public int networkId() {
        return ordinal();
    }

    public static BossOperation fromNetworkId(int id) {
        BossOperation[] operations = values();
        return id >= 0 && id < operations.length ? operations[id] : SCHOCKWELLE;
    }
}
