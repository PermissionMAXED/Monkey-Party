package de.aetherklang.data;

import de.aetherklang.data.schema.AkkordDef;
import de.aetherklang.data.schema.BossDef;
import de.aetherklang.data.schema.FxSpec;
import de.aetherklang.data.schema.InstrumentDef;
import de.aetherklang.data.schema.IslandDef;
import de.aetherklang.data.schema.KodexFolioDef;
import de.aetherklang.data.schema.LootTierDef;
import de.aetherklang.data.schema.MobDef;
import de.aetherklang.data.schema.RelicDef;
import de.aetherklang.klangwerk.KlangwerkReloadDef;
import de.aetherklang.klangwerk.KlangwerkType;
import java.util.EnumMap;
import java.util.Map;

public record ContentCatalog(
        Map<String, InstrumentDef> instruments,
        Map<String, MobDef> mobs,
        Map<String, IslandDef> islands,
        Map<String, AkkordDef> akkorde,
        Map<String, KodexFolioDef> kodexFolios,
        Map<String, LootTierDef> lootTiers,
        Map<String, FxSpec> fxSpecs,
        Map<String, BossDef> bosses,
        Map<String, RelicDef> relics,
        Map<KlangwerkType, Map<String, KlangwerkReloadDef>> klangwerk
) {
    private static volatile ContentCatalog current = empty();

    public ContentCatalog {
        instruments = Map.copyOf(instruments);
        mobs = Map.copyOf(mobs);
        islands = Map.copyOf(islands);
        akkorde = Map.copyOf(akkorde);
        kodexFolios = Map.copyOf(kodexFolios);
        lootTiers = Map.copyOf(lootTiers);
        fxSpecs = Map.copyOf(fxSpecs);
        bosses = Map.copyOf(bosses);
        relics = Map.copyOf(relics);
        klangwerk = copyKlangwerk(klangwerk);
    }

    public static ContentCatalog current() {
        return current;
    }

    public static void install(ContentCatalog catalog) {
        current = catalog;
    }

    public Map<String, KlangwerkReloadDef> klangwerk(KlangwerkType type) {
        return klangwerk.getOrDefault(type, Map.of());
    }

    public ContentCatalog withKlangwerk(Map<KlangwerkType, Map<String, KlangwerkReloadDef>> definitions) {
        return new ContentCatalog(
                instruments,
                mobs,
                islands,
                akkorde,
                kodexFolios,
                lootTiers,
                fxSpecs,
                bosses,
                relics,
                definitions
        );
    }

    public int size() {
        return instruments.size()
                + mobs.size()
                + islands.size()
                + akkorde.size()
                + kodexFolios.size()
                + lootTiers.size()
                + fxSpecs.size()
                + bosses.size()
                + relics.size()
                + klangwerk.values().stream().mapToInt(Map::size).sum();
    }

    private static Map<KlangwerkType, Map<String, KlangwerkReloadDef>> copyKlangwerk(
            Map<KlangwerkType, Map<String, KlangwerkReloadDef>> definitions
    ) {
        EnumMap<KlangwerkType, Map<String, KlangwerkReloadDef>> copy = new EnumMap<>(KlangwerkType.class);
        definitions.forEach((type, values) -> copy.put(type, Map.copyOf(values)));
        return Map.copyOf(copy);
    }

    private static ContentCatalog empty() {
        return new ContentCatalog(
                Map.of(),
                Map.of(),
                Map.of(),
                Map.of(),
                Map.of(),
                Map.of(),
                Map.of(),
                Map.of(),
                Map.of(),
                Map.of()
        );
    }
}
