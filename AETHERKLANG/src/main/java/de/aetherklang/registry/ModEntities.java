package de.aetherklang.registry;

import de.aetherklang.Aetherklang;
import de.aetherklang.bosswerk.BosswerkBossEntity;
import de.aetherklang.entity.ChoralEntity;
import de.aetherklang.entity.DissonanzgeistEntity;
import de.aetherklang.entity.EchonoteEntity;
import de.aetherklang.entity.FermateFeldEntity;
import de.aetherklang.entity.HallwaechterEntity;
import de.aetherklang.entity.SireneEntity;
import de.aetherklang.entity.StubMobEntity;
import de.aetherklang.entity.TaktlingEntity;
import de.aetherklang.motiv.MotivEntity;
import net.fabricmc.fabric.api.biome.v1.BiomeModifications;
import net.fabricmc.fabric.api.biome.v1.BiomeSelectors;
import net.fabricmc.fabric.api.event.player.UseItemCallback;
import net.fabricmc.fabric.api.object.builder.v1.entity.FabricDefaultAttributeRegistry;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.SpawnLocationTypes;
import net.minecraft.entity.SpawnGroup;
import net.minecraft.entity.SpawnRestriction;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.RegistryKeys;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.ActionResult;
import net.minecraft.world.Heightmap;

public final class ModEntities {
    public static final String DISSONANZGEIST_ID = "dissonanzgeist";
    public static final String HALLWAECHTER_ID = "hallwaechter";
    public static final String ECHONOTE_ID = "echonote";
    public static final String CHORAL_ID = "choral";
    public static final String SIRENE_ID = "sirene";
    public static final String TAKTLING_ID = "taktling";
    public static final String FERMATE_FELD_ID = "fermate_feld";
    public static final String MOTIV_LAEUFER_ID = "motiv_laeufer";
    public static final String MOTIV_SCHWINGE_ID = "motiv_schwinge";
    public static final String MOTIV_PULSER_ID = "motiv_pulser";
    public static final String BOSS_TREMOLO_ID = "boss_tremolo";
    public static final String BOSS_GLISSANDA_ID = "boss_glissanda";
    public static final String BOSS_KAKOPHON_ID = "boss_kakophon";
    public static final String BOSS_GENERALPAUSE_ID = "boss_generalpause";

    public static final EntityType<DissonanzgeistEntity> DISSONANZGEIST =
            register(DISSONANZGEIST_ID, SpawnGroup.MONSTER, 0.9F, 1.25F, 10, 3, false, DissonanzgeistEntity::new);
    public static final EntityType<HallwaechterEntity> HALLWAECHTER =
            register(HALLWAECHTER_ID, SpawnGroup.CREATURE, 1.2F, 2.8F, 10, 3, false, HallwaechterEntity::new);
    public static final EntityType<EchonoteEntity> ECHONOTE =
            register(ECHONOTE_ID, SpawnGroup.MISC, 0.35F, 0.35F, 8, 1, true, EchonoteEntity::new);
    public static final EntityType<ChoralEntity> CHORAL =
            register(CHORAL_ID, SpawnGroup.MONSTER, 3.6F, 4.5F, 16, 2, false, ChoralEntity::new);
    public static final EntityType<SireneEntity> SIRENE =
            register(SIRENE_ID, SpawnGroup.CREATURE, 0.8F, 1.9F, 10, 3, false, SireneEntity::new);
    public static final EntityType<TaktlingEntity> TAKTLING =
            register(TAKTLING_ID, SpawnGroup.CREATURE, 0.6F, 0.9F, 8, 3, false, TaktlingEntity::new);
    public static final EntityType<FermateFeldEntity> FERMATE_FELD =
            register(FERMATE_FELD_ID, SpawnGroup.MISC, 0.35F, 0.35F, 10, 1, true, FermateFeldEntity::new);
    public static final EntityType<MotivEntity> MOTIV_LAEUFER = register(
            MOTIV_LAEUFER_ID,
            SpawnGroup.MONSTER,
            0.75F,
            1.7F,
            10,
            3,
            false,
            (type, world) -> new MotivEntity(type, world, "laeufer")
    );
    public static final EntityType<MotivEntity> MOTIV_SCHWINGE = register(
            MOTIV_SCHWINGE_ID,
            SpawnGroup.MONSTER,
            0.9F,
            1.1F,
            10,
            3,
            false,
            (type, world) -> new MotivEntity(type, world, "schwinge")
    );
    public static final EntityType<MotivEntity> MOTIV_PULSER = register(
            MOTIV_PULSER_ID,
            SpawnGroup.MONSTER,
            1.0F,
            1.0F,
            10,
            3,
            false,
            (type, world) -> new MotivEntity(type, world, "pulser")
    );
    public static final EntityType<BosswerkBossEntity> BOSS_TREMOLO =
            register(BOSS_TREMOLO_ID, SpawnGroup.MONSTER, 2.2F, 3.2F, 16, 2, false, BosswerkBossEntity::new);
    public static final EntityType<BosswerkBossEntity> BOSS_GLISSANDA =
            register(BOSS_GLISSANDA_ID, SpawnGroup.MONSTER, 2.2F, 3.2F, 16, 2, false, BosswerkBossEntity::new);
    public static final EntityType<BosswerkBossEntity> BOSS_KAKOPHON =
            register(BOSS_KAKOPHON_ID, SpawnGroup.MONSTER, 2.6F, 3.6F, 16, 2, false, BosswerkBossEntity::new);
    public static final EntityType<BosswerkBossEntity> BOSS_GENERALPAUSE =
            register(BOSS_GENERALPAUSE_ID, SpawnGroup.MONSTER, 2.8F, 4.0F, 16, 2, false, BosswerkBossEntity::new);

    private ModEntities() {
    }

    private static <T extends Entity> EntityType<T> register(
            String path,
            SpawnGroup spawnGroup,
            float width,
            float height,
            int trackingRange,
            int trackingInterval,
            boolean dropsNothing,
            EntityType.EntityFactory<T> factory
    ) {
        RegistryKey<EntityType<?>> key = RegistryKey.of(RegistryKeys.ENTITY_TYPE, Aetherklang.id(path));
        EntityType.Builder<T> builder = EntityType.Builder
                .create(factory, spawnGroup)
                .dimensions(width, height)
                .maxTrackingRange(trackingRange)
                .trackingTickInterval(trackingInterval);
        if (dropsNothing) {
            builder.dropsNothing();
        }
        EntityType<T> type = builder.build(key);
        return Registry.register(Registries.ENTITY_TYPE, key, type);
    }

    public static void register() {
        FabricDefaultAttributeRegistry.register(DISSONANZGEIST, DissonanzgeistEntity.createAttributes());
        FabricDefaultAttributeRegistry.register(HALLWAECHTER, HallwaechterEntity.createAttributes());
        FabricDefaultAttributeRegistry.register(CHORAL, ChoralEntity.createAttributes());
        FabricDefaultAttributeRegistry.register(SIRENE, SireneEntity.createAttributes());
        FabricDefaultAttributeRegistry.register(TAKTLING, TaktlingEntity.createAttributes());
        FabricDefaultAttributeRegistry.register(MOTIV_LAEUFER, MotivEntity.createAttributes());
        FabricDefaultAttributeRegistry.register(MOTIV_SCHWINGE, MotivEntity.createAttributes());
        FabricDefaultAttributeRegistry.register(MOTIV_PULSER, MotivEntity.createAttributes());
        registerMotivSpawnRestriction(MOTIV_LAEUFER);
        registerMotivSpawnRestriction(MOTIV_SCHWINGE);
        registerMotivSpawnRestriction(MOTIV_PULSER);
        FabricDefaultAttributeRegistry.register(BOSS_TREMOLO, BosswerkBossEntity.createAttributes());
        FabricDefaultAttributeRegistry.register(BOSS_GLISSANDA, BosswerkBossEntity.createAttributes());
        FabricDefaultAttributeRegistry.register(BOSS_KAKOPHON, BosswerkBossEntity.createAttributes());
        FabricDefaultAttributeRegistry.register(BOSS_GENERALPAUSE, BosswerkBossEntity.createAttributes());
        BiomeModifications.addSpawn(
                BiomeSelectors.foundInOverworld(),
                SpawnGroup.MONSTER,
                DISSONANZGEIST,
                2,
                1,
                1
        );
        registerHallharfe();
        Aetherklang.LOGGER.debug("Registered {} Aetherklang entity types", 14);
    }

    private static void registerMotivSpawnRestriction(EntityType<MotivEntity> type) {
        SpawnRestriction.register(
                type,
                SpawnLocationTypes.ON_GROUND,
                Heightmap.Type.MOTION_BLOCKING_NO_LEAVES,
                MotivEntity::canSpawnInKammertonRegion
        );
    }

    private static void registerHallharfe() {
        UseItemCallback.EVENT.register((player, world, hand) -> {
            ItemStack stack = player.getStackInHand(hand);
            if (!stack.isOf(ModItems.HALLHARFE)) {
                return ActionResult.PASS;
            }
            if (player.getItemCooldownManager().isCoolingDown(stack)) {
                return ActionResult.PASS;
            }
            if (world instanceof ServerWorld serverWorld) {
                EchonoteEntity note = EchonoteEntity.createForMood(serverWorld, player);
                serverWorld.spawnEntity(note);
                player.getItemCooldownManager().set(stack, 12);
                player.playSound(ModSounds.RESONANCE_CAST, 0.8F, note.isHealing() ? 1.55F : 0.9F);
            }
            return ActionResult.PASS;
        });
    }
}
