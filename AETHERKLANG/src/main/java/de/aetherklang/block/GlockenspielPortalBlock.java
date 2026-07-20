package de.aetherklang.block;

import com.mojang.serialization.MapCodec;
import de.aetherklang.registry.ModItems;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.resonance.ResonanceApi;
import de.aetherklang.world.KammertonWorld;
import java.util.Objects;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityCollisionHandler;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.text.Text;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.random.Random;
import net.minecraft.world.TeleportTarget;
import net.minecraft.world.World;

/**
 * Two-way gate between the overworld and the Kammerton endgame dimension.
 */
public final class GlockenspielPortalBlock extends Block {
    public static final MapCodec<GlockenspielPortalBlock> CODEC = createCodec(GlockenspielPortalBlock::new);

    private static final int PORTAL_COST = 24;
    private static volatile PortalDestinationResolver destinationResolver = player -> null;

    public GlockenspielPortalBlock(Settings settings) {
        super(settings);
    }

    @Override
    protected MapCodec<? extends GlockenspielPortalBlock> getCodec() {
        return CODEC;
    }

    /**
     * Installs the Kammerton dimension destination resolver during common initialization.
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

        boolean returningToOverworld = KammertonWorld.isKammerton(serverWorld);
        TeleportTarget target = destinationResolver.resolve(player);
        if (target == null) {
            player.sendMessage(Text.translatable("message.aetherklang.portal.unavailable"), true);
            player.setPortalCooldown(40);
            return;
        }

        if (!returningToOverworld) {
            boolean carriesKodex = player.getMainHandStack().isOf(ModItems.KODEX)
                    || player.getOffHandStack().isOf(ModItems.KODEX);
            if (!carriesKodex && !ResonanceApi.spendRp(player, PORTAL_COST)) {
                player.sendMessage(Text.translatable("message.aetherklang.portal.denied", PORTAL_COST), true);
                player.setPortalCooldown(40);
                return;
            }
        }

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
        player.sendMessage(
                Text.translatable(returningToOverworld
                        ? "message.aetherklang.portal.return"
                        : "message.aetherklang.portal.arrival"),
                true
        );
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

    @FunctionalInterface
    public interface PortalDestinationResolver {
        TeleportTarget resolve(ServerPlayerEntity player);
    }
}
