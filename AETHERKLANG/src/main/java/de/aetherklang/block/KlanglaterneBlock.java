package de.aetherklang.block;

import com.mojang.serialization.MapCodec;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.resonance.BeatEngine;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.state.StateManager;
import net.minecraft.state.property.BooleanProperty;
import net.minecraft.state.property.Properties;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.random.Random;
import net.minecraft.world.World;

/**
 * A Tonarium lantern whose light rises on every shared beat.
 */
public final class KlanglaterneBlock extends Block {
    public static final MapCodec<KlanglaterneBlock> CODEC = createCodec(KlanglaterneBlock::new);
    public static final BooleanProperty LIT = Properties.LIT;

    private static final int PULSE_TICKS = 2;

    public KlanglaterneBlock(Settings settings) {
        super(settings);
        setDefaultState(getStateManager().getDefaultState().with(LIT, false));
    }

    @Override
    protected MapCodec<? extends KlanglaterneBlock> getCodec() {
        return CODEC;
    }

    @Override
    protected void appendProperties(StateManager.Builder<Block, BlockState> builder) {
        builder.add(LIT);
    }

    @Override
    protected void onBlockAdded(
            BlockState state,
            World world,
            BlockPos pos,
            BlockState oldState,
            boolean notify
    ) {
        if (!oldState.isOf(this) && world instanceof ServerWorld serverWorld) {
            serverWorld.scheduleBlockTick(pos, this, 1);
        }
    }

    @Override
    protected void scheduledTick(BlockState state, ServerWorld world, BlockPos pos, Random random) {
        int ticksPerBeat = Math.round(20.0F * 60.0F / BeatEngine.TEMPO_BPM);
        int phase = Math.floorMod(world.getTime(), ticksPerBeat);
        boolean shouldBeLit = phase < PULSE_TICKS;
        if (state.get(LIT) != shouldBeLit) {
            world.setBlockState(pos, state.with(LIT, shouldBeLit), Block.NOTIFY_ALL);
        }

        int delay = shouldBeLit ? PULSE_TICKS - phase : ticksPerBeat - phase;
        world.scheduleBlockTick(pos, this, Math.max(1, delay));
        if (shouldBeLit && !state.get(LIT)) {
            world.spawnParticles(
                    ModParticles.BEAT_RING,
                    pos.getX() + 0.5D,
                    pos.getY() + 0.55D,
                    pos.getZ() + 0.5D,
                    3,
                    0.18D,
                    0.18D,
                    0.18D,
                    0.01D
            );
        }
    }

    public static int getLightLevel(BlockState state) {
        return state.get(LIT) ? 15 : 5;
    }
}
