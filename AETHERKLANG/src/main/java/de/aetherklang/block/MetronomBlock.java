package de.aetherklang.block;

import com.mojang.serialization.MapCodec;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.resonance.BeatEngine;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.state.StateManager;
import net.minecraft.state.property.BooleanProperty;
import net.minecraft.state.property.Properties;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.random.Random;
import net.minecraft.world.World;

/**
 * A full-power light and redstone pulse at the start of every world beat.
 */
public final class MetronomBlock extends Block {
    public static final MapCodec<MetronomBlock> CODEC = createCodec(MetronomBlock::new);
    public static final BooleanProperty LIT = Properties.LIT;

    private static final int PULSE_TICKS = 2;

    public MetronomBlock(Settings settings) {
        super(settings);
        setDefaultState(getStateManager().getDefaultState().with(LIT, false));
    }

    @Override
    protected MapCodec<? extends MetronomBlock> getCodec() {
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
        boolean lit = phase < PULSE_TICKS;
        if (state.get(LIT) != lit) {
            world.setBlockState(pos, state.with(LIT, lit), Block.NOTIFY_ALL);
            world.updateNeighbors(pos, this);
            if (lit) {
                world.spawnParticles(
                        ModParticles.BEAT_RING,
                        pos.getX() + 0.5D,
                        pos.getY() + 0.75D,
                        pos.getZ() + 0.5D,
                        7,
                        0.35D,
                        0.25D,
                        0.35D,
                        0.02D
                );
                world.playSound(null, pos, ModSounds.BEAT_TICK, SoundCategory.BLOCKS, 0.45F, 1.25F);
            }
        }

        int delay = lit ? PULSE_TICKS - phase : ticksPerBeat - phase;
        world.scheduleBlockTick(pos, this, Math.max(1, delay));
    }

    @Override
    protected boolean emitsRedstonePower(BlockState state) {
        return true;
    }

    @Override
    protected int getWeakRedstonePower(
            BlockState state,
            net.minecraft.world.BlockView world,
            BlockPos pos,
            net.minecraft.util.math.Direction direction
    ) {
        return state.get(LIT) ? 15 : 0;
    }

    public static int getLightLevel(BlockState state) {
        return state.get(LIT) ? 15 : 2;
    }
}
