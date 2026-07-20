package de.aetherklang.data.schema;

import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;
import java.util.List;

public record LootTierDef(
        String id,
        int minRank,
        List<String> entries
) {
    public static final Codec<LootTierDef> CODEC = RecordCodecBuilder.create(instance -> instance.group(
            Codec.STRING.fieldOf("id").forGetter(LootTierDef::id),
            Codec.INT.optionalFieldOf("min_rank", 0).forGetter(LootTierDef::minRank),
            Codec.STRING.listOf().fieldOf("entries").forGetter(LootTierDef::entries)
    ).apply(instance, LootTierDef::new));

    public LootTierDef {
        entries = List.copyOf(entries);
    }
}
