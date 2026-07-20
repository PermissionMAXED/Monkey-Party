package de.aetherklang.block;

import com.mojang.serialization.MapCodec;
import de.aetherklang.registry.ModItems;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.resonance.ResonanceApi;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.state.StateManager;
import net.minecraft.state.property.BooleanProperty;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.random.Random;
import net.minecraft.world.World;

/**
 * An active anchor suppresses nearby creatures but burdens Resonants with dissonance.
 */
public final class DissonanzankerBlock extends Block {
    public static final MapCodec<DissonanzankerBlock> CODEC = createCodec(DissonanzankerBlock::new);
    public static final BooleanProperty ACTIVE = BooleanProperty.of("active");

    private static final int CLEANSE_COST = 8;
    private static final int PULSE_INTERVAL = 40;
    private static final double RADIUS = 6.0D;

    public DissonanzankerBlock(Settings settings) {
        super(settings);
        setDefaultState(getStateManager().getDefaultState().with(ACTIVE, true));
    }

    @Override
    protected MapCodec<? extends DissonanzankerBlock> getCodec() {
        return CODEC;
    }

    @Override
    protected void appendProperties(StateManager.Builder<Block, BlockState> builder) {
        builder.add(ACTIVE);
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
            serverWorld.scheduleBlockTick(pos, this, PULSE_INTERVAL);
        }
    }

    @Override
    protected void scheduledTick(BlockState state, ServerWorld world, BlockPos pos, Random random) {
        if (!state.get(ACTIVE)) {
            return;
        }

        Box area = Box.of(pos.toCenterPos(), RADIUS * 2.0D, RADIUS * 2.0D, RADIUS * 2.0D);
        for (LivingEntity entity : world.getEntitiesByClass(
                LivingEntity.class,
                area,
                entity -> entity.isAlive() && !entity.isSpectator()
        )) {
            entity.addStatusEffect(new StatusEffectInstance(StatusEffects.WEAKNESS, 60, 0, false, true));
            if (entity instanceof ServerPlayerEntity player) {
                var resonance = ResonanceApi.getData(player);
                resonance.setDissonanz(resonance.getDissonanz() + 0.02F);
                ResonanceApi.sync(player);
            } else {
                entity.addStatusEffect(new StatusEffectInstance(StatusEffects.SLOWNESS, 60, 1, false, true));
            }
        }

        world.spawnParticles(
                ModParticles.DISSONANZ_SMOKE,
                pos.getX() + 0.5D,
                pos.getY() + 0.8D,
                pos.getZ() + 0.5D,
                10,
                0.8D,
                0.45D,
                0.8D,
                0.025D
        );
        world.playSound(null, pos, ModSounds.DISSONANZ_HIT, SoundCategory.BLOCKS, 0.4F, 0.65F);
        world.scheduleBlockTick(pos, this, PULSE_INTERVAL);
    }

    @Override
    protected ActionResult onUseWithItem(
            ItemStack stack,
            BlockState state,
            World world,
            BlockPos pos,
            PlayerEntity player,
            Hand hand,
            BlockHitResult hit
    ) {
        if (!stack.isOf(ModItems.STIMMGABEL)) {
            return ActionResult.PASS;
        }
        if (!(world instanceof ServerWorld serverWorld) || !(player instanceof ServerPlayerEntity serverPlayer)) {
            return ActionResult.SUCCESS;
        }

        boolean active = state.get(ACTIVE);
        if (active && !ResonanceApi.spendRp(serverPlayer, CLEANSE_COST)) {
            serverPlayer.sendMessage(Text.translatable("message.aetherklang.rp.missing", CLEANSE_COST), true);
            return ActionResult.SUCCESS_SERVER;
        }

        serverWorld.setBlockState(pos, state.with(ACTIVE, !active), Block.NOTIFY_ALL);
        if (active) {
            var resonance = ResonanceApi.getData(serverPlayer);
            resonance.setDissonanz(resonance.getDissonanz() - 0.15F);
            ResonanceApi.sync(serverPlayer);
            serverPlayer.sendMessage(Text.translatable("message.aetherklang.dissonanzanker.cleansed"), true);
        } else {
            serverWorld.scheduleBlockTick(pos, this, 1);
            serverPlayer.sendMessage(Text.translatable("message.aetherklang.dissonanzanker.activated"), true);
        }
        serverWorld.playSound(
                null,
                pos,
                active ? ModSounds.RESONANCE_CAST : ModSounds.DISSONANZ_HIT,
                SoundCategory.BLOCKS,
                0.9F,
                active ? 1.4F : 0.7F
        );
        return ActionResult.SUCCESS_SERVER;
    }

    @Override
    public void randomDisplayTick(BlockState state, World world, BlockPos pos, Random random) {
        if (state.get(ACTIVE) && random.nextInt(3) == 0) {
            world.addParticleClient(
                    ModParticles.DISSONANZ_SMOKE,
                    pos.getX() + 0.2D + random.nextDouble() * 0.6D,
                    pos.getY() + 0.4D + random.nextDouble() * 0.7D,
                    pos.getZ() + 0.2D + random.nextDouble() * 0.6D,
                    0.0D,
                    0.01D,
                    0.0D
            );
        }
    }

    public static int getLightLevel(BlockState state) {
        return state.get(ACTIVE) ? 7 : 1;
    }
}
