package de.aetherklang.data.schema;

import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;
import de.aetherklang.motiv.MotivVariantDef;
import java.util.List;

public record MobDef(
        String id,
        String archetype,
        List<MotivVariantDef> variants
) {
    public static final Codec<MobDef> CODEC = RecordCodecBuilder.create(instance -> instance.group(
            Codec.STRING.fieldOf("id").forGetter(MobDef::id),
            Codec.STRING.optionalFieldOf("archetype", "motiv").forGetter(MobDef::archetype),
            MotivVariantDef.CODEC.listOf().fieldOf("variants").forGetter(MobDef::variants)
    ).apply(instance, MobDef::new));

    public MobDef {
        variants = List.copyOf(variants);
    }
}
