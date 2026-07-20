package de.aetherklang.data;

import de.aetherklang.Aetherklang;
import java.util.Collection;
import java.util.Map;
import net.minecraft.util.Identifier;

public final class SchemaValidation {
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
        catalog.mobs().values().forEach(def -> {
            require(def.health() > 0.0, "Mob '" + def.id() + "' needs positive health");
            require(def.attack() >= 0.0, "Mob '" + def.id() + "' has negative attack");
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

    private static void require(boolean condition, String message) {
        if (!condition) {
            throw new IllegalArgumentException(message);
        }
    }
}
