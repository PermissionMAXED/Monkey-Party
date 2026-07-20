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
 * authored center of Kammerton.
 */
public final class KlangmeerKomponist {
    public static final int INSEL_ANZAHL = 120;
    public static final BlockPos GENERATION_MARKER = new BlockPos(0, 105, -900);

    private static final int PROCEDURAL_ISLANDS = INSEL_ANZAHL - KlangmeerRegion.values().length;
    private static final int ARCHIPEL_SIZE = 5;
    private static final int ARCHIPEL_COUNT = (PROCEDURAL_ISLANDS + ARCHIPEL_SIZE - 1) / ARCHIPEL_SIZE;
    private static final long COMPOSER_SALT = 0x4B4C414E474D4545L;
    private static final int UPDATE_FLAGS = Block.NOTIFY_LISTENERS | Block.FORCE_STATE;
    private static final InselGenerator GENERATOR = new InselGenerator();

    private KlangmeerKomponist() {
    }

    public static void ensureGenerated(ServerWorld world) {
        if (!KammertonWorld.isKammerton(world) || hasAllMarkers(world)) {
            return;
        }

        long startedAt = System.nanoTime();
        List<InselParameter> score = compose(world.getSeed());
        Map<InselArchetyp, Integer> archetypeCounts = new EnumMap<>(InselArchetyp.class);
        boolean composeFullScore = !world.getBlockState(GENERATION_MARKER).isOf(Blocks.LODESTONE);
        int blocks = 0;
        int generatedIslands = 0;

        Aetherklang.LOGGER.info(
                "Insel-Komponist begins the deterministic Klangmeer score: seed={}, islands={}, full={}",
                world.getSeed(),
                score.size(),
                composeFullScore
        );
        int scoreIndex = 0;
        for (KlangmeerRegion region : KlangmeerRegion.values()) {
            InselParameter parameter = score.get(scoreIndex++);
            if (composeFullScore || !world.getBlockState(region.marker()).isOf(Blocks.LODESTONE)) {
                blocks += GENERATOR.generate(world, parameter);
                generatedIslands++;
                archetypeCounts.merge(parameter.archetyp(), 1, Integer::sum);
                placeStimmpfeilerStub(world, region);
                set(world, region.marker(), Blocks.LODESTONE);
            }
        }
        if (composeFullScore) {
            for (; scoreIndex < score.size(); scoreIndex++) {
                InselParameter parameter = score.get(scoreIndex);
                blocks += GENERATOR.generate(world, parameter);
                generatedIslands++;
                archetypeCounts.merge(parameter.archetyp(), 1, Integer::sum);
            }
        }
        set(world, GENERATION_MARKER, Blocks.LODESTONE);

        long elapsedMillis = (System.nanoTime() - startedAt) / 1_000_000L;
        Aetherklang.LOGGER.info(
                "Klangmeer composed: {} of {} islands, {} archetypes, {} blocks in {} ms; four region anchors ready",
                generatedIslands,
                score.size(),
                archetypeCounts.size(),
                blocks,
                elapsedMillis
        );
    }

    static List<InselParameter> compose(long worldSeed) {
        long scoreSeed = mix(worldSeed ^ COMPOSER_SALT);
        SplittableRandom random = new SplittableRandom(scoreSeed);
        List<InselParameter> score = new ArrayList<>(INSEL_ANZAHL);

        for (KlangmeerRegion region : KlangmeerRegion.values()) {
            score.add(new InselParameter(
                    region.anker().down(),
                    20,
                    18,
                    10,
                    region.archetyp(),
                    mix(scoreSeed ^ region.anker().asLong())
            ));
        }

        InselArchetyp[] archetypes = InselArchetyp.values();
        int archetypeOffset = random.nextInt(archetypes.length);
        int slot = 0;
        for (int archipel = 0; slot < PROCEDURAL_ISLANDS; archipel++) {
            double beltAngle = Math.PI * 2.0D * archipel / ARCHIPEL_COUNT
                    + random.nextDouble(-0.055D, 0.055D);
            int beltRadius = random.nextInt(790, 961);
            int archipelX = (int) Math.round(Math.cos(beltAngle) * beltRadius);
            int archipelZ = (int) Math.round(Math.sin(beltAngle) * beltRadius);

            int archipelMembers = Math.min(ARCHIPEL_SIZE, PROCEDURAL_ISLANDS - slot);
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
                                    random.nextInt(116, 141),
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
        return List.copyOf(score);
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
