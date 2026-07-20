package de.aetherklang.bosswerk;

import de.aetherklang.Aetherklang;
import de.aetherklang.registry.ModEntities;
import java.util.List;
import java.util.Map;
import net.minecraft.entity.EntityType;
import net.minecraft.registry.Registries;

public final class Bosswerk {
    private static final List<String> REQUIRED_SCORES = List.of(
            ModEntities.BOSS_TREMOLO_ID,
            ModEntities.BOSS_GLISSANDA_ID,
            ModEntities.BOSS_KAKOPHON_ID,
            ModEntities.BOSS_GENERALPAUSE_ID
    );
    private static Map<String, BossScore> scores = Map.of();

    private Bosswerk() {
    }

    public static void register() {
        if (!scores.isEmpty()) {
            return;
        }
        Map<String, BossScore> loaded = BossScoreLoader.load();
        for (String id : REQUIRED_SCORES) {
            if (!loaded.containsKey(id)) {
                throw new IllegalStateException("Missing required Bosswerk score '" + id + "'");
            }
        }
        scores = loaded;
        Aetherklang.LOGGER.info("Bosswerk loaded {} phase scores with {} operations", scores.size(), BossOperation.values().length);
    }

    public static BossScore scoreFor(EntityType<?> type) {
        String id = Registries.ENTITY_TYPE.getId(type).getPath();
        BossScore score = scores.get(id);
        if (score == null) {
            throw new IllegalStateException("No Bosswerk score registered for entity '" + id + "'");
        }
        return score;
    }
}
