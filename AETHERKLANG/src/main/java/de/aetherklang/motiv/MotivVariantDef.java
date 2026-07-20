package de.aetherklang.motiv;

import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;

/**
 * Data-driven gameplay and presentation values for one Motiv incarnation.
 */
public record MotivVariantDef(
        String id,
        String name,
        double health,
        double attack,
        double movementSpeed,
        float scale,
        String primaryColor,
        String secondaryColor,
        String loot,
        int lootMin,
        int lootMax
) {
    public static final Codec<MotivVariantDef> CODEC = RecordCodecBuilder.create(instance -> instance.group(
            Codec.STRING.fieldOf("id").forGetter(MotivVariantDef::id),
            Codec.STRING.fieldOf("name").forGetter(MotivVariantDef::name),
            Codec.DOUBLE.fieldOf("health").forGetter(MotivVariantDef::health),
            Codec.DOUBLE.fieldOf("attack").forGetter(MotivVariantDef::attack),
            Codec.DOUBLE.fieldOf("movement_speed").forGetter(MotivVariantDef::movementSpeed),
            Codec.FLOAT.optionalFieldOf("scale", 1.0F).forGetter(MotivVariantDef::scale),
            Codec.STRING.fieldOf("primary_color").forGetter(MotivVariantDef::primaryColor),
            Codec.STRING.fieldOf("secondary_color").forGetter(MotivVariantDef::secondaryColor),
            Codec.STRING.fieldOf("loot").forGetter(MotivVariantDef::loot),
            Codec.INT.optionalFieldOf("loot_min", 1).forGetter(MotivVariantDef::lootMin),
            Codec.INT.optionalFieldOf("loot_max", 1).forGetter(MotivVariantDef::lootMax)
    ).apply(instance, MotivVariantDef::new));

    public int primaryRgb() {
        return parseRgb(primaryColor);
    }

    public int secondaryRgb() {
        return parseRgb(secondaryColor);
    }

    public static boolean isRgb(String value) {
        return value != null && value.matches("#[0-9a-fA-F]{6}");
    }

    private static int parseRgb(String value) {
        return Integer.parseUnsignedInt(value.substring(1), 16);
    }
}
