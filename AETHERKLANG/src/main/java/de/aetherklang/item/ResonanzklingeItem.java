package de.aetherklang.item;

import de.aetherklang.registry.ModParticles;
import de.aetherklang.resonance.BeatEngine;
import java.util.List;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

public final class ResonanzklingeItem extends Item {
    private static final int SLASH_COST = 12;

    public ResonanzklingeItem(Settings settings) {
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

        target.damage(serverWorld, player.getDamageSources().magic(), 3.0F);
        if (!perfect) {
            ResonanceItemUtil.gainRp(player, 2);
        }
        serverWorld.spawnParticles(
                ModParticles.NOTE_SPARK,
                target.getX(),
                target.getBodyY(0.65),
                target.getZ(),
                12,
                0.35,
                0.45,
                0.35,
                0.08
        );
        ResonanceItemUtil.playCast(serverWorld, player, 1.6F);
    }

    @Override
    public ActionResult use(World world, PlayerEntity player, Hand hand) {
        if (!player.isSneaking()) {
            return ActionResult.PASS;
        }
        if (!(world instanceof ServerWorld serverWorld)) {
            return ActionResult.SUCCESS;
        }

        if (!ResonanceItemUtil.spendRp(player, SLASH_COST)) {
            player.sendMessage(Text.translatable("message.aetherklang.rp.missing", SLASH_COST), true);
            return ActionResult.FAIL;
        }

        Vec3d look = player.getRotationVector().normalize();
        List<LivingEntity> targets = serverWorld.getEntitiesByClass(
                LivingEntity.class,
                player.getBoundingBox().expand(4.5),
                target -> target != player && target.isAlive() && !player.isTeammate(target)
        );
        for (LivingEntity target : targets) {
            Vec3d toTarget = target.getEntityPos().subtract(player.getEntityPos()).normalize();
            if (look.dotProduct(toTarget) < 0.2) {
                continue;
            }
            target.damage(serverWorld, player.getDamageSources().magic(), 5.0F);
            target.addVelocity(look.multiply(0.55).add(0.0, 0.15, 0.0));
            target.velocityModified = true;
        }

        for (int step = 1; step <= 9; step++) {
            Vec3d point = player.getEyePos().add(look.multiply(step * 0.48));
            serverWorld.spawnParticles(
                    ResonanceItemUtil.moodDust(player, 1.15F),
                    point.x,
                    point.y,
                    point.z,
                    3,
                    0.18,
                    0.18,
                    0.18,
                    0.02
            );
        }
        Vec3d sweep = player.getEntityPos().add(look.multiply(2.0)).add(0.0, 1.0, 0.0);
        serverWorld.spawnParticles(ParticleTypes.SWEEP_ATTACK, sweep.x, sweep.y, sweep.z, 4, 0.7, 0.3, 0.7, 0.0);
        ResonanceItemUtil.playCast(serverWorld, player, 0.85F);

        ItemStack stack = player.getStackInHand(hand);
        stack.damage(1, player);
        player.getItemCooldownManager().set(stack, 30);
        return ActionResult.SUCCESS_SERVER;
    }
}
