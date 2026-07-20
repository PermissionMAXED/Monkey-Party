package de.aetherklang.schmiede;

import de.aetherklang.Aetherklang;
import de.aetherklang.data.ContentCatalog;
import de.aetherklang.klangwerk.KlangwerkType;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;

/**
 * Decodes the data-driven Klangwerk upgrade catalog used by the Klangamboss.
 */
public final class SchmiedeRezepte {
    private static final int REQUIRED_RECIPE_COUNT = 6;

    private SchmiedeRezepte() {
    }

    public static void register() {
        ServerLifecycleEvents.SERVER_STARTED.register(server -> {
            List<Aufwertungsrezept> recipes = all();
            validate(recipes);
            Aetherklang.LOGGER.info("Klangschmiede ready: {} upgrade recipes", recipes.size());
        });
    }

    public static List<Aufwertungsrezept> all() {
        return ContentCatalog.current()
                .klangwerk(KlangwerkType.AUFWERTUNG)
                .values()
                .stream()
                .filter(definition -> definition.parameters().containsKey("instrument"))
                .map(Aufwertungsrezept::decode)
                .sorted(Comparator.comparing(Aufwertungsrezept::id))
                .toList();
    }

    public static Optional<Aufwertungsrezept> find(ItemStack instrument) {
        return all().stream().filter(recipe -> recipe.matches(instrument)).findFirst();
    }

    private static void validate(List<Aufwertungsrezept> recipes) {
        if (recipes.size() < REQUIRED_RECIPE_COUNT) {
            throw new IllegalStateException(
                    "Klangschmiede requires at least " + REQUIRED_RECIPE_COUNT
                            + " aufwertung recipes, found " + recipes.size()
            );
        }

        Set<String> steps = new HashSet<>();
        for (Aufwertungsrezept recipe : recipes) {
            String instrumentId = Registries.ITEM.getId(recipe.instrument()).toString();
            String step = instrumentId + ":" + recipe.from().id();
            if (!steps.add(step)) {
                throw new IllegalStateException(
                        "Duplicate Klangschmiede upgrade step for " + instrumentId + " at " + recipe.from().id()
                );
            }
        }
    }
}
