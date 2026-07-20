package de.aetherklang.block;

import com.mojang.serialization.MapCodec;
import de.aetherklang.registry.ModBlocks;
import de.aetherklang.registry.ModItems;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.resonance.ResonanceApi;
import de.aetherklang.resonance.Stimmung;
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
import net.minecraft.util.math.random.Random;
import net.minecraft.world.World;

/**
 * A luminous crystal that whispers a mood and offers a trace of resonance.
 */
public final class ResonanceCrystalBlock extends Block {
    public static final MapCodec<ResonanceCrystalBlock> CODEC = createCodec(ResonanceCrystalBlock::new);

    public ResonanceCrystalBlock(Settings settings) {
        super(settings);
    }

    @Override
    protected MapCodec<? extends ResonanceCrystalBlock> getCodec() {
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
        return resonate(world, pos, player);
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

        ActionResult result = resonate(world, pos, player);
        if (world instanceof ServerWorld) {
            player.getItemCooldownManager().set(stack, 10);
        }
        return result;
    }

    @Override
    public void randomDisplayTick(BlockState state, World world, BlockPos pos, Random random) {
        if (random.nextInt(3) != 0) {
            return;
        }

        world.addParticleClient(
                ModParticles.NOTE_SPARK,
                pos.getX() + 0.25D + random.nextDouble() * 0.5D,
                pos.getY() + 0.45D + random.nextDouble() * 0.65D,
                pos.getZ() + 0.25D + random.nextDouble() * 0.5D,
                0.0D,
                0.015D,
                0.0D
        );
    }

    private ActionResult resonate(World world, BlockPos pos, PlayerEntity player) {
        if (!(world instanceof ServerWorld serverWorld) || !(player instanceof ServerPlayerEntity serverPlayer)) {
            return ActionResult.SUCCESS;
        }

        Stimmung hint = getMoodHint();
        int totalRp = ResonanceApi.addRp(serverPlayer, 1);
        serverPlayer.sendMessage(
                Text.translatable("message.aetherklang.crystal.hint", Text.translatable(hint.getTranslationKey()), totalRp),
                true
        );
        serverWorld.spawnParticles(
                ModParticles.NOTE_SPARK,
                pos.getX() + 0.5D,
                pos.getY() + 0.7D,
                pos.getZ() + 0.5D,
                10,
                0.35D,
                0.45D,
                0.35D,
                0.035D
        );
        serverWorld.playSound(
                null,
                pos,
                ModSounds.RESONANCE_CAST,
                SoundCategory.BLOCKS,
                0.65F,
                getPitch()
        );
        return ActionResult.SUCCESS_SERVER;
    }

    private Stimmung getMoodHint() {
        if (this == ModBlocks.RESONANZKRISTALL_CYAN) {
            return Stimmung.WUNDER;
        }
        if (this == ModBlocks.RESONANZKRISTALL_GOLD) {
            return Stimmung.FREUDE;
        }
        if (this == ModBlocks.RESONANZKRISTALL_MAGENTA) {
            return Stimmung.ZORN;
        }
        return Stimmung.STILLE;
    }

    private float getPitch() {
        if (this == ModBlocks.RESONANZKRISTALL_CYAN) {
            return 1.2F;
        }
        if (this == ModBlocks.RESONANZKRISTALL_GOLD) {
            return 1.45F;
        }
        if (this == ModBlocks.RESONANZKRISTALL_MAGENTA) {
            return 0.85F;
        }
        return 1.0F;
    }
}
