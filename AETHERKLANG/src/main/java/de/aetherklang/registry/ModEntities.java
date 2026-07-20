package de.aetherklang.registry;

import de.aetherklang.Aetherklang;
import de.aetherklang.entity.ChoralEntity;
import de.aetherklang.entity.DissonanzgeistEntity;
import de.aetherklang.entity.EchonoteEntity;
import de.aetherklang.entity.FermateFeldEntity;
import de.aetherklang.entity.HallwaechterEntity;
import de.aetherklang.entity.SireneEntity;
import de.aetherklang.entity.TaktlingEntity;
import net.fabricmc.fabric.api.biome.v1.BiomeModifications;
import net.fabricmc.fabric.api.biome.v1.BiomeSelectors;
import net.fabricmc.fabric.api.event.player.UseItemCallback;
import net.fabricmc.fabric.api.object.builder.v1.entity.FabricDefaultAttributeRegistry;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.SpawnGroup;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.RegistryKeys;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.ActionResult;

public final class ModEntities {
    public static final String DISSONANZGEIST_ID = "dissonanzgeist";
    public static final String HALLWAECHTER_ID = "hallwaechter";
    public static final String ECHONOTE_ID = "echonote";
    public static final String CHORAL_ID = "choral";
    public static final String SIRENE_ID = "sirene";
    public static final String TAKTLING_ID = "taktling";
    public static final String FERMATE_FELD_ID = "fermate_feld";

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
            register(FERMATE_FELD_ID, SpawnGroup.MISC, 4.0F, 0.25F, 10, 1, true, FermateFeldEntity::new);

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
        BiomeModifications.addSpawn(
                BiomeSelectors.foundInOverworld(),
                SpawnGroup.MONSTER,
                DISSONANZGEIST,
                2,
                1,
                1
        );
        registerHallharfe();
        Aetherklang.LOGGER.debug("Registered {} Aetherklang entity types", 7);
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
