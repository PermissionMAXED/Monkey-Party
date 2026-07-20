package de.aetherklang.crescendo;

import de.aetherklang.Aetherklang;
import de.aetherklang.entity.SireneEntity;
import de.aetherklang.registry.ModEntities;
import java.util.Collections;
import java.util.Set;
import java.util.WeakHashMap;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.SpawnReason;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.Heightmap;
import net.minecraft.world.World;

/**
 * Places the authored Orgelturm landmark near overworld spawn.
 *
 * <p>The bell in the facade is a persistent generation marker, so an existing
 * world's tower and defeated Sirene are not recreated on reload.</p>
 */
public final class OrgelturmStructure {
    public static final int SPAWN_OFFSET_X = 96;
    private static final int UPDATE_FLAGS = Block.NOTIFY_LISTENERS | Block.FORCE_STATE;
    private static final int PLATFORM_RADIUS = 7;
    private static final Set<ServerWorld> COMPLETED_WORLDS =
            Collections.newSetFromMap(new WeakHashMap<>());

    private OrgelturmStructure() {
    }

    public static void register() {
        ServerTickEvents.END_WORLD_TICK.register(world -> {
            if (world.getRegistryKey().equals(World.OVERWORLD)
                    && world.getTime() % 20L == 0L
                    && !COMPLETED_WORLDS.contains(world)
                    && ensurePlaced(world)) {
                COMPLETED_WORLDS.add(world);
            }
        });
    }

    public static BlockPos locate(ServerWorld world) {
        BlockPos spawn = world.getSpawnPoint().getPos().add(SPAWN_OFFSET_X, 0, 0);
        world.getChunk(spawn.getX() >> 4, spawn.getZ() >> 4);
        BlockPos surface = world.getTopPosition(Heightmap.Type.MOTION_BLOCKING_NO_LEAVES, spawn);
        return world.getBlockState(surface.add(0, 2, 1)).isOf(Blocks.BELL)
                ? surface.down()
                : surface;
    }

    private static boolean ensurePlaced(ServerWorld world) {
        BlockPos center = locate(world);
        if (center.getY() <= world.getBottomY() + 1) {
            return false;
        }
        if (world.getBlockState(center.add(0, 3, 1)).isOf(Blocks.BELL)) {
            return true;
        }

        buildPlatform(world, center);
        buildOrganFacade(world, center);
        spawnSirene(world, center);
        set(world, center, Blocks.LODESTONE.getDefaultState());
        Aetherklang.LOGGER.info(
                "Orgelturm generated at [{}, {}, {}]",
                center.getX(),
                center.getY(),
                center.getZ()
        );
        return true;
    }

    private static void buildPlatform(ServerWorld world, BlockPos center) {
        for (int x = -PLATFORM_RADIUS; x <= PLATFORM_RADIUS; x++) {
            for (int z = -PLATFORM_RADIUS; z <= PLATFORM_RADIUS; z++) {
                if (x * x + z * z > PLATFORM_RADIUS * PLATFORM_RADIUS) {
                    continue;
                }
                BlockState floor = (Math.abs(x) + Math.abs(z)) % 4 == 0
                        ? Blocks.GILDED_BLACKSTONE.getDefaultState()
                        : Blocks.POLISHED_BLACKSTONE_BRICKS.getDefaultState();
                set(world, center.add(x, 0, z), floor);
                set(world, center.add(x, -1, z), Blocks.DEEPSLATE_BRICKS.getDefaultState());
            }
        }

        for (int x : new int[]{-6, 6}) {
            for (int z : new int[]{-6, 6}) {
                for (int y = 1; y <= 5; y++) {
                    set(world, center.add(x, y, z), Blocks.POLISHED_BLACKSTONE_BRICKS.getDefaultState());
                }
                set(world, center.add(x, 6, z), Blocks.SEA_LANTERN.getDefaultState());
            }
        }
    }

    private static void buildOrganFacade(ServerWorld world, BlockPos center) {
        for (int x = -5; x <= 5; x++) {
            for (int y = 1; y <= 18; y++) {
                if (x == -5 || x == 5 || y == 1 || y == 18) {
                    set(world, center.add(x, y, 5), Blocks.DEEPSLATE_TILES.getDefaultState());
                }
            }
        }

        int[] pipeHeights = {8, 10, 12, 15, 17, 15, 12, 10, 8};
        for (int pipe = 0; pipe < pipeHeights.length; pipe++) {
            int x = pipe - 4;
            int height = pipeHeights[pipe];
            for (int y = 2; y <= height; y++) {
                BlockState state = y % 5 == 0
                        ? Blocks.GOLD_BLOCK.getDefaultState()
                        : copperFor(pipe).getDefaultState();
                set(world, center.add(x, y, 4), state);
            }
            set(world, center.add(x, height + 1, 4), Blocks.SEA_LANTERN.getDefaultState());
        }

        for (int x = -4; x <= 4; x++) {
            set(world, center.add(x, 1, 1), Blocks.CHISELED_POLISHED_BLACKSTONE.getDefaultState());
            set(world, center.add(x, 2, 1), Blocks.GOLD_BLOCK.getDefaultState());
        }
        set(world, center.add(0, 3, 1), Blocks.BELL.getDefaultState());
        set(world, center.add(-2, 3, 1), Blocks.AMETHYST_BLOCK.getDefaultState());
        set(world, center.add(2, 3, 1), Blocks.AMETHYST_BLOCK.getDefaultState());
    }

    private static Block copperFor(int pipe) {
        return switch (pipe % 4) {
            case 0 -> Blocks.CUT_COPPER;
            case 1 -> Blocks.EXPOSED_CUT_COPPER;
            case 2 -> Blocks.WEATHERED_CUT_COPPER;
            default -> Blocks.OXIDIZED_CUT_COPPER;
        };
    }

    private static void spawnSirene(ServerWorld world, BlockPos center) {
        Box towerAirspace = Box.of(Vec3d.ofCenter(center.up(10)), 32.0D, 28.0D, 32.0D);
        if (!world.getEntitiesByClass(SireneEntity.class, towerAirspace, SireneEntity::isAlive).isEmpty()) {
            return;
        }

        SireneEntity sirene = ModEntities.SIRENE.create(world, SpawnReason.STRUCTURE);
        if (sirene == null) {
            return;
        }
        sirene.refreshPositionAndAngles(
                center.getX() + 0.5D,
                center.getY() + 12.0D,
                center.getZ() - 1.5D,
                180.0F,
                0.0F
        );
        world.spawnEntity(sirene);
    }

    private static void set(ServerWorld world, BlockPos pos, BlockState state) {
        world.setBlockState(pos, state, UPDATE_FLAGS);
    }
}
