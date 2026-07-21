package de.aetherklang.block;

import com.mojang.serialization.MapCodec;
import de.aetherklang.insel.StimmpfeilerNetwork;
import de.aetherklang.klangbahn.KlangbahnService;
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
            setTowerAttuned(serverWorld, pos, attuned);
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
        if (!serverPlayer.isSneaking() && KlangbahnService.boardFromPillar(serverWorld, pos, serverPlayer)) {
            return ActionResult.SUCCESS_SERVER;
        }

        StimmpfeilerNetwork.Route route = StimmpfeilerNetwork.route(serverWorld, pos, serverPlayer.isSneaking());
        if (route == null) {
            BlockPos nearby = findDestination(serverWorld, pos);
            if (nearby != null) {
                route = new StimmpfeilerNetwork.Route(
                        serverWorld,
                        nearby,
                        "destination.aetherklang.nearby"
                );
            }
        }
        if (route == null) {
            serverPlayer.sendMessage(Text.translatable("message.aetherklang.stimmpfeiler.no_destination"), true);
            return ActionResult.SUCCESS_SERVER;
        }
        BlockPos arrival = findSafeArrival(route.world(), route.pillar());
        if (arrival == null) {
            serverPlayer.sendMessage(Text.translatable("message.aetherklang.stimmpfeiler.no_destination"), true);
            return ActionResult.SUCCESS_SERVER;
        }
        if (!ResonanceApi.spendRp(serverPlayer, RP_COST)) {
            serverPlayer.sendMessage(Text.translatable("message.aetherklang.rp.missing", RP_COST), true);
            return ActionResult.SUCCESS_SERVER;
        }

        pulse(serverWorld, pos);
        serverPlayer.fallDistance = 0.0F;
        serverPlayer.teleportTo(new TeleportTarget(
                route.world(),
                Vec3d.ofBottomCenter(arrival),
                Vec3d.ZERO,
                serverPlayer.getYaw(),
                serverPlayer.getPitch(),
                TeleportTarget.NO_OP
        ));
        pulse(route.world(), route.pillar());
        serverPlayer.sendMessage(
                Text.translatable(
                        "message.aetherklang.stimmpfeiler.teleported",
                        Text.translatable(route.destinationKey()),
                        RP_COST
                ),
                true
        );
        return ActionResult.SUCCESS_SERVER;
    }

    private static BlockPos findDestination(ServerWorld world, BlockPos origin) {
        for (BlockPos candidate : BlockPos.iterateOutwards(
                origin,
                HORIZONTAL_RANGE,
                VERTICAL_RANGE,
                HORIZONTAL_RANGE
        )) {
            if (candidate.equals(origin)
                    || candidate.getX() == origin.getX()
                    && candidate.getZ() == origin.getZ()
                    && Math.abs(candidate.getY() - origin.getY()) <= 2) {
                continue;
            }
            BlockState state = world.getBlockState(candidate);
            if (state.isOf(ModBlocks.STIMMPFEILER)
                    && state.get(ATTUNED)
                    && findSafeArrival(world, candidate) != null) {
                return candidate.toImmutable();
            }
        }
        return null;
    }

    private static void setTowerAttuned(ServerWorld world, BlockPos position, boolean attuned) {
        BlockPos lower = world.getBlockState(position.down()).isOf(ModBlocks.STIMMPFEILER)
                ? position.down()
                : position;
        for (int offset = 0; offset < 2; offset++) {
            BlockPos part = lower.up(offset);
            BlockState partState = world.getBlockState(part);
            if (partState.isOf(ModBlocks.STIMMPFEILER)) {
                world.setBlockState(part, partState.with(ATTUNED, attuned), Block.NOTIFY_ALL);
            }
        }
    }

    private static BlockPos findSafeArrival(ServerWorld world, BlockPos pillar) {
        BlockPos lower = world.getBlockState(pillar.down()).isOf(ModBlocks.STIMMPFEILER)
                ? pillar.down()
                : pillar;
        for (int radius = 1; radius <= 4; radius++) {
            for (int x = -radius; x <= radius; x++) {
                for (int z = -radius; z <= radius; z++) {
                    if (Math.max(Math.abs(x), Math.abs(z)) != radius) {
                        continue;
                    }
                    BlockPos candidate = lower.add(x, 0, z);
                    if (world.getBlockState(candidate).isAir()
                            && world.getBlockState(candidate.up()).isAir()
                            && world.getBlockState(candidate.down()).isSolidBlock(world, candidate.down())) {
                        return candidate.toImmutable();
                    }
                }
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
