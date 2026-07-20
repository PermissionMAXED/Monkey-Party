package de.aetherklang.insel;

import de.aetherklang.registry.ModBlocks;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;

/**
 * Builds tapered, seed-shaped floating islands from {@link InselParameter}.
 */
public final class InselGenerator {
    private static final int UPDATE_FLAGS = Block.NOTIFY_LISTENERS | Block.FORCE_STATE;

    public int generate(ServerWorld world, InselParameter parameter) {
        int placed = placeBody(world, parameter);
        return placed + decorate(world, parameter);
    }

    private int placeBody(ServerWorld world, InselParameter parameter) {
        BlockPos.Mutable mutable = new BlockPos.Mutable();
        int placed = 0;

        for (int layer = 0; layer <= parameter.tiefe(); layer++) {
            double taper = layer / (double) (parameter.tiefe() + 1);
            int radiusX = Math.max(2, (int) Math.round(parameter.radiusX() * (1.0D - taper * 0.78D)));
            int radiusZ = Math.max(2, (int) Math.round(parameter.radiusZ() * (1.0D - taper * 0.78D)));
            double inverseX = 1.0D / (radiusX * (double) radiusX);
            double inverseZ = 1.0D / (radiusZ * (double) radiusZ);

            for (int x = -radiusX; x <= radiusX; x++) {
                for (int z = -radiusZ; z <= radiusZ; z++) {
                    double ellipse = x * (double) x * inverseX + z * (double) z * inverseZ;
                    double roughEdge = 0.88D + tone(parameter.formSeed(), x, layer, z, 17) * 0.012D;
                    if (ellipse > roughEdge) {
                        continue;
                    }

                    mutable.set(
                            parameter.mitte().getX() + x,
                            parameter.mitte().getY() - layer,
                            parameter.mitte().getZ() + z
                    );
                    int materialTone = tone(parameter.formSeed() ^ 0x51A7E5L, x, layer, z, 9);
                    BlockState state = layer == 0
                            ? parameter.archetyp().surface(materialTone)
                            : parameter.archetyp().body(layer, materialTone);
                    world.setBlockState(mutable, state, UPDATE_FLAGS);
                    placed++;
                }
            }
        }
        return placed;
    }

    private int decorate(ServerWorld world, InselParameter parameter) {
        return switch (parameter.archetyp()) {
            case BASSGEWOELBE, KADENZ_BASTION -> bassgewoelbe(world, parameter);
            case ARPEGGIEN_GARTEN, CRESCENDO_SPITZE -> arpeggienGarten(world, parameter);
            case KAKOPHONIE_RIFF, STACCATO_KLIPPEN -> kakophonieRiff(world, parameter);
            case KRISTALLKRANZ, POLYRHYTHMUS_RIFF -> kristallkranz(world, parameter);
            case RESONANZHAIN, LEGATO_HAIN -> resonanzhain(world, parameter);
            case GENERALPAUSE_SCHOLLE, FERMATE_SANKTUARIUM -> generalpauseScholle(world, parameter);
            case ECHO_TERRASSEN, NOCTURNE_ATOLL -> echoTerrassen(world, parameter);
            case TAKT_RONDELL, OSTINATO_STEPPE -> taktRondell(world, parameter);
        };
    }

    private int bassgewoelbe(ServerWorld world, InselParameter parameter) {
        int placed = 0;
        int span = Math.max(3, Math.min(parameter.radiusX(), parameter.radiusZ()) / 2);
        for (int x : new int[]{-span, span}) {
            BlockPos foot = parameter.mitte().add(x, 1, 0);
            placed += column(world, foot, ModBlocks.BASSSCHIEFER_ZIEGEL, 3);
            set(world, foot.up(3), ModBlocks.STIMMPFEILER);
            placed++;
        }
        for (int x = -span; x <= span; x++) {
            set(world, parameter.mitte().add(x, 4, 0), ModBlocks.BASSSCHIEFER_POLIERT);
            placed++;
        }
        return placed;
    }

    private int arpeggienGarten(ServerWorld world, InselParameter parameter) {
        int placed = 0;
        int notes = Math.min(7, parameter.radiusX());
        for (int index = 0; index < notes; index++) {
            int x = index * 2 - notes + 1;
            int height = 1 + index % 4;
            BlockPos base = parameter.mitte().add(x, 1, 0);
            placed += column(world, base, ModBlocks.RESONANZHOLZ, height);
            set(world, base.up(height), index % 2 == 0 ? ModBlocks.KLANGLATERNE : ModBlocks.KLANGBLUME);
            placed++;
        }
        return placed;
    }

    private int kakophonieRiff(ServerWorld world, InselParameter parameter) {
        int placed = 0;
        for (int index = 0; index < 7; index++) {
            double angle = Math.PI * 2.0D * index / 7.0D;
            int distance = 3 + index % 3;
            int height = 2 + tone(parameter.formSeed(), index, 0, 0, 5);
            BlockPos spike = parameter.mitte().add(
                    (int) Math.round(Math.cos(angle) * distance),
                    1,
                    (int) Math.round(Math.sin(angle) * distance)
            );
            placed += column(world, spike, index % 2 == 0 ? Blocks.CRYING_OBSIDIAN : Blocks.MAGMA_BLOCK, height);
            set(world, spike.up(height), Blocks.AMETHYST_CLUSTER);
            placed++;
        }
        return placed;
    }

    private int kristallkranz(ServerWorld world, InselParameter parameter) {
        int placed = 0;
        int distance = Math.max(4, Math.min(parameter.radiusX(), parameter.radiusZ()) - 3);
        Block[] crystals = {
                ModBlocks.RESONANZKRISTALL_CYAN,
                ModBlocks.RESONANZKRISTALL_GOLD,
                ModBlocks.RESONANZKRISTALL_MAGENTA,
                ModBlocks.RESONANZKRISTALL_INDIGO
        };
        for (int index = 0; index < 8; index++) {
            double angle = Math.PI * 2.0D * index / 8.0D;
            BlockPos base = parameter.mitte().add(
                    (int) Math.round(Math.cos(angle) * distance),
                    1,
                    (int) Math.round(Math.sin(angle) * distance)
            );
            set(world, base, Blocks.AMETHYST_BLOCK);
            set(world, base.up(), crystals[index % crystals.length]);
            placed += 2;
        }
        return placed;
    }

    private int resonanzhain(ServerWorld world, InselParameter parameter) {
        int placed = 0;
        int[][] offsets = {{0, 0}, {4, 2}, {-4, 2}, {3, -4}, {-3, -4}};
        for (int index = 0; index < offsets.length; index++) {
            int height = 3 + tone(parameter.formSeed(), index, 1, 0, 3);
            BlockPos trunk = parameter.mitte().add(offsets[index][0], 1, offsets[index][1]);
            placed += column(world, trunk, ModBlocks.RESONANZHOLZ, height);
            set(world, trunk.up(height), ModBlocks.KLANGLATERNE);
            set(world, trunk.up(height - 1).east(), ModBlocks.RESONANZHOLZ_PLANKEN);
            set(world, trunk.up(height - 1).west(), ModBlocks.RESONANZHOLZ_PLANKEN);
            set(world, trunk.up(height - 1).north(), ModBlocks.RESONANZHOLZ_PLANKEN);
            set(world, trunk.up(height - 1).south(), ModBlocks.RESONANZHOLZ_PLANKEN);
            placed += 5;
        }
        return placed;
    }

    private int generalpauseScholle(ServerWorld world, InselParameter parameter) {
        int placed = column(world, parameter.mitte().up(), Blocks.CALCITE, 4);
        set(world, parameter.mitte().up(5), Blocks.SEA_LANTERN);
        return placed + 1;
    }

    private int echoTerrassen(ServerWorld world, InselParameter parameter) {
        int placed = 0;
        int maxRadius = Math.max(4, Math.min(parameter.radiusX(), parameter.radiusZ()) - 2);
        for (int radius = 3; radius <= maxRadius; radius += 3) {
            int samples = radius * 6;
            for (int index = 0; index < samples; index++) {
                double angle = Math.PI * 2.0D * index / samples;
                BlockPos step = parameter.mitte().add(
                        (int) Math.round(Math.cos(angle) * radius),
                        1 + radius / 3 % 2,
                        (int) Math.round(Math.sin(angle) * radius)
                );
                set(world, step, radius % 2 == 0 ? Blocks.PURPUR_BLOCK : Blocks.END_STONE_BRICKS);
                placed++;
            }
        }
        return placed;
    }

    private int taktRondell(ServerWorld world, InselParameter parameter) {
        int placed = 0;
        for (int index = 0; index < 12; index++) {
            double angle = Math.PI * 2.0D * index / 12.0D;
            int distance = 4 + index % 2 * 2;
            BlockPos beat = parameter.mitte().add(
                    (int) Math.round(Math.cos(angle) * distance),
                    1,
                    (int) Math.round(Math.sin(angle) * distance)
            );
            set(world, beat, index % 3 == 0 ? ModBlocks.KLANGLATERNE : Blocks.GOLD_BLOCK);
            placed++;
        }
        set(world, parameter.mitte().up(), ModBlocks.METRONOMBLOCK);
        return placed + 1;
    }

    private int column(ServerWorld world, BlockPos base, Block block, int height) {
        for (int y = 0; y < height; y++) {
            set(world, base.up(y), block);
        }
        return height;
    }

    private void set(ServerWorld world, BlockPos position, Block block) {
        world.setBlockState(position, block.getDefaultState(), UPDATE_FLAGS);
    }

    private static int tone(long seed, int x, int y, int z, int bound) {
        long mixed = seed;
        mixed ^= x * 0x9E3779B97F4A7C15L;
        mixed ^= y * 0xC2B2AE3D27D4EB4FL;
        mixed ^= z * 0x165667B19E3779F9L;
        mixed ^= mixed >>> 30;
        mixed *= 0xBF58476D1CE4E5B9L;
        mixed ^= mixed >>> 27;
        mixed *= 0x94D049BB133111EBL;
        mixed ^= mixed >>> 31;
        return Math.floorMod(mixed, bound);
    }
}
