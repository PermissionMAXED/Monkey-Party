package de.aetherklang.insel;

import de.aetherklang.Aetherklang;
import de.aetherklang.registry.ModBlocks;
import de.aetherklang.world.KammertonWorld;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.SplittableRandom;
import net.minecraft.block.Block;
import net.minecraft.block.Blocks;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;

/**
 * Deterministically composes the broad ring of procedural islands around the
 * authored center of Kammerton and the outer Fermatenring belt.
 */
public final class KlangmeerKomponist {
    public static final int INSEL_ANZAHL = 120;
    public static final int FERMATENRING_ANZAHL = 100;
    public static final int TOTAL_INSEL_ANZAHL = INSEL_ANZAHL + FERMATENRING_ANZAHL;
    public static final BlockPos GENERATION_MARKER = new BlockPos(0, 105, -900);
    public static final BlockPos FERMATENRING_MARKER = new BlockPos(0, 105, -2100);

    private static final KlangmeerRegion[] INNER_AUTHORED_REGIONS = {
            KlangmeerRegion.BASSGEWOELBE,
            KlangmeerRegion.ARPEGGIENMEER,
            KlangmeerRegion.KAKOPHONIE_RIFF,
            KlangmeerRegion.GENERALPAUSE_OEDE
    };
    private static final int PROCEDURAL_ISLANDS = INSEL_ANZAHL - INNER_AUTHORED_REGIONS.length;
    private static final int FERMATENRING_PROCEDURAL = FERMATENRING_ANZAHL - 1;
    private static final int ARCHIPEL_SIZE = 5;
    private static final int ARCHIPEL_COUNT = (PROCEDURAL_ISLANDS + ARCHIPEL_SIZE - 1) / ARCHIPEL_SIZE;
    private static final int FERMATEN_ARCHIPEL_COUNT =
            (FERMATENRING_PROCEDURAL + ARCHIPEL_SIZE - 1) / ARCHIPEL_SIZE;
    private static final long COMPOSER_SALT = 0x4B4C414E474D4545L;
    private static final long FERMATEN_SALT = 0x4645524D4154454EL;
    private static final int UPDATE_FLAGS = Block.NOTIFY_LISTENERS | Block.FORCE_STATE;
    private static final InselGenerator GENERATOR = new InselGenerator();

    private KlangmeerKomponist() {
    }

    public static void ensureGenerated(ServerWorld world) {
        if (!KammertonWorld.isKammerton(world) || hasAllMarkers(world)) {
            return;
        }

        long startedAt = System.nanoTime();
        List<InselParameter> innerScore = composeInner(world.getSeed());
        List<InselParameter> fermatenScore = composeFermatenring(world.getSeed());
        Map<InselArchetyp, Integer> archetypeCounts = new EnumMap<>(InselArchetyp.class);
        boolean composeInner = !world.getBlockState(GENERATION_MARKER).isOf(Blocks.LODESTONE);
        boolean composeFermaten = !world.getBlockState(FERMATENRING_MARKER).isOf(Blocks.LODESTONE);
        int blocks = 0;
        int generatedIslands = 0;

        Aetherklang.LOGGER.info(
                "Insel-Komponist begins the deterministic Klangmeer score: seed={}, inner={}, fermaten={}, fullInner={}, fullFermaten={}",
                world.getSeed(),
                innerScore.size(),
                fermatenScore.size(),
                composeInner,
                composeFermaten
        );

        int scoreIndex = 0;
        for (KlangmeerRegion region : INNER_AUTHORED_REGIONS) {
            InselParameter parameter = innerScore.get(scoreIndex++);
            if (composeInner || !world.getBlockState(region.marker()).isOf(Blocks.LODESTONE)) {
                blocks += GENERATOR.generate(world, parameter);
                generatedIslands++;
                archetypeCounts.merge(parameter.archetyp(), 1, Integer::sum);
                placeStimmpfeilerStub(world, region);
                set(world, region.marker(), Blocks.LODESTONE);
            }
        }
        if (composeInner) {
            for (; scoreIndex < innerScore.size(); scoreIndex++) {
                InselParameter parameter = innerScore.get(scoreIndex);
                blocks += GENERATOR.generate(world, parameter);
                generatedIslands++;
                archetypeCounts.merge(parameter.archetyp(), 1, Integer::sum);
            }
            set(world, GENERATION_MARKER, Blocks.LODESTONE);
        }

        scoreIndex = 0;
        if (composeFermaten) {
            for (; scoreIndex < fermatenScore.size(); scoreIndex++) {
                InselParameter parameter = fermatenScore.get(scoreIndex);
                blocks += GENERATOR.generate(world, parameter);
                generatedIslands++;
                archetypeCounts.merge(parameter.archetyp(), 1, Integer::sum);
            }
            InselParameter anchor = fermatenScore.getFirst();
            placeStimmpfeilerStub(world, KlangmeerRegion.FERMATENRING);
            set(world, KlangmeerRegion.FERMATENRING.marker(), Blocks.LODESTONE);
            set(world, FERMATENRING_MARKER, Blocks.LODESTONE);
            Aetherklang.LOGGER.info(
                    "Fermatenring composed: {} islands anchored near {}",
                    fermatenScore.size(),
                    anchor.mitte()
            );
        }

        long elapsedMillis = (System.nanoTime() - startedAt) / 1_000_000L;
        Aetherklang.LOGGER.info(
                "Klangmeer composed: {} islands, {} archetypes, {} blocks in {} ms",
                generatedIslands,
                archetypeCounts.size(),
                blocks,
                elapsedMillis
        );
    }

    static List<InselParameter> composeInner(long worldSeed) {
        long scoreSeed = mix(worldSeed ^ COMPOSER_SALT);
        SplittableRandom random = new SplittableRandom(scoreSeed);
        List<InselParameter> score = new ArrayList<>(INSEL_ANZAHL);

        for (KlangmeerRegion region : INNER_AUTHORED_REGIONS) {
            score.add(new InselParameter(
                    region.anker().down(),
                    20,
                    18,
                    10,
                    region.archetyp(),
                    mix(scoreSeed ^ region.anker().asLong())
            ));
        }

        appendProceduralBelt(
                score,
                random,
                PROCEDURAL_ISLANDS,
                ARCHIPEL_COUNT,
                790,
                961,
                116,
                141
        );
        return List.copyOf(score);
    }

    static List<InselParameter> composeFermatenring(long worldSeed) {
        long scoreSeed = mix(worldSeed ^ FERMATEN_SALT);
        SplittableRandom random = new SplittableRandom(scoreSeed);
        List<InselParameter> score = new ArrayList<>(FERMATENRING_ANZAHL);
        score.add(new InselParameter(
                KlangmeerRegion.FERMATENRING.anker().down(),
                22,
                20,
                11,
                KlangmeerRegion.FERMATENRING.archetyp(),
                mix(scoreSeed ^ KlangmeerRegion.FERMATENRING.anker().asLong())
        ));
        appendProceduralBelt(
                score,
                random,
                FERMATENRING_PROCEDURAL,
                FERMATEN_ARCHIPEL_COUNT,
                1520,
                1780,
                118,
                146
        );
        return List.copyOf(score);
    }

    private static void appendProceduralBelt(
            List<InselParameter> score,
            SplittableRandom random,
            int proceduralCount,
            int archipelCount,
            int beltRadiusMin,
            int beltRadiusMax,
            int heightMin,
            int heightMax
    ) {
        InselArchetyp[] archetypes = InselArchetyp.values();
        int archetypeOffset = random.nextInt(archetypes.length);
        int slot = 0;
        for (int archipel = 0; slot < proceduralCount; archipel++) {
            double beltAngle = Math.PI * 2.0D * archipel / archipelCount
                    + random.nextDouble(-0.055D, 0.055D);
            int beltRadius = random.nextInt(beltRadiusMin, beltRadiusMax);

            int archipelX = (int) Math.round(Math.cos(beltAngle) * beltRadius);
            int archipelZ = (int) Math.round(Math.sin(beltAngle) * beltRadius);

            int archipelMembers = Math.min(ARCHIPEL_SIZE, proceduralCount - slot);
            for (int member = 0; member < archipelMembers; member++, slot++) {
                InselArchetyp archetype = archetypes[(slot + archetypeOffset) % archetypes.length];
                InselParameter candidate = null;
                for (int attempt = 0; attempt < 16; attempt++) {
                    double localAngle = Math.PI * 2.0D * member / ARCHIPEL_SIZE
                            + random.nextDouble(-0.12D, 0.12D);
                    int localRadius = random.nextInt(36, 57) + attempt * 2;
                    candidate = new InselParameter(
                            new BlockPos(
                                    archipelX + (int) Math.round(Math.cos(localAngle) * localRadius),
                                    random.nextInt(heightMin, heightMax),
                                    archipelZ + (int) Math.round(Math.sin(localAngle) * localRadius)
                            ),
                            random.nextInt(7, 14),
                            random.nextInt(7, 14),
                            random.nextInt(5, 10),
                            archetype,
                            random.nextLong()
                    );
                    if (hasClearance(candidate, score)) {
                        break;
                    }
                }
                score.add(candidate);
            }
        }
    }

    private static boolean hasClearance(InselParameter candidate, List<InselParameter> score) {
        int candidateRadius = Math.max(candidate.radiusX(), candidate.radiusZ());
        for (InselParameter existing : score) {
            int minimum = candidateRadius + Math.max(existing.radiusX(), existing.radiusZ()) + 20;
            long deltaX = candidate.mitte().getX() - existing.mitte().getX();
            long deltaZ = candidate.mitte().getZ() - existing.mitte().getZ();
            if (deltaX * deltaX + deltaZ * deltaZ < minimum * (long) minimum) {
                return false;
            }
        }
        return true;
    }

    private static boolean hasAllMarkers(ServerWorld world) {
        if (!world.getBlockState(GENERATION_MARKER).isOf(Blocks.LODESTONE)) {
            return false;
        }
        if (!world.getBlockState(FERMATENRING_MARKER).isOf(Blocks.LODESTONE)) {
            return false;
        }
        for (KlangmeerRegion region : KlangmeerRegion.values()) {
            if (!world.getBlockState(region.marker()).isOf(Blocks.LODESTONE)) {
                return false;
            }
        }
        return true;
    }

    private static void placeStimmpfeilerStub(ServerWorld world, KlangmeerRegion region) {
        BlockPos anchor = region.anker();
        set(world, anchor.down(), ModBlocks.BASSSCHIEFER_POLIERT);
        set(world, anchor, ModBlocks.STIMMPFEILER);
        set(world, anchor.up(), ModBlocks.STIMMPFEILER);
        Block cap = switch (region) {
            case BASSGEWOELBE -> ModBlocks.RESONANZKRISTALL_INDIGO;
            case ARPEGGIENMEER -> ModBlocks.RESONANZKRISTALL_CYAN;
            case KAKOPHONIE_RIFF -> ModBlocks.RESONANZKRISTALL_MAGENTA;
            case GENERALPAUSE_OEDE -> ModBlocks.RESONANZKRISTALL_GOLD;
            case FERMATENRING -> ModBlocks.RESONANZKRISTALL_INDIGO;
        };
        set(world, anchor.up(2), cap);
    }

    private static void set(ServerWorld world, BlockPos position, Block block) {
        world.setBlockState(position, block.getDefaultState(), UPDATE_FLAGS);
    }

    private static long mix(long value) {
        value ^= value >>> 30;
        value *= 0xBF58476D1CE4E5B9L;
        value ^= value >>> 27;
        value *= 0x94D049BB133111EBL;
        return value ^ value >>> 31;
    }
}
