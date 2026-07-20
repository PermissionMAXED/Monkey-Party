package de.aetherklang.data.schema;

import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;
import java.util.List;

public record AkkordDef(
        String id,
        List<String> sequence,
        String effect
) {
    public static final Codec<AkkordDef> CODEC = RecordCodecBuilder.create(instance -> instance.group(
            Codec.STRING.fieldOf("id").forGetter(AkkordDef::id),
            Codec.STRING.listOf().fieldOf("sequence").forGetter(AkkordDef::sequence),
            Codec.STRING.fieldOf("effect").forGetter(AkkordDef::effect)
    ).apply(instance, AkkordDef::new));

    public AkkordDef {
        sequence = List.copyOf(sequence);
    }
}
