package de.aetherklang.klangwerk;

import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;
import java.util.Map;

public record KlangwerkReloadDef(
        String id,
        KlangwerkType type,
        Map<String, String> parameters
) {
    public static final Codec<KlangwerkReloadDef> CODEC = RecordCodecBuilder.create(instance -> instance.group(
            Codec.STRING.fieldOf("id").forGetter(KlangwerkReloadDef::id),
            KlangwerkType.CODEC.fieldOf("type").forGetter(KlangwerkReloadDef::type),
            Codec.unboundedMap(Codec.STRING, Codec.STRING)
                    .optionalFieldOf("parameters", Map.of())
                    .forGetter(KlangwerkReloadDef::parameters)
    ).apply(instance, KlangwerkReloadDef::new));

    public KlangwerkReloadDef {
        parameters = Map.copyOf(parameters);
    }
}
