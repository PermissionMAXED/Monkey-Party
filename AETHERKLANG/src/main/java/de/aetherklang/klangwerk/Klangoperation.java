package de.aetherklang.klangwerk;

import com.mojang.serialization.Codec;
import java.util.Locale;

public enum Klangoperation {
    ANSCHLAG,
    HALTEN,
    FREIGABE,
    IMPULS,
    WELLE,
    STRAHL,
    FELD,
    ECHO,
    FERMATE,
    CRESCENDO,
    OSTINATO,
    KADENZ,
    BEWEGUNG,
    SCHUTZ,
    HEILUNG,
    BESCHWOERUNG;

    public static final Codec<Klangoperation> CODEC = Codec.STRING.xmap(
            value -> Klangoperation.valueOf(value.toUpperCase(Locale.ROOT)),
            value -> value.name().toLowerCase(Locale.ROOT)
    );
}
