package de.aetherklang.item;

import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.resonance.BeatEngine;
import de.aetherklang.resonance.BeatTiming;
import de.aetherklang.resonance.ResonanceApi;
import java.util.List;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.consume.UseAction;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/**
 * A charged resonance instrument that releases a cone-shaped pressure wave on
 * the beat.
 */
public final class OrgelhornItem extends Item {
    private static final int RP_COST = 10;
    private static final int MIN_CHARGE_TICKS = 10;
    private static final double RANGE = 12.0D;
    private static final double CONE_COSINE = 0.78D;
    private static final float DAMAGE = 7.0F;

    public OrgelhornItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity player, Hand hand) {
        ItemStack stack = player.getStackInHand(hand);
        if (player.getItemCooldownManager().isCoolingDown(stack)) {
            return ActionResult.FAIL;
        }
        player.setCurrentHand(hand);
        return world.isClient() ? ActionResult.SUCCESS : ActionResult.CONSUME;
    }

    @Override
    public int getMaxUseTime(ItemStack stack, LivingEntity user) {
        return 72_000;
    }

    @Override
    public UseAction getUseAction(ItemStack stack) {
        return UseAction.BOW;
    }

    @Override
    public boolean onStoppedUsing(ItemStack stack, World world, LivingEntity user, int remainingUseTicks) {
        int chargeTicks = getMaxUseTime(stack, user) - remainingUseTicks;
        if (chargeTicks < MIN_CHARGE_TICKS
                || !(world instanceof ServerWorld serverWorld)
                || !(user instanceof ServerPlayerEntity player)) {
            return false;
        }

        BeatTiming timing = BeatEngine.getTiming(player);
        if (timing == BeatTiming.MISS) {
            BeatEngine.grantPerfectTimingRp(player);
            return false;
        }
        if (!ResonanceApi.spendRp(player, RP_COST)) {
            player.sendMessage(Text.translatable("message.aetherklang.rp.missing", RP_COST), true);
            return false;
        }

        blast(serverWorld, player, timing);
        BeatEngine.grantPerfectTimingRp(player);
        stack.damage(1, player);
        return true;
    }

    private static void blast(ServerWorld world, ServerPlayerEntity player, BeatTiming timing) {
        Vec3d origin = player.getEyePos();
        Vec3d look = player.getRotationVector().normalize();
        List<LivingEntity> targets = world.getEntitiesByClass(
                LivingEntity.class,
                player.getBoundingBox().stretch(look.multiply(RANGE)).expand(RANGE),
                target -> target.isAlive() && target != player && isInsideCone(origin, look, target)
        );

        float damage = DAMAGE * ResonanceApi.getDamageMultiplier(player);
        double knockback = timing == BeatTiming.PERFECT ? 1.8D : 1.45D;
        for (LivingEntity target : targets) {
            Vec3d direction = target.getBoundingBox().getCenter().subtract(origin).normalize();
            target.damage(world, player.getDamageSources().magic(), damage);
            target.addVelocity(direction.x * knockback, 0.3D, direction.z * knockback);
            target.velocityModified = true;
            target.addStatusEffect(new StatusEffectInstance(StatusEffects.DARKNESS, 50, 0, false, true));
        }

        spawnPressureRings(world, origin, look, timing);
        world.playSound(
                null,
                player.getX(),
                player.getY(),
                player.getZ(),
                ModSounds.ORGELHORN_BLAST,
                SoundCategory.PLAYERS,
                1.6F,
                timing == BeatTiming.PERFECT ? 1.08F : 0.96F
        );
    }

    private static boolean isInsideCone(Vec3d origin, Vec3d look, LivingEntity target) {
        Vec3d offset = target.getBoundingBox().getCenter().subtract(origin);
        double distanceSquared = offset.lengthSquared();
        return distanceSquared <= RANGE * RANGE
                && distanceSquared > 0.0001D
                && offset.normalize().dotProduct(look) >= CONE_COSINE;
    }

    private static void spawnPressureRings(
            ServerWorld world,
            Vec3d origin,
            Vec3d direction,
            BeatTiming timing
    ) {
        Vec3d reference = Math.abs(direction.y) < 0.9D ? new Vec3d(0.0D, 1.0D, 0.0D) : new Vec3d(1.0D, 0.0D, 0.0D);
        Vec3d right = direction.crossProduct(reference).normalize();
        Vec3d up = right.crossProduct(direction).normalize();

        for (int ring = 1; ring <= 4; ring++) {
            double distance = ring * 2.7D;
            double radius = 0.6D + ring * 0.72D;
            Vec3d center = origin.add(direction.multiply(distance));
            int points = 12 + ring * 4;
            for (int point = 0; point < points; point++) {
                double angle = Math.PI * 2.0D * point / points;
                Vec3d position = center
                        .add(right.multiply(Math.cos(angle) * radius))
                        .add(up.multiply(Math.sin(angle) * radius));
                world.spawnParticles(
                        ModParticles.BEAT_RING,
                        position.x,
                        position.y,
                        position.z,
                        timing == BeatTiming.PERFECT ? 2 : 1,
                        0.03D,
                        0.03D,
                        0.03D,
                        0.01D
                );
            }
        }
    }
}
