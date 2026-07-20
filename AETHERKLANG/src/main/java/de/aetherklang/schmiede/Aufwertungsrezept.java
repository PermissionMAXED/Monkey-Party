package de.aetherklang.schmiede;

import de.aetherklang.Aetherklang;
import de.aetherklang.klangwerk.KlangwerkReloadDef;
import java.util.LinkedHashMap;
import java.util.Map;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;
import net.minecraft.util.Identifier;

/**
 * Runtime view of an {@code aufwertung} Klangwerk definition.
 */
public record Aufwertungsrezept(
        String id,
        Item instrument,
        Klangstufe from,
        Klangstufe to,
        Map<Item, Integer> ingredients
) {
    public Aufwertungsrezept {
        ingredients = Map.copyOf(ingredients);
        if (!from.canAdvanceTo(to)) {
            throw new IllegalArgumentException("Upgrade '" + id + "' must advance exactly one Klangstufe");
        }
        if (ingredients.size() < 3) {
            throw new IllegalArgumentException("Upgrade '" + id + "' needs ingot, dust, and boss-drop costs");
        }
    }

    public static Aufwertungsrezept decode(KlangwerkReloadDef definition) {
        Map<String, String> parameters = definition.parameters();
        Item instrument = requireItem(parameters, "instrument", definition.id());
        Klangstufe from = Klangstufe.fromId(require(parameters, "from", definition.id()));
        Klangstufe to = Klangstufe.fromId(require(parameters, "to", definition.id()));

        LinkedHashMap<Item, Integer> ingredients = new LinkedHashMap<>();
        ingredients.put(
                requireItem("aetherklang:resonanzbarren", definition.id()),
                positiveInt(parameters, "resonanzbarren", definition.id())
        );
        ingredients.put(
                requireItem("aetherklang:klangstaub", definition.id()),
                positiveInt(parameters, "klangstaub", definition.id())
        );
        ingredients.put(
                requireItem(parameters, "boss_drop", definition.id()),
                positiveInt(parameters, "boss_drop_count", definition.id())
        );

        return new Aufwertungsrezept(definition.id(), instrument, from, to, ingredients);
    }

    public boolean matches(ItemStack stack) {
        return stack.isOf(instrument) && SchmiedeComponents.getTier(stack) == from;
    }

    private static Item requireItem(Map<String, String> parameters, String key, String recipeId) {
        return requireItem(require(parameters, key, recipeId), recipeId);
    }

    private static Item requireItem(String rawId, String recipeId) {
        String qualified = rawId.contains(":") ? rawId : Aetherklang.MOD_ID + ":" + rawId;
        Identifier id = Identifier.tryParse(qualified);
        if (id == null || !Registries.ITEM.containsId(id)) {
            throw new IllegalArgumentException("Upgrade '" + recipeId + "' references unknown item '" + rawId + "'");
        }
        return Registries.ITEM.get(id);
    }

    private static int positiveInt(Map<String, String> parameters, String key, String recipeId) {
        String value = require(parameters, key, recipeId);
        try {
            int parsed = Integer.parseInt(value);
            if (parsed > 0) {
                return parsed;
            }
        } catch (NumberFormatException ignored) {
            // The common error below includes the recipe and parameter names.
        }
        throw new IllegalArgumentException(
                "Upgrade '" + recipeId + "' parameter '" + key + "' must be a positive integer"
        );
    }

    private static String require(Map<String, String> parameters, String key, String recipeId) {
        String value = parameters.get(key);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Upgrade '" + recipeId + "' is missing parameter '" + key + "'");
        }
        return value;
    }
}
