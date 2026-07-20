package de.aetherklang.klangwerk;

import com.mojang.serialization.Codec;
import com.mojang.serialization.DataResult;
import java.util.Locale;

public enum KlangwerkType {
    MOTIV,
    AFFIX,
    RELIKT,
    INSEL,
    BOSS,
    AUFTRAG,
    AUFWERTUNG;

    public static final Codec<KlangwerkType> CODEC = Codec.STRING.comapFlatMap(
            KlangwerkType::decode,
            KlangwerkType::asString
    );

    public String asString() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static DataResult<KlangwerkType> decode(String value) {
        for (KlangwerkType type : values()) {
            if (type.asString().equals(value)) {
                return DataResult.success(type);
            }
        }
        return DataResult.error(() -> "Unknown Klangwerk type '" + value + "'");
    }
}
