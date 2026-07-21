package de.aetherklang.kanon;

/**
 * The physical accent paired with a mood in a Kanon note.
 */
public enum KanonAction {
    RESONATE,
    STRIKE,
    STIMMGABEL;

    public boolean accepts(KanonAction performed) {
        return this == performed || (this == RESONATE && performed == STIMMGABEL);
    }

    public String getTranslationKey() {
        return "kanon.action.aetherklang." + name().toLowerCase(java.util.Locale.ROOT);
    }
}
