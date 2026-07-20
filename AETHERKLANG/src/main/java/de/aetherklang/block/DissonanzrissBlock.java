package de.aetherklang.block;

import com.mojang.serialization.MapCodec;
import de.aetherklang.registry.ModItems;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.resonance.ResonanceApi;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityCollisionHandler;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.random.Random;
import net.minecraft.world.World;

/**
 * A non-solid tear that pulses with withering dissonance until sealed with RP.
 */
public final class DissonanzrissBlock extends Block {
    public static final MapCodec<DissonanzrissBlock> CODEC = createCodec(DissonanzrissBlock::new);

    private static final int SEAL_COST = 12;

    public DissonanzrissBlock(Settings settings) {
        super(settings);
    }

    @Override
    protected MapCodec<? extends DissonanzrissBlock> getCodec() {
        return CODEC;
    }

    @Override
    protected void onEntityCollision(
            BlockState state,
            World world,
            BlockPos pos,
            Entity entity,
            EntityCollisionHandler handler
    ) {
        if (!(world instanceof ServerWorld serverWorld)
                || !(entity instanceof LivingEntity living)
                || entity.isSpectator()
                || entity.age % 20 != 0) {
            return;
        }

        living.addStatusEffect(new StatusEffectInstance(StatusEffects.WITHER, 70, 0, false, true));
        living.damage(serverWorld, world.getDamageSources().magic(), 2.0F);
        if (living instanceof ServerPlayerEntity player) {
            var data = ResonanceApi.getData(player);
            data.setDissonanz(data.getDissonanz() + 0.05F);
            ResonanceApi.sync(player);
        }
        serverWorld.spawnParticles(
                ModParticles.DISSONANZ_SMOKE,
                entity.getX(),
                entity.getBodyY(0.5D),
                entity.getZ(),
                9,
                0.35D,
                0.5D,
                0.35D,
                0.025D
        );
        serverWorld.playSound(
                null,
                pos,
                ModSounds.DISSONANZ_HIT,
                SoundCategory.BLOCKS,
                0.65F,
                0.75F
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
        return trySeal(world, pos, player);
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
        return trySeal(world, pos, player);
    }

    @Override
    public void randomDisplayTick(BlockState state, World world, BlockPos pos, Random random) {
        for (int i = 0; i < 2; i++) {
            world.addParticleClient(
                    ModParticles.DISSONANZ_SMOKE,
                    pos.getX() + random.nextDouble(),
                    pos.getY() + random.nextDouble(),
                    pos.getZ() + random.nextDouble(),
                    (random.nextDouble() - 0.5D) * 0.025D,
                    0.015D,
                    (random.nextDouble() - 0.5D) * 0.025D
            );
        }
    }

    private static ActionResult trySeal(World world, BlockPos pos, PlayerEntity player) {
        if (!(world instanceof ServerWorld serverWorld) || !(player instanceof ServerPlayerEntity serverPlayer)) {
            return ActionResult.SUCCESS;
        }
        if (!ResonanceApi.spendRp(serverPlayer, SEAL_COST)) {
            serverPlayer.sendMessage(Text.translatable("message.aetherklang.rift.seal_failed", SEAL_COST), true);
            return ActionResult.SUCCESS_SERVER;
        }

        serverWorld.spawnParticles(
                ModParticles.BEAM_MOTE,
                pos.getX() + 0.5D,
                pos.getY() + 0.5D,
                pos.getZ() + 0.5D,
                36,
                0.55D,
                0.55D,
                0.55D,
                0.09D
        );
        serverWorld.playSound(
                null,
                pos,
                ModSounds.RESONANCE_CAST,
                SoundCategory.BLOCKS,
                1.0F,
                0.65F
        );
        serverWorld.removeBlock(pos, false);
        serverPlayer.sendMessage(Text.translatable("message.aetherklang.rift.sealed", SEAL_COST), true);
        return ActionResult.SUCCESS_SERVER;
    }
}
