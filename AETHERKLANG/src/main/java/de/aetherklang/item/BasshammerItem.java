package de.aetherklang.item;

import de.aetherklang.registry.ModParticles;
import de.aetherklang.resonance.BeatEngine;
import java.util.List;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.particle.BlockStateParticleEffect;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

public final class BasshammerItem extends Item {
    public BasshammerItem(Settings settings) {
        super(settings);
    }

    @Override
    public void postHit(ItemStack stack, LivingEntity target, LivingEntity attacker) {
        super.postHit(stack, target, attacker);
        if (!(attacker instanceof ServerPlayerEntity player)
                || !(attacker.getEntityWorld() instanceof ServerWorld serverWorld)) {
            return;
        }
        boolean perfect = BeatEngine.grantPerfectTimingRp(player);
        if (!BeatEngine.isOnBeat(player, BeatEngine.GOOD_WINDOW)) {
            return;
        }

        smash(serverWorld, player, target.getEntityPos(), 3.25, ResonanceItemUtil.hasZorn(player) ? 5.0F : 3.0F);
        if (!perfect) {
            ResonanceItemUtil.gainRp(player, 2);
        }
    }

    @Override
    public ActionResult use(World world, PlayerEntity player, Hand hand) {
        if (world.isClient()) {
            return ActionResult.SUCCESS;
        }
        if (!ResonanceItemUtil.isOnBeat(player)) {
            return ActionResult.PASS;
        }
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        Vec3d center = player.getEntityPos().add(player.getRotationVector().multiply(1.8));
        smash(serverWorld, player, center, 4.25, ResonanceItemUtil.hasZorn(player) ? 8.0F : 5.0F);

        ItemStack stack = player.getStackInHand(hand);
        stack.damage(2, player);
        player.getItemCooldownManager().set(stack, 45);
        return ActionResult.SUCCESS_SERVER;
    }

    private static void smash(
            ServerWorld world,
            PlayerEntity player,
            Vec3d center,
            double radius,
            float damage
    ) {
        List<LivingEntity> targets = world.getEntitiesByClass(
                LivingEntity.class,
                player.getBoundingBox().expand(radius + 1.0),
                target -> target != player
                        && target.isAlive()
                        && !player.isTeammate(target)
                        && target.getEntityPos().squaredDistanceTo(center) <= radius * radius
        );
        for (LivingEntity target : targets) {
            target.damage(world, player.getDamageSources().magic(), damage);
            Vec3d force = target.getEntityPos().subtract(center).multiply(1.0, 0.0, 1.0).normalize();
            if (force.lengthSquared() < 0.01) {
                force = player.getRotationVector().multiply(1.0, 0.0, 1.0).normalize();
            }
            target.addVelocity(force.multiply(1.15).add(0.0, 0.42, 0.0));
            target.velocityModified = true;
        }

        var groundState = world.getBlockState(player.getBlockPos().down());
        world.spawnParticles(
                new BlockStateParticleEffect(ParticleTypes.BLOCK, groundState),
                center.x,
                center.y + 0.1,
                center.z,
                45,
                radius * 0.7,
                0.15,
                radius * 0.7,
                0.35
        );
        world.spawnParticles(ParticleTypes.DUST_PLUME, center.x, center.y + 0.1, center.z, 18, radius * 0.45, 0.1, radius * 0.45, 0.08);
        world.spawnParticles(ModParticles.BEAT_RING, center.x, center.y + 0.15, center.z, 16, radius * 0.4, 0.1, radius * 0.4, 0.03);
        ResonanceItemUtil.playCast(world, player, ResonanceItemUtil.hasZorn(player) ? 0.55F : 0.72F);
    }
}
