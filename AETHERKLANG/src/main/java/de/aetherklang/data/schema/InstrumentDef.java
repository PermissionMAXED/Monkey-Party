package de.aetherklang.data.schema;

import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;
import java.util.List;

public record InstrumentDef(
        String id,
        String family,
        int rpCost,
        List<String> operations
) {
    public static final Codec<InstrumentDef> CODEC = RecordCodecBuilder.create(instance -> instance.group(
            Codec.STRING.fieldOf("id").forGetter(InstrumentDef::id),
            Codec.STRING.optionalFieldOf("family", "universal").forGetter(InstrumentDef::family),
            Codec.INT.optionalFieldOf("rp_cost", 0).forGetter(InstrumentDef::rpCost),
            Codec.STRING.listOf().optionalFieldOf("operations", List.of()).forGetter(InstrumentDef::operations)
    ).apply(instance, InstrumentDef::new));

    public InstrumentDef {
        operations = List.copyOf(operations);
    }
}
