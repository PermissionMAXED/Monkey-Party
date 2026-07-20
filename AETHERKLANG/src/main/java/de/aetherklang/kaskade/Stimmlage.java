package de.aetherklang.kaskade;

import java.util.Locale;

/**
 * The four ensemble voices, ordered from highest to lowest register.
 */
public enum Stimmlage {
    SOPRAN,
    ALT,
    TENOR,
    BASS;

    public String asString() {
        return name().toLowerCase(Locale.ROOT);
    }

    public String getTranslationKey() {
        return "stimmlage.aetherklang." + asString();
    }
}
