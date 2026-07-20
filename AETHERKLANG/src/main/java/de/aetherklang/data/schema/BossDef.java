package de.aetherklang.data.schema;

import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;
import java.util.List;

public record BossDef(
        String id,
        List<String> score,
        double health,
        String region
) {
    public static final Codec<BossDef> CODEC = RecordCodecBuilder.create(instance -> instance.group(
            Codec.STRING.fieldOf("id").forGetter(BossDef::id),
            Codec.STRING.listOf().optionalFieldOf("score", List.of()).forGetter(BossDef::score),
            Codec.DOUBLE.optionalFieldOf("health", 200.0).forGetter(BossDef::health),
            Codec.STRING.fieldOf("region").forGetter(BossDef::region)
    ).apply(instance, BossDef::new));

    public BossDef {
        score = List.copyOf(score);
    }
}
