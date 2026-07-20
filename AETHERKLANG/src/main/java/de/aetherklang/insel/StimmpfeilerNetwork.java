package de.aetherklang.insel;

import de.aetherklang.registry.ModBlocks;
import de.aetherklang.world.KammertonWorld;
import java.util.List;
import net.minecraft.block.BlockState;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.World;

/**
 * Stable five-stop route joining the Overworld hub to all four Klangmeer regions.
 */
public final class StimmpfeilerNetwork {
    private static final List<KammertonStop> KAMMERTON_STOPS = List.of(
            new KammertonStop(
                    KlangmeerRegion.BASSGEWOELBE.anker().add(0, 0, -11),
                    "region.aetherklang.bassgewoelbe"
            ),
            new KammertonStop(
                    KlangmeerRegion.ARPEGGIENMEER.anker().add(0, 0, -13),
                    "region.aetherklang.arpeggienmeer"
            ),
            new KammertonStop(
                    KlangmeerRegion.KAKOPHONIE_RIFF.anker().add(0, 0, -11),
                    "region.aetherklang.kakophonie_riff"
            ),
            new KammertonStop(
                    KlangmeerRegion.GENERALPAUSE_OEDE.anker().add(0, 0, -12),
                    "region.aetherklang.generalpause_oede"
            )
    );
    private static final long SOURCE_RADIUS_SQUARED = 3L * 3L;

    private StimmpfeilerNetwork() {
    }

    public static Route route(ServerWorld sourceWorld, BlockPos source, boolean reverse) {
        MinecraftServer server = sourceWorld.getServer();
        if (server == null) {
            return null;
        }

        int sourceIndex = sourceIndex(sourceWorld, source);
        if (sourceIndex < 0) {
            return null;
        }

        int destinationIndex = Math.floorMod(sourceIndex + (reverse ? -1 : 1), KAMMERTON_STOPS.size() + 1);
        if (destinationIndex == 0) {
            ServerWorld overworld = server.getOverworld();
            List<BlockPos> hubs = OverworldResonanzorte.stimmpfeilerPositions(overworld);
            BlockPos pillar = hubs.isEmpty() ? null : hubs.getFirst();
            return isPillar(overworld, pillar)
                    ? new Route(overworld, pillar, "destination.aetherklang.overworld")
                    : null;
        }

        ServerWorld kammerton = server.getWorld(KammertonWorld.KAMMERTON_KEY);
        if (kammerton == null) {
            return null;
        }
        KammertonStop stop = KAMMERTON_STOPS.get(destinationIndex - 1);
        kammerton.getChunk(stop.pillar);
        return isPillar(kammerton, stop.pillar)
                ? new Route(kammerton, stop.pillar, stop.destinationKey)
                : null;
    }

    private static int sourceIndex(ServerWorld world, BlockPos source) {
        if (world.getRegistryKey().equals(World.OVERWORLD)) {
            for (BlockPos hub : OverworldResonanzorte.stimmpfeilerPositions(world)) {
                if (near(source, hub)) {
                    return 0;
                }
            }
            return -1;
        }
        if (!KammertonWorld.isKammerton(world)) {
            return -1;
        }
        for (int index = 0; index < KAMMERTON_STOPS.size(); index++) {
            if (near(source, KAMMERTON_STOPS.get(index).pillar)) {
                return index + 1;
            }
        }
        return -1;
    }

    private static boolean near(BlockPos first, BlockPos second) {
        return first.getSquaredDistance(second) <= SOURCE_RADIUS_SQUARED;
    }

    private static boolean isPillar(ServerWorld world, BlockPos position) {
        if (position == null) {
            return false;
        }
        BlockState lower = world.getBlockState(position);
        BlockState upper = world.getBlockState(position.up());
        return lower.isOf(ModBlocks.STIMMPFEILER) || upper.isOf(ModBlocks.STIMMPFEILER);
    }

    public record Route(ServerWorld world, BlockPos pillar, String destinationKey) {
    }

    private record KammertonStop(BlockPos pillar, String destinationKey) {
    }
}
