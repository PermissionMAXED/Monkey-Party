package de.aetherklang.item;

import de.aetherklang.registry.ModParticles;
import de.aetherklang.resonance.BeatEngine;
import de.aetherklang.resonance.BeatTiming;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.consume.UseAction;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

public final class HallharfeItem extends Item {
    private static final double HEAL_RADIUS = 7.0;
    private static final Map<UUID, Long> LAST_PULSE_TICK = new ConcurrentHashMap<>();

    public HallharfeItem(Settings settings) {
        super(settings);
    }

    @Override
    public ActionResult use(World world, PlayerEntity player, Hand hand) {
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
        LAST_PULSE_TICK.remove(user.getUuid());
        return super.onStoppedUsing(stack, world, user, remainingUseTicks);
    }

    @Override
    public void usageTick(World world, LivingEntity user, ItemStack stack, int remainingUseTicks) {
        if (!(world instanceof ServerWorld serverWorld)
                || !(user instanceof PlayerEntity player)
                || !ResonanceItemUtil.isOnBeat(player)) {
            return;
        }
        long currentTick = serverWorld.getTime();
        Long lastPulse = LAST_PULSE_TICK.get(player.getUuid());
        if (lastPulse != null && currentTick - lastPulse < 5L) {
            return;
        }
        LAST_PULSE_TICK.put(player.getUuid(), currentTick);

        float healAmount = ResonanceItemUtil.hasFreude(player) ? 3.0F : 2.0F;
        List<LivingEntity> allies = serverWorld.getEntitiesByClass(
                LivingEntity.class,
                player.getBoundingBox().expand(HEAL_RADIUS),
                target -> target.isAlive() && (target == player || player.isTeammate(target))
        );
        boolean healed = false;
        for (LivingEntity ally : allies) {
            if (ally.getHealth() >= ally.getMaxHealth()) {
                continue;
            }
            ally.heal(healAmount);
            healed = true;
            serverWorld.spawnParticles(
                    ParticleTypes.HEART,
                    ally.getX(),
                    ally.getBodyY(0.75),
                    ally.getZ(),
                    4,
                    0.4,
                    0.35,
                    0.4,
                    0.02
            );
        }

        Vec3d look = player.getRotationVector().normalize();
        for (int step = 1; step <= 12; step++) {
            Vec3d point = player.getEyePos().add(look.multiply(step * 0.55));
            serverWorld.spawnParticles(
                    ModParticles.BEAM_MOTE,
                    point.x,
                    point.y,
                    point.z,
                    1,
                    0.05,
                    0.05,
                    0.05,
                    0.0
            );
        }
        serverWorld.spawnParticles(
                ModParticles.BEAT_RING,
                player.getX(),
                player.getY() + 0.15,
                player.getZ(),
                8,
                1.6,
                0.15,
                1.6,
                0.02
        );

        if (healed) {
            ResonanceItemUtil.gainRp(player, 1);
            if (player instanceof ServerPlayerEntity serverPlayer
                    && BeatEngine.getTiming(serverPlayer) == BeatTiming.PERFECT) {
                BeatEngine.grantPerfectTimingRp(serverPlayer);
            }
        }
        ResonanceItemUtil.playCast(serverWorld, player, ResonanceItemUtil.hasFreude(player) ? 1.4F : 1.15F);
        stack.damage(1, player);
    }
}
