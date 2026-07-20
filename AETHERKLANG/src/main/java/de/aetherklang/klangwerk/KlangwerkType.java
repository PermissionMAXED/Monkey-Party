package de.aetherklang.klangwerk;

import com.mojang.serialization.Codec;
import java.util.Locale;

public enum KlangwerkType {
    MOTIV,
    AFFIX,
    RELIKT,
    INSEL,
    BOSS,
    AUFTRAG,
    AUFWERTUNG;

    public static final Codec<KlangwerkType> CODEC = Codec.STRING.xmap(
            value -> KlangwerkType.valueOf(value.toUpperCase(Locale.ROOT)),
            value -> value.name().toLowerCase(Locale.ROOT)
    );
}
