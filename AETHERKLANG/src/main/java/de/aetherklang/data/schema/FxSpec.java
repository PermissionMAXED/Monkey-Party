package de.aetherklang.data.schema;

import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;

public record FxSpec(
        String id,
        String particle,
        String sound,
        int color
) {
    public static final Codec<FxSpec> CODEC = RecordCodecBuilder.create(instance -> instance.group(
            Codec.STRING.fieldOf("id").forGetter(FxSpec::id),
            Codec.STRING.fieldOf("particle").forGetter(FxSpec::particle),
            Codec.STRING.fieldOf("sound").forGetter(FxSpec::sound),
            Codec.INT.optionalFieldOf("color", 0xFFFFFF).forGetter(FxSpec::color)
    ).apply(instance, FxSpec::new));
}
