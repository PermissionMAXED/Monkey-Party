package de.aetherklang.data.schema;

import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;
import java.util.List;

public record KodexFolioDef(
        String id,
        String category,
        int page,
        List<String> unlocks
) {
    public static final Codec<KodexFolioDef> CODEC = RecordCodecBuilder.create(instance -> instance.group(
            Codec.STRING.fieldOf("id").forGetter(KodexFolioDef::id),
            Codec.STRING.fieldOf("category").forGetter(KodexFolioDef::category),
            Codec.INT.fieldOf("page").forGetter(KodexFolioDef::page),
            Codec.STRING.listOf().optionalFieldOf("unlocks", List.of()).forGetter(KodexFolioDef::unlocks)
    ).apply(instance, KodexFolioDef::new));

    public KodexFolioDef {
        unlocks = List.copyOf(unlocks);
    }
}
