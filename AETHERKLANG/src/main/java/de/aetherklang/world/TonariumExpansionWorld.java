package de.aetherklang.world;

import de.aetherklang.Aetherklang;
import de.aetherklang.registry.ModBlocks;
import java.util.List;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;

/**
 * Authored Tonarium landmarks beyond the Choral arena.
 *
 * <p>The Kammerton noise generator remains responsible for the surrounding
 * floating terrain. This composer installs a deterministic outer garden ring
 * and the three crystal archives once per dimension.</p>
 */
public final class TonariumExpansionWorld {
    public static final List<BlockPos> GARDEN_CENTERS = List.of(
            new BlockPos(0, 129, 272),
            new BlockPos(40, 133, 257),
            new BlockPos(57, 130, 217),
            new BlockPos(40, 135, 177),
            new BlockPos(0, 131, 160),
            new BlockPos(-40, 134, 177),
            new BlockPos(-57, 128, 217),
            new BlockPos(-40, 132, 257)
    );
    public static final List<BlockPos> ARCHIVE_CENTERS = List.of(
            new BlockPos(-68, 137, 342),
            new BlockPos(0, 142, 394),
            new BlockPos(68, 137, 342)
    );

    private static final BlockPos GARDEN_MARKER = new BlockPos(0, 116, 272);
    private static final BlockPos ARCHIVE_MARKER = new BlockPos(0, 128, 394);
    private static final int UPDATE_FLAGS = Block.NOTIFY_LISTENERS | Block.FORCE_STATE;

    private TonariumExpansionWorld() {
    }

    public static void ensureGenerated(ServerWorld world) {
        if (!KammertonWorld.isKammerton(world)) {
            return;
        }

        if (!world.getBlockState(GARDEN_MARKER).isOf(Blocks.LODESTONE)) {
            Aetherklang.LOGGER.info("Composing the outer Tonarium Resonanzgaerten");
            for (int index = 0; index < GARDEN_CENTERS.size(); index++) {
                placeGarden(world, GARDEN_CENTERS.get(index), 14 + index % 3);
            }
            world.setBlockState(GARDEN_MARKER, Blocks.LODESTONE.getDefaultState(), UPDATE_FLAGS);
        }

        if (!world.getBlockState(ARCHIVE_MARKER).isOf(Blocks.LODESTONE)) {
            Aetherklang.LOGGER.info("Composing the three Tonarium Kristallarchive");
            for (int index = 0; index < ARCHIVE_CENTERS.size(); index++) {
                placeArchive(world, ARCHIVE_CENTERS.get(index), index);
            }

            BlockPos northGarden = GARDEN_CENTERS.getFirst();
            BlockPos westArchive = ARCHIVE_CENTERS.get(0);
            BlockPos crownArchive = ARCHIVE_CENTERS.get(1);
            BlockPos eastArchive = ARCHIVE_CENTERS.get(2);
            placeTaktBridge(world, northGarden, westArchive);
            placeTaktBridge(world, northGarden, eastArchive);
            placeTaktBridge(world, westArchive, crownArchive);
            placeTaktBridge(world, crownArchive, eastArchive);
            world.setBlockState(ARCHIVE_MARKER, Blocks.LODESTONE.getDefaultState(), UPDATE_FLAGS);
        }

        Aetherklang.LOGGER.info(
                "Tonarium expansion ready: gardens near 0/129/272, archives near 0/142/394"
        );
    }

    private static void placeGarden(ServerWorld world, BlockPos center, int radius) {
        clearAuthoredVolume(world, center, radius + 2, 8, 10);
        placeIsland(world, center, radius, true);

        for (int index = 0; index < 18; index++) {
            double angle = Math.PI * 2.0D * index / 18.0D + center.asLong() * 0.0001D;
            int distance = 4 + index % 3 * 3;
            BlockPos flower = center.add(
                    (int) Math.round(Math.cos(angle) * distance),
                    1,
                    (int) Math.round(Math.sin(angle) * distance)
            );
            set(world, flower, ModBlocks.KLANGBLUME);
        }

        for (int direction = 0; direction < 4; direction++) {
            double angle = Math.PI * 0.5D * direction;
            BlockPos lantern = center.add(
                    (int) Math.round(Math.cos(angle) * (radius - 4)),
                    1,
                    (int) Math.round(Math.sin(angle) * (radius - 4))
            );
            set(world, lantern, Blocks.PURPUR_PILLAR);
            set(world, lantern.up(), ModBlocks.KLANGLATERNE);
        }

        placeCrystalPylon(world, center.add(5, 1, 0), ModBlocks.RESONANZKRISTALL_CYAN);
        placeCrystalPylon(world, center.add(-5, 1, 0), ModBlocks.RESONANZKRISTALL_MAGENTA);
        placeCrystalPylon(world, center.add(0, 1, 5), ModBlocks.RESONANZKRISTALL_GOLD);
        placeCrystalPylon(world, center.add(0, 1, -5), ModBlocks.RESONANZKRISTALL_INDIGO);
    }

    private static void placeArchive(ServerWorld world, BlockPos center, int archiveIndex) {
        int radius = 17;
        clearAuthoredVolume(world, center, radius + 2, 9, 13);
        placeIsland(world, center, radius, false);

        for (int x = -5; x <= 5; x++) {
            for (int z = -5; z <= 5; z++) {
                if (x * x + z * z <= 30) {
                    set(
                            world,
                            center.add(x, 0, z),
                            ((x + z) & 1) == 0 ? Blocks.SMOOTH_QUARTZ : Blocks.POLISHED_BLACKSTONE
                    );
                }
            }
        }
        set(world, center.up(), ModBlocks.RESONANZARCHIV);

        Block crystal = switch (archiveIndex) {
            case 0 -> ModBlocks.RESONANZKRISTALL_MAGENTA;
            case 1 -> ModBlocks.RESONANZKRISTALL_GOLD;
            default -> ModBlocks.RESONANZKRISTALL_CYAN;
        };
        placeCrystalPylon(world, center.add(7, 1, 0), crystal);
        placeCrystalPylon(world, center.add(-7, 1, 0), crystal);
        placeCrystalPylon(world, center.add(0, 1, 7), crystal);
        placeCrystalPylon(world, center.add(0, 1, -7), crystal);

        for (int x : new int[]{-4, 4}) {
            for (int z : new int[]{-4, 4}) {
                BlockPos pillar = center.add(x, 1, z);
                for (int y = 0; y < 4; y++) {
                    set(world, pillar.up(y), y == 3 ? ModBlocks.KLANGLATERNE : Blocks.PURPUR_PILLAR);
                }
            }
        }
        for (int x = -4; x <= 4; x++) {
            set(world, center.add(x, 5, -4), Blocks.CHISELED_QUARTZ_BLOCK);
            set(world, center.add(x, 5, 4), Blocks.CHISELED_QUARTZ_BLOCK);
        }
        for (int z = -4; z <= 4; z++) {
            set(world, center.add(-4, 5, z), Blocks.CHISELED_QUARTZ_BLOCK);
            set(world, center.add(4, 5, z), Blocks.CHISELED_QUARTZ_BLOCK);
        }
    }

    private static void placeTaktBridge(ServerWorld world, BlockPos from, BlockPos to) {
        int deltaX = to.getX() - from.getX();
        int deltaY = to.getY() - from.getY();
        int deltaZ = to.getZ() - from.getZ();
        int steps = Math.max(Math.abs(deltaX), Math.abs(deltaZ));
        double length = Math.sqrt((double) deltaX * deltaX + (double) deltaZ * deltaZ);
        double perpendicularX = -deltaZ / length;
        double perpendicularZ = deltaX / length;

        for (int step = 0; step <= steps; step++) {
            double progress = step / (double) steps;
            double x = from.getX() + deltaX * progress;
            double y = from.getY() + deltaY * progress;
            double z = from.getZ() + deltaZ * progress;

            boolean clearPassage = step > 20 && step < steps - 20;
            if (clearPassage) {
                for (int width = -3; width <= 3; width++) {
                    int clearX = (int) Math.round(x + perpendicularX * width);
                    int clearZ = (int) Math.round(z + perpendicularZ * width);
                    for (int height = 1; height <= 4; height++) {
                        world.setBlockState(
                                new BlockPos(clearX, (int) Math.round(y) + height, clearZ),
                                Blocks.AIR.getDefaultState(),
                                UPDATE_FLAGS
                        );
                    }
                }
            }
            for (int width = -1; width <= 1; width++) {
                set(
                        world,
                        new BlockPos(
                                (int) Math.round(x + perpendicularX * width),
                                (int) Math.round(y),
                                (int) Math.round(z + perpendicularZ * width)
                        ),
                        ModBlocks.TAKTBRUECKE
                );
            }

            if (clearPassage && step % 14 == 0) {
                for (int side : new int[]{-3, 3}) {
                    set(
                            world,
                            new BlockPos(
                                    (int) Math.round(x + perpendicularX * side),
                                    (int) Math.round(y) + 1,
                                    (int) Math.round(z + perpendicularZ * side)
                            ),
                            ModBlocks.KLANGLATERNE
                    );
                }
            }
        }
    }

    private static void clearAuthoredVolume(
            ServerWorld world,
            BlockPos center,
            int radius,
            int depth,
            int height
    ) {
        BlockPos.Mutable mutable = new BlockPos.Mutable();
        int radiusSquared = radius * radius;
        for (int x = -radius; x <= radius; x++) {
            for (int z = -radius; z <= radius; z++) {
                if (x * x + z * z > radiusSquared) {
                    continue;
                }
                for (int y = center.getY() - depth; y <= center.getY() + height; y++) {
                    mutable.set(center.getX() + x, y, center.getZ() + z);
                    world.setBlockState(mutable, Blocks.AIR.getDefaultState(), UPDATE_FLAGS);
                }
            }
        }
    }

    private static void placeIsland(ServerWorld world, BlockPos topCenter, int radius, boolean garden) {
        BlockPos.Mutable mutable = new BlockPos.Mutable();
        int depth = Math.max(6, radius / 2);
        for (int layer = 0; layer <= depth; layer++) {
            int layerRadius = Math.max(2, radius - layer * 2);
            int radiusSquared = layerRadius * layerRadius;
            for (int x = -layerRadius; x <= layerRadius; x++) {
                for (int z = -layerRadius; z <= layerRadius; z++) {
                    int edgeNoise = Math.floorMod(
                            (topCenter.getX() + x) * 31 + (topCenter.getZ() + z) * 17 + layer * 13,
                            9
                    );
                    if (x * x + z * z > radiusSquared - edgeNoise) {
                        continue;
                    }
                    mutable.set(topCenter.getX() + x, topCenter.getY() - layer, topCenter.getZ() + z);
                    world.setBlockState(mutable, islandState(x, z, layer, garden), UPDATE_FLAGS);
                }
            }
        }
    }

    private static BlockState islandState(int x, int z, int layer, boolean garden) {
        if (layer == 0) {
            int tone = Math.floorMod(x * 7 + z * 11, 12);
            if (tone == 0) {
                return Blocks.AMETHYST_BLOCK.getDefaultState();
            }
            if (garden) {
                return tone <= 2
                        ? Blocks.CALCITE.getDefaultState()
                        : Blocks.MOSS_BLOCK.getDefaultState();
            }
            return tone <= 3
                    ? Blocks.PURPUR_BLOCK.getDefaultState()
                    : Blocks.POLISHED_BLACKSTONE_BRICKS.getDefaultState();
        }
        if (layer >= 5 && Math.floorMod(x + z + layer, 5) == 0) {
            return Blocks.CRYING_OBSIDIAN.getDefaultState();
        }
        return layer % 3 == 0
                ? Blocks.END_STONE_BRICKS.getDefaultState()
                : Blocks.OBSIDIAN.getDefaultState();
    }

    private static void placeCrystalPylon(ServerWorld world, BlockPos base, Block crystal) {
        set(world, base, Blocks.CHISELED_QUARTZ_BLOCK);
        set(world, base.up(), ModBlocks.KLANGLATERNE);
        set(world, base.up(2), crystal);
    }

    private static void set(ServerWorld world, BlockPos pos, Block block) {
        world.setBlockState(pos, block.getDefaultState(), UPDATE_FLAGS);
    }
}
