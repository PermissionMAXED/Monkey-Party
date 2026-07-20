package de.aetherklang.block;

import com.mojang.serialization.MapCodec;
import de.aetherklang.registry.ModBlocks;
import de.aetherklang.registry.ModItems;
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
import net.minecraft.state.StateManager;
import net.minecraft.state.property.BooleanProperty;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.TeleportTarget;
import net.minecraft.world.World;

/**
 * A tuning-fork-attuned pillar that teleports to the nearest other attuned pillar.
 */
public final class StimmpfeilerBlock extends Block {
    public static final MapCodec<StimmpfeilerBlock> CODEC = createCodec(StimmpfeilerBlock::new);
    public static final BooleanProperty ATTUNED = BooleanProperty.of("attuned");

    private static final int RP_COST = 12;
    private static final int HORIZONTAL_RANGE = 48;
    private static final int VERTICAL_RANGE = 16;

    public StimmpfeilerBlock(Settings settings) {
        super(settings);
        setDefaultState(getStateManager().getDefaultState().with(ATTUNED, false));
    }

    @Override
    protected MapCodec<? extends StimmpfeilerBlock> getCodec() {
        return CODEC;
    }

    @Override
    protected void appendProperties(StateManager.Builder<Block, BlockState> builder) {
        builder.add(ATTUNED);
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
        if (world instanceof ServerWorld serverWorld) {
            boolean attuned = !state.get(ATTUNED);
            serverWorld.setBlockState(pos, state.with(ATTUNED, attuned), Block.NOTIFY_ALL);
            serverWorld.playSound(
                    null,
                    pos,
                    attuned ? ModSounds.RESONANCE_CAST : ModSounds.DISSONANZ_HIT,
                    SoundCategory.BLOCKS,
                    0.8F,
                    attuned ? 1.45F : 0.8F
            );
            player.sendMessage(
                    Text.translatable(attuned
                            ? "message.aetherklang.stimmpfeiler.attuned"
                            : "message.aetherklang.stimmpfeiler.detuned"),
                    true
            );
        }
        return world.isClient() ? ActionResult.SUCCESS : ActionResult.SUCCESS_SERVER;
    }

    @Override
    protected ActionResult onUse(
            BlockState state,
            World world,
            BlockPos pos,
            PlayerEntity player,
            BlockHitResult hit
    ) {
        if (!state.get(ATTUNED)) {
            if (!world.isClient()) {
                player.sendMessage(Text.translatable("message.aetherklang.stimmpfeiler.not_attuned"), true);
            }
            return ActionResult.SUCCESS;
        }
        if (!(world instanceof ServerWorld serverWorld) || !(player instanceof ServerPlayerEntity serverPlayer)) {
            return ActionResult.SUCCESS;
        }

        BlockPos destination = findDestination(serverWorld, pos);
        if (destination == null) {
            serverPlayer.sendMessage(Text.translatable("message.aetherklang.stimmpfeiler.no_destination"), true);
            return ActionResult.SUCCESS_SERVER;
        }
        if (!ResonanceApi.spendRp(serverPlayer, RP_COST)) {
            serverPlayer.sendMessage(Text.translatable("message.aetherklang.rp.missing", RP_COST), true);
            return ActionResult.SUCCESS_SERVER;
        }

        pulse(serverWorld, pos);
        BlockPos arrival = destination.up();
        serverPlayer.fallDistance = 0.0F;
        serverPlayer.teleportTo(new TeleportTarget(
                serverWorld,
                Vec3d.ofBottomCenter(arrival),
                Vec3d.ZERO,
                serverPlayer.getYaw(),
                serverPlayer.getPitch(),
                TeleportTarget.NO_OP
        ));
        pulse(serverWorld, destination);
        serverPlayer.sendMessage(Text.translatable("message.aetherklang.stimmpfeiler.teleported", RP_COST), true);
        return ActionResult.SUCCESS_SERVER;
    }

    private static BlockPos findDestination(ServerWorld world, BlockPos origin) {
        for (BlockPos candidate : BlockPos.iterateOutwards(
                origin,
                HORIZONTAL_RANGE,
                VERTICAL_RANGE,
                HORIZONTAL_RANGE
        )) {
            if (candidate.equals(origin)) {
                continue;
            }
            BlockState state = world.getBlockState(candidate);
            if (state.isOf(ModBlocks.STIMMPFEILER)
                    && state.get(ATTUNED)
                    && world.getBlockState(candidate.up()).isAir()
                    && world.getBlockState(candidate.up(2)).isAir()) {
                return candidate.toImmutable();
            }
        }
        return null;
    }

    private static void pulse(ServerWorld world, BlockPos pos) {
        world.spawnParticles(
                ModParticles.KLANGOPERATION_RING,
                pos.getX() + 0.5D,
                pos.getY() + 1.0D,
                pos.getZ() + 0.5D,
                28,
                0.7D,
                0.8D,
                0.7D,
                0.07D
        );
        world.playSound(null, pos, ModSounds.RESONANCE_CAST, SoundCategory.BLOCKS, 1.0F, 1.25F);
    }
}
