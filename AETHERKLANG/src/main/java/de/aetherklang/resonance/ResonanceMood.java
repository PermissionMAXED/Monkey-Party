package de.aetherklang.resonance;

/**
 * Compatibility facade for WP1 item code.
 *
 * @deprecated Use {@link Stimmung}.
 */
@Deprecated(forRemoval = false)
public interface ResonanceMood {
    Stimmung SILENCE = Stimmung.STILLE;
    Stimmung MELODY = Stimmung.WUNDER;
    Stimmung RHYTHM = Stimmung.ZORN;
    Stimmung HARMONY = Stimmung.FREUDE;
    Stimmung DISSONANCE = Stimmung.TRAUER;

    String name();

    static Stimmung[] values() {
        return Stimmung.values();
    }
}
