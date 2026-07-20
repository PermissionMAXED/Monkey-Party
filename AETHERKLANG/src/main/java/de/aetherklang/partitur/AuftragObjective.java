package de.aetherklang.partitur;

import java.util.Locale;

/**
 * Server-observed actions that can advance a Partitur contract.
 */
public enum AuftragObjective {
    KILL_MOTIV,
    PLAY_AKKORD,
    VISIT_REGION,
    SEAL_RIFT,
    EARN_RESONANCE;

    public String asString() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static AuftragObjective fromString(String value) {
        try {
            return valueOf(value.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Unknown Partitur objective '" + value + "'", exception);
        }
    }
}
