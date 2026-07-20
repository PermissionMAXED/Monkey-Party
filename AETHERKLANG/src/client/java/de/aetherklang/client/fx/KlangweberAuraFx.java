package de.aetherklang.client.fx;

import de.aetherklang.crescendo.ArmorHooks;
import de.aetherklang.item.KlangweberHelmItem;
import de.aetherklang.registry.ModBlocks;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.resonance.client.ClientResonanceCache;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.minecraft.block.BlockState;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.particle.DustParticleEffect;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;
import net.minecraft.util.math.random.Random;

/**
 * Piece-scaled Klangweber aura and the helmet's nearby resonance markers.
 */
public final class KlangweberAuraFx {
    private static final int MAX_SOURCE_MARKERS = 16;

    private static int clientTicks;
    private static int observedBeat = Integer.MIN_VALUE;
    private static ClientWorld observedWorld;
    private static boolean registered;

    private KlangweberAuraFx() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        ClientTickEvents.END_CLIENT_TICK.register(KlangweberAuraFx::tick);
    }

    private static void tick(MinecraftClient client) {
        clientTicks++;
        ClientWorld world = client.world;
        ClientPlayerEntity player = client.player;
        if (world == null || player == null) {
            observedWorld = null;
            observedBeat = Integer.MIN_VALUE;
            return;
        }

        int pieces = ArmorHooks.countKlangweberPieces(player);
        if (pieces == 0) {
            observeBeat(world);
            return;
        }

        int sparkInterval = Math.max(2, 8 - pieces);
        if (clientTicks % sparkInterval == 0) {
            spawnSparks(world, player, pieces);
        }
        if (pieces >= 2 && (clientTicks & 1) == 0) {
            spawnFilaments(world, player, pieces - 1);
        }

        int beat = ClientResonanceCache.getLastBeat();
        if (observedWorld != world) {
            observedWorld = world;
            observedBeat = beat;
        } else if (beat != observedBeat) {
            observedBeat = beat;
            if (pieces == 4) {
                spawnFullHalo(world, player, beat);
            }
        }

        if (ArmorHooks.hasHelm(player) && clientTicks % 10 == 0) {
            spawnSourceMarkers(world, player);
        }
    }

    private static void observeBeat(ClientWorld world) {
        int beat = ClientResonanceCache.getLastBeat();
        if (observedWorld != world) {
            observedWorld = world;
        }
        observedBeat = beat;
    }

    private static void spawnSparks(ClientWorld world, ClientPlayerEntity player, int pieces) {
        Random random = world.getRandom();
        double angle = random.nextDouble() * Math.PI * 2.0D;
        double radius = 0.38D + random.nextDouble() * (0.25D + pieces * 0.08D);
        world.addParticleClient(
                ModParticles.NOTE_SPARK,
                player.getX() + Math.cos(angle) * radius,
                player.getY() + 0.18D + random.nextDouble() * 1.75D,
                player.getZ() + Math.sin(angle) * radius,
                -Math.sin(angle) * 0.012D,
                0.018D + pieces * 0.004D,
                Math.cos(angle) * 0.012D
        );
    }

    private static void spawnFilaments(ClientWorld world, ClientPlayerEntity player, int strands) {
        double phase = clientTicks * 0.12D;
        for (int strand = 0; strand < strands; strand++) {
            double angle = phase + strand * Math.PI * 2.0D / strands;
            double radius = 0.58D + Math.sin(phase * 0.7D + strand) * 0.08D;
            double y = player.getY() + 0.28D + Math.floorMod(clientTicks + strand * 7, 28) / 28.0D * 1.55D;
            double x = player.getX() + Math.cos(angle) * radius;
            double z = player.getZ() + Math.sin(angle) * radius;
            int color = strand % 3 == 1 ? FxPalette.GOLD : FxPalette.CYAN;
            world.addParticleClient(
                    new DustParticleEffect(color, 0.72F),
                    x,
                    y,
                    z,
                    -Math.sin(angle) * 0.012D,
                    0.018D,
                    Math.cos(angle) * 0.012D
            );
            world.addParticleClient(
                    ModParticles.BEAM_MOTE,
                    x,
                    y,
                    z,
                    -Math.sin(angle) * 0.014D,
                    0.015D,
                    Math.cos(angle) * 0.014D
            );
        }
    }

    private static void spawnFullHalo(ClientWorld world, ClientPlayerEntity player, int beat) {
        Vec3d center = player.getEntityPos().add(0.0D, player.getHeight() + 0.18D, 0.0D);
        double rotation = beat * 0.38196601125D;
        int points = 32;
        for (int point = 0; point < points; point++) {
            double angle = rotation + point * Math.PI * 2.0D / points;
            double radius = 0.74D + 0.08D * Math.sin(angle * 3.0D);
            double cos = Math.cos(angle);
            double sin = Math.sin(angle);
            world.addParticleClient(
                    point % 4 == 0 ? ModParticles.NOTE_SPARK : ModParticles.BEAT_RING,
                    center.x + cos * radius,
                    center.y + Math.sin(angle * 2.0D) * 0.06D,
                    center.z + sin * radius,
                    cos * 0.035D,
                    0.012D,
                    sin * 0.035D
            );
        }
    }

    private static void spawnSourceMarkers(ClientWorld world, ClientPlayerEntity player) {
        int found = 0;
        for (BlockPos pos : BlockPos.iterateOutwards(
                player.getBlockPos(),
                KlangweberHelmItem.MARKER_HORIZONTAL_RANGE,
                KlangweberHelmItem.MARKER_VERTICAL_RANGE,
                KlangweberHelmItem.MARKER_HORIZONTAL_RANGE
        )) {
            BlockState state = world.getBlockState(pos);
            if (!isResonanceSource(state)) {
                continue;
            }
            spawnSourceMarker(world, pos, found);
            found++;
            if (found >= MAX_SOURCE_MARKERS) {
                return;
            }
        }
    }

    private static boolean isResonanceSource(BlockState state) {
        return state.isOf(ModBlocks.RESONANZKRISTALL_INDIGO)
                || state.isOf(ModBlocks.RESONANZKRISTALL_CYAN)
                || state.isOf(ModBlocks.RESONANZKRISTALL_GOLD)
                || state.isOf(ModBlocks.RESONANZKRISTALL_MAGENTA)
                || state.isOf(ModBlocks.STIMMALTAR)
                || state.isOf(ModBlocks.DISSONANZRISS)
                || state.isOf(ModBlocks.GLOCKENSPIEL_PORTAL)
                || state.isOf(ModBlocks.RESONANZARCHIV);
    }

    private static void spawnSourceMarker(ClientWorld world, BlockPos pos, int marker) {
        double phase = (clientTicks + marker * 5) * 0.18D;
        double x = pos.getX() + 0.5D;
        double y = pos.getY() + 0.72D + Math.sin(phase) * 0.12D;
        double z = pos.getZ() + 0.5D;
        world.addParticleClient(
                new DustParticleEffect(marker % 3 == 0 ? FxPalette.GOLD : FxPalette.CYAN, 1.05F),
                x,
                y,
                z,
                0.0D,
                0.025D,
                0.0D
        );
        world.addParticleClient(
                ModParticles.BEAM_MOTE,
                x,
                y + 0.28D,
                z,
                Math.cos(phase) * 0.012D,
                0.035D,
                Math.sin(phase) * 0.012D
        );
    }
}
