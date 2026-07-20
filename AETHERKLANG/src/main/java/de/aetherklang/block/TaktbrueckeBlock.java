package de.aetherklang.block;

import com.mojang.serialization.MapCodec;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.resonance.BeatEngine;
import de.aetherklang.resonance.BeatTiming;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.block.ShapeContext;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.random.Random;
import net.minecraft.util.shape.VoxelShape;
import net.minecraft.util.shape.VoxelShapes;
import net.minecraft.world.BlockView;
import net.minecraft.world.World;

/**
 * A bridge segment that becomes tangible on the shared GOOD beat window.
 *
 * <p>Two or more nearby players form a small ensemble and hold the bridge
 * solid between beats, allowing every entity to cross.</p>
 */
public final class TaktbrueckeBlock extends Block {
    public static final MapCodec<TaktbrueckeBlock> CODEC = createCodec(TaktbrueckeBlock::new);

    private static final double ENSEMBLE_RADIUS_SQUARED = 12.0D * 12.0D;
    private static final int REQUIRED_ENSEMBLE_SIZE = 2;

    public TaktbrueckeBlock(Settings settings) {
        super(settings);
    }

    @Override
    protected MapCodec<? extends TaktbrueckeBlock> getCodec() {
        return CODEC;
    }

    @Override
    protected VoxelShape getCollisionShape(
            BlockState state,
            BlockView world,
            BlockPos pos,
            ShapeContext context
    ) {
        return world instanceof World actualWorld && isTangible(actualWorld, pos)
                ? VoxelShapes.fullCube()
                : VoxelShapes.empty();
    }

    @Override
    public void randomDisplayTick(BlockState state, World world, BlockPos pos, Random random) {
        if (isTangible(world, pos) || random.nextInt(2) != 0) {
            return;
        }

        world.addParticleClient(
                ModParticles.FERMATE_GLIMMER,
                pos.getX() + random.nextDouble(),
                pos.getY() + 0.15D + random.nextDouble() * 0.7D,
                pos.getZ() + random.nextDouble(),
                0.0D,
                0.008D,
                0.0D
        );
    }

    public static boolean isTangible(World world, BlockPos pos) {
        return isGoodBeat(world) || hasNearbyEnsemble(world, pos);
    }

    private static boolean isGoodBeat(World world) {
        int ticksPerBeat = Math.round(20.0F * 60.0F / BeatEngine.TEMPO_BPM);
        float phase = Math.floorMod(world.getTime(), ticksPerBeat) / (float) ticksPerBeat;
        return BeatTiming.isWithinWindow(phase, BeatEngine.GOOD_WINDOW);
    }

    private static boolean hasNearbyEnsemble(World world, BlockPos pos) {
        int nearbyPlayers = 0;
        double centerX = pos.getX() + 0.5D;
        double centerY = pos.getY() + 0.5D;
        double centerZ = pos.getZ() + 0.5D;
        for (PlayerEntity player : world.getPlayers()) {
            if (!player.isSpectator()
                    && player.squaredDistanceTo(centerX, centerY, centerZ) <= ENSEMBLE_RADIUS_SQUARED
                    && ++nearbyPlayers >= REQUIRED_ENSEMBLE_SIZE) {
                return true;
            }
        }
        return false;
    }
}
