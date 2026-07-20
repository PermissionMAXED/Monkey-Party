package de.aetherklang.partitur;

import com.mojang.serialization.MapCodec;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.util.ActionResult;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.World;

/**
 * Opens the server-synchronized daily contract board.
 */
public final class NotenpultBlock extends Block {
    public static final MapCodec<NotenpultBlock> CODEC = createCodec(NotenpultBlock::new);

    public NotenpultBlock(Settings settings) {
        super(settings);
    }

    @Override
    protected MapCodec<? extends NotenpultBlock> getCodec() {
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
        if (world.isClient()) {
            return ActionResult.SUCCESS;
        }
        if (player instanceof ServerPlayerEntity serverPlayer) {
            PartiturService.open(serverPlayer);
            return ActionResult.SUCCESS_SERVER;
        }
        return ActionResult.PASS;
    }
}
