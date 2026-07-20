package de.aetherklang.data;

import de.aetherklang.Aetherklang;
import de.aetherklang.motiv.MotivVariantDef;
import java.util.Collection;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import net.minecraft.registry.Registries;
import net.minecraft.util.Identifier;

public final class SchemaValidation {
    private static final Set<String> MOTIV_ARCHETYPES = Set.of(
            "laeufer",
            "schwinge",
            "pulser",
            "koloss",
            "weber",
            "schuetze"
    );

    private SchemaValidation() {
    }

    public static void validate(ContentCatalog catalog) {
        validateIds("instrument", catalog.instruments());
        validateIds("mob", catalog.mobs());
        validateIds("island", catalog.islands());
        validateIds("akkord", catalog.akkorde());
        validateIds("kodex folio", catalog.kodexFolios());
        validateIds("loot tier", catalog.lootTiers());
        validateIds("fx", catalog.fxSpecs());
        validateIds("boss", catalog.bosses());
        validateIds("relic", catalog.relics());

        catalog.instruments().values().forEach(def -> {
            require(def.rpCost() >= 0, "Instrument '" + def.id() + "' has a negative rp_cost");
            require(!def.operations().isEmpty(), "Instrument '" + def.id() + "' needs at least one operation");
        });
        Set<String> variantIds = new HashSet<>();
        catalog.mobs().values().forEach(def -> {
            require(!def.variants().isEmpty(), "Mob '" + def.id() + "' needs at least one variant");
            def.variants().forEach(variant -> validateVariant(def.id(), def.archetype(), variant, variantIds));
        });
        catalog.akkorde().values().forEach(def ->
                require(def.sequence().size() >= 2, "Akkord '" + def.id() + "' needs at least two notes")
        );
        catalog.bosses().values().forEach(def -> {
            require(def.health() > 0.0, "Boss '" + def.id() + "' needs positive health");
            require(!def.score().isEmpty(), "Boss '" + def.id() + "' needs a score");
        });
        catalog.relics().values().forEach(def ->
                require(def.cooldownTicks() >= 0, "Relic '" + def.id() + "' has a negative cooldown")
        );
    }

    private static void validateIds(String type, Map<String, ?> values) {
        Collection<String> ids = values.keySet();
        for (String id : ids) {
            Identifier parsed = Identifier.tryParse(Aetherklang.MOD_ID + ":" + id);
            require(parsed != null && !id.contains(":"), "Invalid " + type + " id '" + id + "'");
        }
    }

    private static void validateVariant(
            String mobId,
            String archetype,
            MotivVariantDef variant,
            Set<String> variantIds
    ) {
        require(
                MOTIV_ARCHETYPES.contains(archetype),
                "Mob '" + mobId + "' has unknown Motiv archetype '" + archetype + "'"
        );
        require(Identifier.tryParse(variant.id()) != null && !variant.id().contains(":"),
                "Mob '" + mobId + "' has invalid variant id '" + variant.id() + "'");
        require(variantIds.add(variant.id()), "Duplicate Motiv variant id '" + variant.id() + "'");
        require(!variant.name().isBlank(), "Motiv variant '" + variant.id() + "' needs a name");
        require(variant.health() > 0.0, "Motiv variant '" + variant.id() + "' needs positive health");
        require(variant.attack() >= 0.0, "Motiv variant '" + variant.id() + "' has negative attack");
        require(variant.movementSpeed() > 0.0, "Motiv variant '" + variant.id() + "' needs positive movement_speed");
        require(variant.scale() >= 0.5F && variant.scale() <= 2.0F,
                "Motiv variant '" + variant.id() + "' scale must be between 0.5 and 2.0");
        require(MotivVariantDef.isRgb(variant.primaryColor()),
                "Motiv variant '" + variant.id() + "' has invalid primary_color");
        require(MotivVariantDef.isRgb(variant.secondaryColor()),
                "Motiv variant '" + variant.id() + "' has invalid secondary_color");
        Identifier lootId = Identifier.tryParse(variant.loot());
        require(lootId != null && Registries.ITEM.containsId(lootId),
                "Motiv variant '" + variant.id() + "' has unknown loot item '" + variant.loot() + "'");
        require(variant.lootMin() >= 0 && variant.lootMax() >= variant.lootMin() && variant.lootMax() <= 64,
                "Motiv variant '" + variant.id() + "' has invalid loot range");
    }

    private static void require(boolean condition, String message) {
        if (!condition) {
            throw new IllegalArgumentException(message);
        }
    }
}
