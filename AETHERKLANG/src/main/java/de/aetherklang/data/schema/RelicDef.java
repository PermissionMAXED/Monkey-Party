package de.aetherklang.data.schema;

import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;

public record RelicDef(
        String id,
        String operation,
        int cooldownTicks,
        String rarity
) {
    public static final Codec<RelicDef> CODEC = RecordCodecBuilder.create(instance -> instance.group(
            Codec.STRING.fieldOf("id").forGetter(RelicDef::id),
            Codec.STRING.fieldOf("operation").forGetter(RelicDef::operation),
            Codec.INT.optionalFieldOf("cooldown_ticks", 0).forGetter(RelicDef::cooldownTicks),
            Codec.STRING.optionalFieldOf("rarity", "common").forGetter(RelicDef::rarity)
    ).apply(instance, RelicDef::new));
}
