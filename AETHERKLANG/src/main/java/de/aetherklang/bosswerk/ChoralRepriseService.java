package de.aetherklang.bosswerk;

import de.aetherklang.Aetherklang;
import de.aetherklang.data.ContentCatalog;
import de.aetherklang.entity.ChoralEntity;
import de.aetherklang.klangwerk.KlangwerkReloadDef;
import de.aetherklang.klangwerk.KlangwerkType;
import de.aetherklang.registry.ModEntities;
import de.aetherklang.world.KammertonWorld;
import java.util.Map;
import net.fabricmc.fabric.api.entity.event.v1.ServerLivingEntityEvents;
import net.minecraft.block.Block;
import net.minecraft.block.Blocks;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;

/**
 * Persists the Generalpause/Choral victory gates and arms one hard-mode reprise.
 */
public final class ChoralRepriseService {
    private static final int UPDATE_FLAGS = Block.NOTIFY_LISTENERS | Block.FORCE_STATE;
    private static final BlockPos GENERALPAUSE_KILL_FLAG = KammertonWorld.ARENA_CENTER.add(-2, -4, 0);
    private static final BlockPos CHORAL_KILL_FLAG = KammertonWorld.ARENA_CENTER.add(0, -4, 0);
    private static final BlockPos REPRISE_STATE = KammertonWorld.ARENA_CENTER.add(2, -4, 0);

    private ChoralRepriseService() {
    }

    public static void register() {
        ServerLivingEntityEvents.AFTER_DEATH.register((entity, damageSource) -> {
            if (!(entity.getEntityWorld() instanceof ServerWorld sourceWorld)) {
                return;
            }
            ServerWorld kammerton = sourceWorld.getServer().getWorld(KammertonWorld.KAMMERTON_KEY);
            if (kammerton == null) {
                return;
            }

            if (entity.getType() == ModEntities.BOSS_GENERALPAUSE) {
                set(kammerton, GENERALPAUSE_KILL_FLAG, Blocks.GOLD_BLOCK);
                Aetherklang.LOGGER.info("Choral-Reprise unlocked by the Generalpause kill flag");
            } else if (entity instanceof ChoralEntity choral && !choral.isReprise()) {
                set(kammerton, CHORAL_KILL_FLAG, Blocks.GOLD_BLOCK);
                Aetherklang.LOGGER.info("Choral victory flag recorded for the Reprise");
            } else {
                return;
            }
            armIfReady(kammerton);
        });
    }

    public static void armIfReady(ServerWorld world) {
        if (!KammertonWorld.isKammerton(world)
                || !world.getBlockState(GENERALPAUSE_KILL_FLAG).isOf(Blocks.GOLD_BLOCK)
                || !world.getBlockState(CHORAL_KILL_FLAG).isOf(Blocks.GOLD_BLOCK)
                || world.getBlockState(REPRISE_STATE).isOf(Blocks.CRYING_OBSIDIAN)) {
            return;
        }
        if (!world.getBlockState(REPRISE_STATE).isOf(Blocks.REINFORCED_DEEPSLATE)) {
            set(world, REPRISE_STATE, Blocks.REINFORCED_DEEPSLATE);
            KammertonWorld.armEncounter(world);
            Aetherklang.LOGGER.info("Choral-Reprise hard mode armed in the Kammerton arena");
        }
    }

    public static boolean isArmed(ServerWorld world) {
        return world.getBlockState(REPRISE_STATE).isOf(Blocks.REINFORCED_DEEPSLATE);
    }

    public static void markSpawned(ServerWorld world) {
        set(world, REPRISE_STATE, Blocks.CRYING_OBSIDIAN);
    }

    public static RepriseAffixes affixes() {
        Map<String, KlangwerkReloadDef> catalog = ContentCatalog.current().klangwerk(KlangwerkType.AFFIX);
        return new RepriseAffixes(
                modifier(catalog, "gepanzert", "armor", 6.0F),
                modifier(catalog, "rasend", "movement_speed", 0.25F),
                modifier(catalog, "dissonant", "attack_damage", 0.30F),
                modifier(catalog, "hallend", "echo_chance", 0.15F),
                modifier(catalog, "vampirisch", "life_steal", 0.20F)
        );
    }

    private static float modifier(
            Map<String, KlangwerkReloadDef> catalog,
            String id,
            String expectedAttribute,
            float fallback
    ) {
        KlangwerkReloadDef definition = catalog.get(id);
        if (definition == null
                || !expectedAttribute.equals(definition.parameters().get("attribute"))) {
            return fallback;
        }
        try {
            return Float.parseFloat(definition.parameters().getOrDefault("modifier", Float.toString(fallback)));
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private static void set(ServerWorld world, BlockPos position, Block block) {
        world.setBlockState(position, block.getDefaultState(), UPDATE_FLAGS);
    }

    public record RepriseAffixes(
            float armorBonus,
            float speedBonus,
            float attackBonus,
            float echoChance,
            float lifeSteal
    ) {
    }
}
