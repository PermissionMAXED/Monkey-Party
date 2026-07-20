package de.aetherklang.block;

import com.mojang.serialization.MapCodec;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.resonance.ResonanceApi;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
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
import net.minecraft.world.World;

/**
 * A crystal archive that unseals one location-bound Kodex folio per player.
 */
public final class ResonanzarchivBlock extends Block {
    public static final MapCodec<ResonanzarchivBlock> CODEC = createCodec(ResonanzarchivBlock::new);

    private static final int[] SEALED_FOLIOS = {16, 17, 19};
    private static final String[] FOLIO_TITLE_KEYS = {
            "kodex.aetherklang.page.tonarium.title",
            "kodex.aetherklang.page.portal_rite.title",
            "kodex.aetherklang.page.final_cadence.title"
    };

    public ResonanzarchivBlock(Settings settings) {
        super(settings);
    }

    @Override
    protected MapCodec<? extends ResonanzarchivBlock> getCodec() {
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
        return unsealFolio(world, pos, player);
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
        return unsealFolio(world, pos, player);
    }

    private static ActionResult unsealFolio(World world, BlockPos pos, PlayerEntity player) {
        if (!(world instanceof ServerWorld serverWorld) || !(player instanceof ServerPlayerEntity serverPlayer)) {
            return ActionResult.SUCCESS;
        }

        int folioIndex = Math.floorMod(pos.getX() / 16, SEALED_FOLIOS.length);
        int folio = SEALED_FOLIOS[folioIndex];
        Text title = Text.translatable(FOLIO_TITLE_KEYS[folioIndex]);
        if (!ResonanceApi.getData(serverPlayer).unlockCodexPage(folio)) {
            serverPlayer.sendMessage(
                    Text.translatable("message.aetherklang.archive.already_unsealed", title),
                    true
            );
            return ActionResult.SUCCESS_SERVER;
        }

        ResonanceApi.sync(serverPlayer);
        serverWorld.spawnParticles(
                ModParticles.BEAM_MOTE,
                pos.getX() + 0.5D,
                pos.getY() + 1.0D,
                pos.getZ() + 0.5D,
                32,
                0.55D,
                0.75D,
                0.55D,
                0.06D
        );
        serverWorld.playSound(
                null,
                pos,
                ModSounds.ARCHIV_UNLOCK,
                SoundCategory.BLOCKS,
                1.0F,
                1.0F + folioIndex * 0.12F
        );
        serverPlayer.sendMessage(
                Text.translatable("message.aetherklang.archive.unsealed", title),
                false
        );
        return ActionResult.SUCCESS_SERVER;
    }
}
