package de.aetherklang.insel;

import de.aetherklang.Aetherklang;
import de.aetherklang.registry.ModBlocks;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.WeakHashMap;
import net.minecraft.block.Block;
import net.minecraft.block.Blocks;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.Heightmap;
import net.minecraft.world.World;

/**
 * Two small authored Resonanzorte placed relative to the overworld spawn.
 */
public final class OverworldResonanzorte {
    private static final int[][] SPAWN_OFFSETS = {
            {-36, 28},
            {36, 28}
    };
    private static final int UPDATE_FLAGS = Block.NOTIFY_LISTENERS | Block.FORCE_STATE;
    private static final Set<ServerWorld> COMPLETED_WORLDS =
            Collections.newSetFromMap(new WeakHashMap<>());

    private OverworldResonanzorte() {
    }

    public static void tick(ServerWorld world) {
        if (!world.getRegistryKey().equals(World.OVERWORLD)
                || world.getTime() % 20L != 0L
                || COMPLETED_WORLDS.contains(world)) {
            return;
        }
        ensureGenerated(world);
        COMPLETED_WORLDS.add(world);
    }

    private static void ensureGenerated(ServerWorld world) {
        BlockPos spawn = world.getSpawnPoint().getPos();
        for (int index = 0; index < SPAWN_OFFSETS.length; index++) {
            int x = spawn.getX() + SPAWN_OFFSETS[index][0];
            int z = spawn.getZ() + SPAWN_OFFSETS[index][1];
            BlockPos marker = new BlockPos(x, world.getBottomY() + 2, z);
            if (world.getBlockState(marker).isOf(Blocks.LODESTONE)) {
                continue;
            }

            world.getChunk(x >> 4, z >> 4);
            BlockPos center = world.getTopPosition(
                    Heightmap.Type.MOTION_BLOCKING_NO_LEAVES,
                    new BlockPos(x, spawn.getY(), z)
            );
            placeResonanzort(world, center, index);
            set(world, marker, Blocks.LODESTONE);
            Aetherklang.LOGGER.info(
                    "Overworld Resonanzort {} generated at [{}, {}, {}]",
                    index + 1,
                    center.getX(),
                    center.getY(),
                    center.getZ()
            );
        }
    }

    public static List<BlockPos> stimmpfeilerPositions(ServerWorld world) {
        BlockPos spawn = world.getSpawnPoint().getPos();
        List<BlockPos> positions = new ArrayList<>(SPAWN_OFFSETS.length);
        for (int[] offset : SPAWN_OFFSETS) {
            int x = spawn.getX() + offset[0];
            int z = spawn.getZ() + offset[1];
            world.getChunk(x >> 4, z >> 4);
            BlockPos top = world.getTopPosition(
                    Heightmap.Type.MOTION_BLOCKING_NO_LEAVES,
                    new BlockPos(x, spawn.getY(), z)
            );
            BlockPos pillar = top;
            for (int y = top.getY(); y >= top.getY() - 8; y--) {
                BlockPos candidate = new BlockPos(x, y, z);
                if (world.getBlockState(candidate).isOf(ModBlocks.STIMMPFEILER)) {
                    pillar = world.getBlockState(candidate.down()).isOf(ModBlocks.STIMMPFEILER)
                            ? candidate.down()
                            : candidate;
                    break;
                }
            }
            positions.add(pillar);
        }
        return List.copyOf(positions);
    }

    private static void placeResonanzort(ServerWorld world, BlockPos center, int index) {
        BlockPos floor = center.down();
        int radius = 8;
        int radiusSquared = radius * radius;
        for (int x = -radius; x <= radius; x++) {
            for (int z = -radius; z <= radius; z++) {
                int distanceSquared = x * x + z * z;
                if (distanceSquared > radiusSquared) {
                    continue;
                }
                Block floorBlock = Math.floorMod(x * 5 + z * 7, 11) == 0
                        ? Blocks.AMETHYST_BLOCK
                        : Blocks.POLISHED_BLACKSTONE_BRICKS;
                set(world, floor.add(x, 0, z), floorBlock);
                if (distanceSquared >= 46) {
                    set(world, floor.add(x, -1, z), Blocks.DEEPSLATE_BRICKS);
                }
            }
        }

        placeRing(world, floor, 8, index == 0 ? ModBlocks.RESONANZKRISTALL_CYAN : ModBlocks.RESONANZKRISTALL_MAGENTA);
        placeRing(world, floor, 4, Blocks.GOLD_BLOCK);
        set(world, center, ModBlocks.STIMMPFEILER);
        set(world, center.up(), ModBlocks.STIMMPFEILER);
        set(
                world,
                center.up(2),
                index == 0 ? ModBlocks.RESONANZKRISTALL_GOLD : ModBlocks.RESONANZKRISTALL_INDIGO
        );

        for (int direction = 0; direction < 4; direction++) {
            double angle = Math.PI * 0.5D * direction;
            BlockPos lantern = center.add(
                    (int) Math.round(Math.cos(angle) * 6.0D),
                    0,
                    (int) Math.round(Math.sin(angle) * 6.0D)
            );
            set(world, lantern, Blocks.CHISELED_QUARTZ_BLOCK);
            set(world, lantern.up(), ModBlocks.KLANGLATERNE);
        }
    }

    private static void placeRing(ServerWorld world, BlockPos center, int radius, Block block) {
        int samples = radius * 10;
        for (int index = 0; index < samples; index++) {
            double angle = Math.PI * 2.0D * index / samples;
            set(
                    world,
                    center.add(
                            (int) Math.round(Math.cos(angle) * radius),
                            0,
                            (int) Math.round(Math.sin(angle) * radius)
                    ),
                    block
            );
        }
    }

    private static void set(ServerWorld world, BlockPos position, Block block) {
        world.setBlockState(position, block.getDefaultState(), UPDATE_FLAGS);
    }
}
