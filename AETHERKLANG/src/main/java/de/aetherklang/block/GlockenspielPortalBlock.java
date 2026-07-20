package de.aetherklang.block;

import com.mojang.serialization.MapCodec;
import de.aetherklang.registry.ModItems;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.resonance.ResonanceApi;
import java.util.Objects;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityCollisionHandler;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.text.Text;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;
import net.minecraft.util.math.random.Random;
import net.minecraft.world.TeleportTarget;
import net.minecraft.world.World;

/**
 * A temporary overworld portal backed by an explicit WP10 destination hook.
 *
 * <p>WP10 can call {@link #setDestinationResolver(PortalDestinationResolver)}
 * during common initialization. Until then, players arrive at the generated
 * Kammerton Antechamber above the overworld.</p>
 */
public final class GlockenspielPortalBlock extends Block {
    public static final MapCodec<GlockenspielPortalBlock> CODEC = createCodec(GlockenspielPortalBlock::new);

    private static final int PORTAL_COST = 24;
    private static final BlockPos ANTECHAMBER_ARRIVAL = new BlockPos(0, 193, 0);
    private static volatile PortalDestinationResolver destinationResolver = (player, fallback) -> fallback;

    public GlockenspielPortalBlock(Settings settings) {
        super(settings);
    }

    @Override
    protected MapCodec<? extends GlockenspielPortalBlock> getCodec() {
        return CODEC;
    }

    /**
     * Replaces the fallback target resolver. Intended for WP10's dimension implementation.
     */
    public static void setDestinationResolver(PortalDestinationResolver resolver) {
        destinationResolver = Objects.requireNonNull(resolver, "resolver");
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
                || !(entity instanceof ServerPlayerEntity player)
                || player.isSpectator()
                || player.hasPortalCooldown()) {
            return;
        }

        boolean carriesKodex = player.getMainHandStack().isOf(ModItems.KODEX)
                || player.getOffHandStack().isOf(ModItems.KODEX);
        if (!carriesKodex && !ResonanceApi.spendRp(player, PORTAL_COST)) {
            player.sendMessage(Text.translatable("message.aetherklang.portal.denied", PORTAL_COST), true);
            player.setPortalCooldown(40);
            return;
        }

        ServerWorld overworld = Objects.requireNonNull(serverWorld.getServer()).getOverworld();
        ensureAntechamber(overworld);
        TeleportTarget fallback = new TeleportTarget(
                overworld,
                Vec3d.ofBottomCenter(ANTECHAMBER_ARRIVAL),
                Vec3d.ZERO,
                player.getYaw(),
                player.getPitch(),
                TeleportTarget.NO_OP
        );
        TeleportTarget target = Objects.requireNonNull(
                destinationResolver.resolve(player, fallback),
                "Glockenspiel portal destination resolver returned null"
        );

        serverWorld.spawnParticles(
                ModParticles.BEAM_MOTE,
                pos.getX() + 0.5D,
                pos.getY() + 0.7D,
                pos.getZ() + 0.5D,
                42,
                0.65D,
                0.8D,
                0.65D,
                0.12D
        );
        serverWorld.playSound(
                null,
                pos,
                ModSounds.PORTAL_HUM,
                SoundCategory.BLOCKS,
                1.0F,
                1.15F
        );

        player.setPortalCooldown(100);
        player.fallDistance = 0.0D;
        player.teleportTo(target);
        target.world().spawnParticles(
                ModParticles.NOTE_SPARK,
                target.position().x,
                target.position().y + 0.6D,
                target.position().z,
                48,
                1.0D,
                0.75D,
                1.0D,
                0.08D
        );
        target.world().playSound(
                null,
                target.position().x,
                target.position().y,
                target.position().z,
                ModSounds.RESONANCE_CAST,
                SoundCategory.PLAYERS,
                1.0F,
                1.4F
        );
        player.sendMessage(Text.translatable("message.aetherklang.portal.arrival"), true);
    }

    @Override
    public void randomDisplayTick(BlockState state, World world, BlockPos pos, Random random) {
        for (int i = 0; i < 3; i++) {
            world.addParticleClient(
                    i == 0 ? ModParticles.NOTE_SPARK : ModParticles.BEAM_MOTE,
                    pos.getX() + 0.15D + random.nextDouble() * 0.7D,
                    pos.getY() + random.nextDouble(),
                    pos.getZ() + 0.15D + random.nextDouble() * 0.7D,
                    (random.nextDouble() - 0.5D) * 0.03D,
                    0.01D + random.nextDouble() * 0.025D,
                    (random.nextDouble() - 0.5D) * 0.03D
            );
        }
        if (random.nextInt(80) == 0) {
            world.playSoundAtBlockCenterClient(
                    pos,
                    ModSounds.PORTAL_HUM,
                    SoundCategory.BLOCKS,
                    0.35F,
                    0.9F + random.nextFloat() * 0.15F,
                    false
            );
        }
    }

    private static void ensureAntechamber(ServerWorld world) {
        BlockPos marker = ANTECHAMBER_ARRIVAL.down();
        if (world.getBlockState(marker).isOf(Blocks.CHISELED_QUARTZ_BLOCK)) {
            return;
        }

        for (int x = -5; x <= 5; x++) {
            for (int z = -5; z <= 5; z++) {
                int radiusSquared = x * x + z * z;
                if (radiusSquared > 30) {
                    continue;
                }

                BlockPos floor = marker.add(x, 0, z);
                Block floorBlock = radiusSquared >= 22
                        ? Blocks.AMETHYST_BLOCK
                        : ((x + z) & 1) == 0 ? Blocks.SMOOTH_QUARTZ : Blocks.POLISHED_DEEPSLATE;
                world.setBlockState(floor, floorBlock.getDefaultState(), Block.NOTIFY_ALL);
                for (int y = 1; y <= 5; y++) {
                    world.setBlockState(floor.up(y), Blocks.AIR.getDefaultState(), Block.NOTIFY_ALL);
                }
            }
        }

        world.setBlockState(marker, Blocks.CHISELED_QUARTZ_BLOCK.getDefaultState(), Block.NOTIFY_ALL);
        placeBeacon(world, marker.add(4, 1, 0));
        placeBeacon(world, marker.add(-4, 1, 0));
        placeBeacon(world, marker.add(0, 1, 4));
        placeBeacon(world, marker.add(0, 1, -4));
    }

    private static void placeBeacon(ServerWorld world, BlockPos base) {
        world.setBlockState(base, Blocks.GOLD_BLOCK.getDefaultState(), Block.NOTIFY_ALL);
        world.setBlockState(base.up(), Blocks.SEA_LANTERN.getDefaultState(), Block.NOTIFY_ALL);
        world.setBlockState(base.up(2), Blocks.AMETHYST_CLUSTER.getDefaultState(), Block.NOTIFY_ALL);
    }

    @FunctionalInterface
    public interface PortalDestinationResolver {
        TeleportTarget resolve(ServerPlayerEntity player, TeleportTarget fallback);
    }
}
