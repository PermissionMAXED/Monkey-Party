package de.aetherklang.schmiede;

import com.mojang.serialization.MapCodec;
import de.aetherklang.registry.ModParticles;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.random.Random;
import net.minecraft.world.World;

/**
 * Smithing station for instrument tiers and single-use relic sockets.
 *
 * <p>The instrument is held in the main hand. Upgrade ingredients are consumed
 * atomically from the inventory; a relic held in the offhand is socketed
 * instead.</p>
 */
public final class KlangambossBlock extends Block {
    public static final MapCodec<KlangambossBlock> CODEC = createCodec(KlangambossBlock::new);

    public KlangambossBlock(Settings settings) {
        super(settings);
    }

    @Override
    protected MapCodec<? extends KlangambossBlock> getCodec() {
        return CODEC;
    }

    @Override
    protected ActionResult onUse(
            BlockState state,
            World world,
            BlockPos pos,
            PlayerEntity player,
            BlockHitResult hit
    ) {
        if (!world.isClient()) {
            player.sendMessage(Text.translatable("message.aetherklang.schmiede.help"), true);
        }
        return ActionResult.SUCCESS;
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
        if (hand != Hand.MAIN_HAND || !(stack.getItem() instanceof KlanginstrumentItem)) {
            return ActionResult.PASS;
        }
        if (!(world instanceof ServerWorld serverWorld) || !(player instanceof ServerPlayerEntity serverPlayer)) {
            return ActionResult.SUCCESS;
        }

        SchmiedeService.work(serverWorld, pos, serverPlayer, stack, player.getOffHandStack());
        return ActionResult.SUCCESS_SERVER;
    }

    @Override
    public void randomDisplayTick(BlockState state, World world, BlockPos pos, Random random) {
        if (random.nextInt(6) == 0) {
            world.addParticleClient(
                    ModParticles.KLANGOPERATION_RING,
                    pos.getX() + 0.5D,
                    pos.getY() + 1.03D,
                    pos.getZ() + 0.5D,
                    0.0D,
                    0.008D,
                    0.0D
            );
        }
    }
}
