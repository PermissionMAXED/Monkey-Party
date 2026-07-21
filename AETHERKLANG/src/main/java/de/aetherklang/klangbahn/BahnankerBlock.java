package de.aetherklang.klangbahn;

import com.mojang.serialization.MapCodec;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.resonance.BeatEngine;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.state.StateManager;
import net.minecraft.state.property.BooleanProperty;
import net.minecraft.state.property.Properties;
import net.minecraft.util.ActionResult;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.random.Random;
import net.minecraft.world.World;

/**
 * A beat-lit station that links to the nearest attuned Stimmpfeiler.
 */
public final class BahnankerBlock extends Block {
    public static final MapCodec<BahnankerBlock> CODEC = createCodec(BahnankerBlock::new);
    public static final BooleanProperty LIT = Properties.LIT;

    private static final int PULSE_TICKS = 2;

    public BahnankerBlock(Settings settings) {
        super(settings);
        setDefaultState(getStateManager().getDefaultState().with(LIT, false));
    }

    @Override
    protected MapCodec<? extends BahnankerBlock> getCodec() {
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
            if (lit) {
                world.spawnParticles(
                        ModParticles.BEAT_RING,
                        pos.getX() + 0.5D,
                        pos.getY() + 0.8D,
                        pos.getZ() + 0.5D,
                        8,
                        0.4D,
                        0.25D,
                        0.4D,
                        0.025D
                );
                world.playSound(null, pos, ModSounds.BEAT_TICK, SoundCategory.BLOCKS, 0.3F, 1.6F);
            }
        }

        int delay = lit ? PULSE_TICKS - phase : ticksPerBeat - phase;
        world.scheduleBlockTick(pos, this, Math.max(1, delay));
    }

    @Override
    protected ActionResult onUse(
            BlockState state,
            World world,
            BlockPos pos,
            PlayerEntity player,
            BlockHitResult hit
    ) {
        if (!(world instanceof ServerWorld serverWorld) || !(player instanceof ServerPlayerEntity serverPlayer)) {
            return ActionResult.SUCCESS;
        }
        KlangbahnService.boardFromAnchor(serverWorld, pos, serverPlayer);
        return ActionResult.SUCCESS_SERVER;
    }

    @Override
    public void randomDisplayTick(BlockState state, World world, BlockPos pos, Random random) {
        if (!state.get(LIT) || random.nextInt(2) != 0) {
            return;
        }
        world.addParticleClient(
                ModParticles.BEAM_MOTE,
                pos.getX() + 0.2D + random.nextDouble() * 0.6D,
                pos.getY() + 0.45D + random.nextDouble() * 0.85D,
                pos.getZ() + 0.2D + random.nextDouble() * 0.6D,
                0.0D,
                0.025D,
                0.0D
        );
    }

    public static int getLightLevel(BlockState state) {
        return state.get(LIT) ? 15 : 5;
    }
}
