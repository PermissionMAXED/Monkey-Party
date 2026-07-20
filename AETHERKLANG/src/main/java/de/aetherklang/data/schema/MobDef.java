package de.aetherklang.data.schema;

import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;

public record MobDef(
        String id,
        String archetype,
        double health,
        double attack
) {
    public static final Codec<MobDef> CODEC = RecordCodecBuilder.create(instance -> instance.group(
            Codec.STRING.fieldOf("id").forGetter(MobDef::id),
            Codec.STRING.optionalFieldOf("archetype", "motiv").forGetter(MobDef::archetype),
            Codec.DOUBLE.optionalFieldOf("health", 20.0).forGetter(MobDef::health),
            Codec.DOUBLE.optionalFieldOf("attack", 2.0).forGetter(MobDef::attack)
    ).apply(instance, MobDef::new));
}
