package de.aetherklang.entity;

import de.aetherklang.registry.ModBlocks;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.ai.goal.LookAtEntityGoal;
import net.minecraft.entity.ai.goal.MeleeAttackGoal;
import net.minecraft.entity.ai.goal.RevengeGoal;
import net.minecraft.entity.ai.goal.SwimGoal;
import net.minecraft.entity.ai.goal.WanderAroundFarGoal;
import net.minecraft.entity.attribute.DefaultAttributeContainer;
import net.minecraft.entity.attribute.EntityAttributes;
import net.minecraft.entity.damage.DamageSource;
import net.minecraft.entity.data.DataTracker;
import net.minecraft.entity.data.TrackedData;
import net.minecraft.entity.data.TrackedDataHandlerRegistry;
import net.minecraft.entity.mob.MobEntity;
import net.minecraft.entity.mob.PathAwareEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.World;

public final class HallwaechterEntity extends PathAwareEntity {
    private static final TrackedData<Boolean> SHIELDED =
            DataTracker.registerData(HallwaechterEntity.class, TrackedDataHandlerRegistry.BOOLEAN);
    private static final int ALTAR_GUARD_RADIUS = 12;
    private static final float HIGH_DISSONANZ = 0.65F;

    public HallwaechterEntity(EntityType<? extends HallwaechterEntity> type, World world) {
        super(type, world);
    }

    public static DefaultAttributeContainer.Builder createAttributes() {
        return MobEntity.createMobAttributes()
                .add(EntityAttributes.MAX_HEALTH, 52.0)
                .add(EntityAttributes.ARMOR, 10.0)
                .add(EntityAttributes.ATTACK_DAMAGE, 8.0)
                .add(EntityAttributes.ATTACK_KNOCKBACK, 1.1)
                .add(EntityAttributes.FOLLOW_RANGE, 24.0)
                .add(EntityAttributes.KNOCKBACK_RESISTANCE, 0.75)
                .add(EntityAttributes.MOVEMENT_SPEED, 0.27);
    }

    @Override
    protected void initGoals() {
        goalSelector.add(0, new SwimGoal(this));
        goalSelector.add(2, new MeleeAttackGoal(this, 1.0, true));
        goalSelector.add(6, new WanderAroundFarGoal(this, 0.7));
        goalSelector.add(7, new LookAtEntityGoal(this, PlayerEntity.class, 10.0F));
        targetSelector.add(1, new RevengeGoal(this));
    }

    @Override
    protected void initDataTracker(DataTracker.Builder builder) {
        super.initDataTracker(builder);
        builder.add(SHIELDED, false);
    }

    public boolean isShielded() {
        return dataTracker.get(SHIELDED);
    }

    @Override
    public void tick() {
        super.tick();
        if (!(getEntityWorld() instanceof ServerWorld world)) {
            return;
        }

        if (age % 20 == 0) {
            PlayerEntity dissonantPlayer = findDissonantPlayer(world);
            setShielded(dissonantPlayer != null);
            if ((getTarget() == null || !getTarget().isAlive())
                    && dissonantPlayer != null
                    && isNearStimmaltar()) {
                setTarget(dissonantPlayer);
            }
        }

        if (isShielded() && age % 4 == 0) {
            world.spawnParticles(
                    ModParticles.NOTE_SPARK,
                    getX(),
                    getBodyY(0.58),
                    getZ(),
                    3,
                    0.75,
                    1.05,
                    0.75,
                    0.015
            );
            world.spawnParticles(
                    ParticleTypes.END_ROD,
                    getX(),
                    getBodyY(0.58),
                    getZ(),
                    1,
                    0.65,
                    0.9,
                    0.65,
                    0.0
            );
        }
    }

    @Override
    public boolean damage(ServerWorld world, DamageSource source, float amount) {
        if (isShielded()) {
            amount *= 0.32F;
            world.spawnParticles(
                    ModParticles.BEAT_RING,
                    getX(),
                    getBodyY(0.5),
                    getZ(),
                    10,
                    0.8,
                    1.0,
                    0.8,
                    0.025
            );
            playSound(ModSounds.RESONANCE_CAST, 0.7F, 0.65F);
        }
        return super.damage(world, source, amount);
    }

    @Override
    public boolean tryAttack(ServerWorld world, Entity target) {
        boolean attacked = super.tryAttack(world, target);
        if (attacked) {
            world.spawnParticles(
                    ParticleTypes.ELECTRIC_SPARK,
                    target.getX(),
                    target.getBodyY(0.5),
                    target.getZ(),
                    7,
                    0.35,
                    0.45,
                    0.35,
                    0.06
            );
        }
        return attacked;
    }

    private void setShielded(boolean shielded) {
        if (shielded != isShielded()) {
            dataTracker.set(SHIELDED, shielded);
            if (shielded) {
                playSound(ModSounds.RESONANCE_CAST, 1.0F, 0.8F);
            }
        }
    }

    private PlayerEntity findDissonantPlayer(ServerWorld world) {
        return world.getEntitiesByClass(
                        PlayerEntity.class,
                        getBoundingBox().expand(14.0),
                        player -> !player.isSpectator()
                                && player.isAlive()
                                && ResonanceEntityEffects.getDissonanz(player) >= HIGH_DISSONANZ
                ).stream()
                .min((first, second) -> Double.compare(squaredDistanceTo(first), squaredDistanceTo(second)))
                .orElse(null);
    }

    private boolean isNearStimmaltar() {
        for (BlockPos pos : BlockPos.iterateOutwards(
                getBlockPos(),
                ALTAR_GUARD_RADIUS,
                ALTAR_GUARD_RADIUS / 2,
                ALTAR_GUARD_RADIUS
        )) {
            if (getEntityWorld().getBlockState(pos).isOf(ModBlocks.STIMMALTAR)) {
                return true;
            }
        }
        return false;
    }
}
