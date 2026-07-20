package de.aetherklang.data.schema;

import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;

public record IslandDef(
        String id,
        String region,
        int anchorX,
        int anchorY,
        int anchorZ
) {
    public static final Codec<IslandDef> CODEC = RecordCodecBuilder.create(instance -> instance.group(
            Codec.STRING.fieldOf("id").forGetter(IslandDef::id),
            Codec.STRING.fieldOf("region").forGetter(IslandDef::region),
            Codec.INT.fieldOf("anchor_x").forGetter(IslandDef::anchorX),
            Codec.INT.fieldOf("anchor_y").forGetter(IslandDef::anchorY),
            Codec.INT.fieldOf("anchor_z").forGetter(IslandDef::anchorZ)
    ).apply(instance, IslandDef::new));
}
