package de.aetherklang.block;

import com.mojang.serialization.MapCodec;
import de.aetherklang.registry.ModBlockEntities;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.resonance.ResonanceApi;
import net.minecraft.block.Block;
import net.minecraft.block.BlockRenderType;
import net.minecraft.block.BlockState;
import net.minecraft.block.BlockWithEntity;
import net.minecraft.block.entity.BlockEntity;
import net.minecraft.block.entity.BlockEntityTicker;
import net.minecraft.block.entity.BlockEntityType;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.state.StateManager;
import net.minecraft.state.property.BooleanProperty;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.random.Random;
import net.minecraft.world.World;
import org.jetbrains.annotations.Nullable;

/**
 * Converts the chorus of nearby resonance crystals into a rechargeable RP pulse.
 */
public final class KristallresonatorBlock extends BlockWithEntity {
    public static final MapCodec<KristallresonatorBlock> CODEC = createCodec(KristallresonatorBlock::new);
    public static final BooleanProperty CHARGED = BooleanProperty.of("charged");

    private static final int SEARCH_RADIUS = 5;
    private static final int RECHARGE_TICKS = 20 * 10;

    public KristallresonatorBlock(Settings settings) {
        super(settings);
        setDefaultState(getStateManager().getDefaultState().with(CHARGED, true));
    }

    @Override
    protected MapCodec<? extends KristallresonatorBlock> getCodec() {
        return CODEC;
    }

    @Override
    protected void appendProperties(StateManager.Builder<Block, BlockState> builder) {
        builder.add(CHARGED);
    }

    @Override
    protected BlockRenderType getRenderType(BlockState state) {
        return BlockRenderType.MODEL;
    }

    @Nullable
    @Override
    public BlockEntity createBlockEntity(BlockPos pos, BlockState state) {
        return new KristallresonatorBlockEntity(pos, state);
    }

    @Nullable
    @Override
    public <T extends BlockEntity> BlockEntityTicker<T> getTicker(
            World world,
            BlockState state,
            BlockEntityType<T> type
    ) {
        return validateTicker(
                type,
                ModBlockEntities.KRISTALLRESONATOR,
                KristallresonatorBlockEntity::tick
        );
    }

    @Override
    protected ActionResult onUse(
            BlockState state,
            World world,
            BlockPos pos,
            PlayerEntity player,
            BlockHitResult hit
    ) {
        if (!(world.getBlockEntity(pos) instanceof KristallresonatorBlockEntity resonator)) {
            return ActionResult.PASS;
        }
        if (!(world instanceof ServerWorld serverWorld)
                || !(player instanceof ServerPlayerEntity serverPlayer)) {
            return ActionResult.SUCCESS;
        }
        if (player.isSneaking()) {
            KristallresonatorBlockEntity.HologramMode mode = resonator.cycleHologramMode();
            serverPlayer.sendMessage(
                    Text.translatable(
                            "message.aetherklang.kristallresonator.mode",
                            Text.translatable(mode.getTranslationKey())
                    ),
                    true
            );
            serverWorld.playSound(null, pos, ModSounds.BEAT_TICK, SoundCategory.BLOCKS, 0.55F, 1.7F);
            return ActionResult.SUCCESS_SERVER;
        }
        if (!state.get(CHARGED)) {
            serverPlayer.sendMessage(Text.translatable("message.aetherklang.kristallresonator.recharging"), true);
            return ActionResult.SUCCESS_SERVER;
        }

        int crystals = resonator.refreshCrystalCount(serverWorld);
        if (crystals == 0) {
            serverPlayer.sendMessage(Text.translatable("message.aetherklang.kristallresonator.no_crystals"), true);
            return ActionResult.SUCCESS_SERVER;
        }

        int reward = rewardFor(crystals);
        ResonanceApi.addRp(serverPlayer, reward);
        serverWorld.setBlockState(pos, state.with(CHARGED, false), Block.NOTIFY_ALL);
        serverWorld.scheduleBlockTick(pos, this, RECHARGE_TICKS);
        resonator.beginRecharge(serverWorld.getTime() + RECHARGE_TICKS);
        serverWorld.spawnParticles(
                ModParticles.NOTE_SPARK,
                pos.getX() + 0.5D,
                pos.getY() + 0.75D,
                pos.getZ() + 0.5D,
                8 + crystals * 2,
                0.7D,
                0.55D,
                0.7D,
                0.06D
        );
        serverWorld.playSound(null, pos, ModSounds.RESONANCE_CAST, SoundCategory.BLOCKS, 1.0F, 1.55F);
        serverPlayer.sendMessage(
                Text.translatable("message.aetherklang.kristallresonator.pulse", crystals, reward),
                true
        );
        return ActionResult.SUCCESS_SERVER;
    }

    @Override
    protected void scheduledTick(BlockState state, ServerWorld world, BlockPos pos, Random random) {
        if (!state.get(CHARGED)) {
            world.setBlockState(pos, state.with(CHARGED, true), Block.NOTIFY_ALL);
            if (world.getBlockEntity(pos) instanceof KristallresonatorBlockEntity resonator) {
                resonator.finishRecharge();
                resonator.refreshCrystalCount(world);
            }
            world.spawnParticles(
                    ModParticles.LEITMOTIV_NOTE,
                    pos.getX() + 0.5D,
                    pos.getY() + 0.8D,
                    pos.getZ() + 0.5D,
                    8,
                    0.35D,
                    0.35D,
                    0.35D,
                    0.02D
            );
        }
    }

    @Override
    public void randomDisplayTick(BlockState state, World world, BlockPos pos, Random random) {
        if (state.get(CHARGED) && random.nextInt(4) == 0) {
            world.addParticleClient(
                    ModParticles.LEITMOTIV_NOTE,
                    pos.getX() + 0.25D + random.nextDouble() * 0.5D,
                    pos.getY() + 0.55D + random.nextDouble() * 0.6D,
                    pos.getZ() + 0.25D + random.nextDouble() * 0.5D,
                    0.0D,
                    0.01D,
                    0.0D
            );
        }
    }

    public static int getLightLevel(BlockState state) {
        return state.get(CHARGED) ? 12 : 3;
    }

    static int countCrystals(World world, BlockPos origin) {
        int crystals = 0;
        for (BlockPos target : BlockPos.iterateOutwards(
                origin,
                SEARCH_RADIUS,
                SEARCH_RADIUS,
                SEARCH_RADIUS
        )) {
            if (world.getBlockState(target).getBlock() instanceof ResonanceCrystalBlock) {
                crystals++;
            }
        }
        return crystals;
    }

    static int rewardFor(int crystals) {
        return Math.min(6, Math.max(0, crystals));
    }
}
