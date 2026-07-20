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
        Map<String, RelicDef> relics
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
    }

    public static ContentCatalog current() {
        return current;
    }

    public static void install(ContentCatalog catalog) {
        current = catalog;
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
                + relics.size();
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
                Map.of()
        );
    }
}
