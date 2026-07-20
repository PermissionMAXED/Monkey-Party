package de.aetherklang.block;

import com.mojang.serialization.MapCodec;
import de.aetherklang.registry.ModItems;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.resonance.ResonanceApi;
import de.aetherklang.resonance.Stimmung;
import net.minecraft.block.Block;
import net.minecraft.block.BlockRenderType;
import net.minecraft.block.BlockState;
import net.minecraft.block.BlockWithEntity;
import net.minecraft.block.entity.BlockEntity;
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
import org.jetbrains.annotations.Nullable;

/**
 * A compact ritual station for selecting moods and attuning nearby crystals.
 */
public final class StimmaltarBlock extends BlockWithEntity {
    public static final MapCodec<StimmaltarBlock> CODEC = createCodec(StimmaltarBlock::new);

    private static final int ATTUNEMENT_COST = 6;
    private static final int ATTUNEMENT_RADIUS = 6;

    public StimmaltarBlock(Settings settings) {
        super(settings);
    }

    @Override
    protected MapCodec<? extends StimmaltarBlock> getCodec() {
        return CODEC;
    }

    @Override
    protected BlockRenderType getRenderType(BlockState state) {
        return BlockRenderType.MODEL;
    }

    @Nullable
    @Override
    public BlockEntity createBlockEntity(BlockPos pos, BlockState state) {
        return new StimmaltarBlockEntity(pos, state);
    }

    @Override
    protected ActionResult onUse(
            BlockState state,
            World world,
            BlockPos pos,
            PlayerEntity player,
            BlockHitResult hit
    ) {
        if (!(world.getBlockEntity(pos) instanceof StimmaltarBlockEntity altar)) {
            return ActionResult.PASS;
        }
        if (!(world instanceof ServerWorld serverWorld) || !(player instanceof ServerPlayerEntity serverPlayer)) {
            return ActionResult.SUCCESS;
        }

        Stimmung mood = altar.cycleMood(player.isSneaking());
        ResonanceApi.setMood(serverPlayer, mood);
        serverPlayer.sendMessage(
                Text.translatable("message.aetherklang.altar.mood", Text.translatable(mood.getTranslationKey())),
                true
        );
        burst(serverWorld, pos, ModParticles.BEAT_RING, 18);
        serverWorld.playSound(
                null,
                pos,
                ModSounds.BEAT_TICK,
                SoundCategory.BLOCKS,
                0.9F,
                0.85F + mood.ordinal() * 0.12F
        );
        world.updateListeners(pos, state, state, Block.NOTIFY_LISTENERS);
        return ActionResult.SUCCESS_SERVER;
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
        if (!(world instanceof ServerWorld serverWorld)
                || !(player instanceof ServerPlayerEntity serverPlayer)
                || !(world.getBlockEntity(pos) instanceof StimmaltarBlockEntity altar)) {
            return ActionResult.SUCCESS;
        }

        int crystalCount = countCrystals(serverWorld, pos, false);
        if (crystalCount == 0) {
            serverPlayer.sendMessage(Text.translatable("message.aetherklang.altar.no_crystals"), true);
            return ActionResult.SUCCESS_SERVER;
        }
        if (!ResonanceApi.spendRp(serverPlayer, ATTUNEMENT_COST)) {
            serverPlayer.sendMessage(
                    Text.translatable("message.aetherklang.rp.missing", ATTUNEMENT_COST),
                    true
            );
            return ActionResult.SUCCESS_SERVER;
        }

        ResonanceApi.setMood(serverPlayer, altar.getSelectedMood());
        int attuned = countCrystals(serverWorld, pos, true);
        serverPlayer.sendMessage(
                Text.translatable(
                        "message.aetherklang.altar.attuned",
                        attuned,
                        Text.translatable(altar.getSelectedMood().getTranslationKey()),
                        ATTUNEMENT_COST
                ),
                true
        );
        burst(serverWorld, pos, ModParticles.BEAM_MOTE, 36);
        serverWorld.playSound(
                null,
                pos,
                ModSounds.RESONANCE_CAST,
                SoundCategory.BLOCKS,
                1.1F,
                1.25F
        );
        player.getItemCooldownManager().set(stack, 30);
        return ActionResult.SUCCESS_SERVER;
    }

    @Override
    public void randomDisplayTick(BlockState state, World world, BlockPos pos, Random random) {
        if (random.nextInt(4) == 0) {
            world.addParticleClient(
                    ModParticles.BEAT_RING,
                    pos.getX() + 0.5D,
                    pos.getY() + 1.05D,
                    pos.getZ() + 0.5D,
                    0.0D,
                    0.012D,
                    0.0D
            );
        }
    }

    private static int countCrystals(ServerWorld world, BlockPos origin, boolean emitParticles) {
        int count = 0;
        for (BlockPos target : BlockPos.iterateOutwards(
                origin,
                ATTUNEMENT_RADIUS,
                ATTUNEMENT_RADIUS / 2,
                ATTUNEMENT_RADIUS
        )) {
            if (!(world.getBlockState(target).getBlock() instanceof ResonanceCrystalBlock)) {
                continue;
            }

            count++;
            if (emitParticles) {
                world.spawnParticles(
                        ModParticles.NOTE_SPARK,
                        target.getX() + 0.5D,
                        target.getY() + 0.65D,
                        target.getZ() + 0.5D,
                        8,
                        0.3D,
                        0.45D,
                        0.3D,
                        0.04D
                );
            }
        }
        return count;
    }

    private static void burst(
            ServerWorld world,
            BlockPos pos,
            net.minecraft.particle.SimpleParticleType particle,
            int count
    ) {
        world.spawnParticles(
                particle,
                pos.getX() + 0.5D,
                pos.getY() + 1.0D,
                pos.getZ() + 0.5D,
                count,
                0.7D,
                0.35D,
                0.7D,
                0.075D
        );
    }
}
