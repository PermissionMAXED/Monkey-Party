package de.aetherklang.registry;

import de.aetherklang.Aetherklang;
import de.aetherklang.entity.StubMobEntity;
import net.fabricmc.fabric.api.object.builder.v1.entity.FabricDefaultAttributeRegistry;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.SpawnGroup;
import net.minecraft.entity.mob.MobEntity;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.RegistryKeys;

public final class ModEntities {
    public static final String DISSONANZGEIST_ID = "dissonanzgeist";
    public static final String HALLWAECHTER_ID = "hallwaechter";
    public static final String ECHONOTE_ID = "echonote";
    public static final String CHORAL_ID = "choral";

    public static final EntityType<StubMobEntity> DISSONANZGEIST =
            register(DISSONANZGEIST_ID, SpawnGroup.MONSTER, 0.65F, 1.9F);
    public static final EntityType<StubMobEntity> HALLWAECHTER =
            register(HALLWAECHTER_ID, SpawnGroup.MONSTER, 0.9F, 2.4F);
    public static final EntityType<StubMobEntity> ECHONOTE =
            register(ECHONOTE_ID, SpawnGroup.AMBIENT, 0.35F, 0.35F);
    public static final EntityType<StubMobEntity> CHORAL =
            register(CHORAL_ID, SpawnGroup.MONSTER, 1.4F, 3.2F);

    private ModEntities() {
    }

    private static EntityType<StubMobEntity> register(
            String path,
            SpawnGroup spawnGroup,
            float width,
            float height
    ) {
        RegistryKey<EntityType<?>> key = RegistryKey.of(RegistryKeys.ENTITY_TYPE, Aetherklang.id(path));
        EntityType<StubMobEntity> type = EntityType.Builder
                .create(StubMobEntity::new, spawnGroup)
                .dimensions(width, height)
                .build(key);
        return Registry.register(Registries.ENTITY_TYPE, key, type);
    }

    public static void register() {
        FabricDefaultAttributeRegistry.register(DISSONANZGEIST, MobEntity.createMobAttributes());
        FabricDefaultAttributeRegistry.register(HALLWAECHTER, MobEntity.createMobAttributes());
        FabricDefaultAttributeRegistry.register(ECHONOTE, MobEntity.createMobAttributes());
        FabricDefaultAttributeRegistry.register(CHORAL, MobEntity.createMobAttributes());
        Aetherklang.LOGGER.debug("Registered {} Aetherklang entity types", 4);
    }
}
