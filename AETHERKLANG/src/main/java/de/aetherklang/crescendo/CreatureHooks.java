package de.aetherklang.crescendo;

import de.aetherklang.entity.TaktlingEntity;
import de.aetherklang.registry.ModEntities;
import de.aetherklang.resonance.BeatEngine;
import de.aetherklang.world.KammertonWorld;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.entity.SpawnReason;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Box;
import net.minecraft.world.Heightmap;

/**
 * Server integration for Crescendo creatures.
 */
public final class CreatureHooks {
    public static final float TAKTLING_GOOD_WINDOW_BONUS = 0.02F;
    public static final double TAKTLING_AURA_RADIUS = 12.0D;

    private static final int WILD_TAKTLING_CHECK_INTERVAL = 200;
    private static final int MAX_WILD_TAKTLINGS_NEAR_PLAYER = 4;
    private static boolean registered;

    private CreatureHooks() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;

        OrgelturmStructure.register();
        ServerTickEvents.END_WORLD_TICK.register(CreatureHooks::spawnWildTaktlings);
    }

    public static float getGoodWindow(ServerPlayerEntity player) {
        return getGoodWindow(player, BeatEngine.GOOD_WINDOW);
    }

    public static float getGoodWindow(ServerPlayerEntity player, float baseWindow) {
        return baseWindow + (hasNearbyOwnedTaktling(player) ? TAKTLING_GOOD_WINDOW_BONUS : 0.0F);
    }

    public static boolean hasNearbyOwnedTaktling(ServerPlayerEntity player) {
        Box aura = player.getBoundingBox().expand(TAKTLING_AURA_RADIUS);
        return !player.getEntityWorld().getEntitiesByClass(
                TaktlingEntity.class,
                aura,
                taktling -> taktling.isAlive() && taktling.isOwner(player)
        ).isEmpty();
    }

    private static void spawnWildTaktlings(ServerWorld world) {
        if (!KammertonWorld.isKammerton(world)
                || world.getTime() % WILD_TAKTLING_CHECK_INTERVAL != 0L) {
            return;
        }

        for (ServerPlayerEntity player : world.getPlayers()) {
            Box habitat = player.getBoundingBox().expand(28.0D, 12.0D, 28.0D);
            int nearby = world.getEntitiesByClass(
                    TaktlingEntity.class,
                    habitat,
                    taktling -> taktling.isAlive() && !taktling.isTamed()
            ).size();
            if (nearby >= MAX_WILD_TAKTLINGS_NEAR_PLAYER || world.getRandom().nextInt(3) != 0) {
                continue;
            }

            int offsetX = world.getRandom().nextBetween(-14, 14);
            int offsetZ = world.getRandom().nextBetween(-14, 14);
            BlockPos surface = world.getTopPosition(
                    Heightmap.Type.MOTION_BLOCKING_NO_LEAVES,
                    player.getBlockPos().add(offsetX, 0, offsetZ)
            );
            TaktlingEntity taktling = ModEntities.TAKTLING.create(world, SpawnReason.NATURAL);
            if (taktling != null) {
                taktling.refreshPositionAndAngles(
                        surface.getX() + 0.5D,
                        surface.getY(),
                        surface.getZ() + 0.5D,
                        world.getRandom().nextFloat() * 360.0F,
                        0.0F
                );
                world.spawnEntity(taktling);
            }
        }
    }
}
