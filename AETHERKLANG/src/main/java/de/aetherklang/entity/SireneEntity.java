package de.aetherklang.entity;

import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import java.util.List;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.attribute.DefaultAttributeContainer;
import net.minecraft.entity.attribute.EntityAttributes;
import net.minecraft.entity.damage.DamageSource;
import net.minecraft.entity.mob.HostileEntity;
import net.minecraft.entity.mob.MobEntity;
import net.minecraft.entity.mob.PhantomEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

public final class SireneEntity extends PhantomEntity {
    private static final int SONG_INTERVAL = 120;
    private static final int SONG_DURATION = 36;
    private static final double SONG_RADIUS = 16.0D;

    public SireneEntity(EntityType<? extends SireneEntity> type, World world) {
        super(type, world);
        setPersistent();
        setPhantomSize(2);
    }

    public static DefaultAttributeContainer.Builder createAttributes() {
        return HostileEntity.createHostileAttributes()
                .add(EntityAttributes.MAX_HEALTH, 90.0)
                .add(EntityAttributes.ARMOR, 6.0)
                .add(EntityAttributes.ATTACK_DAMAGE, 8.0)
                .add(EntityAttributes.FOLLOW_RANGE, 40.0)
                .add(EntityAttributes.KNOCKBACK_RESISTANCE, 0.55)
                .add(EntityAttributes.FLYING_SPEED, 0.58);
    }

    @Override
    protected boolean isAffectedByDaylight() {
        return false;
    }

    @Override
    public void tick() {
        super.tick();
        if (!(getEntityWorld() instanceof ServerWorld world)) {
            return;
        }

        if (age % 3 == 0) {
            world.spawnParticles(
                    ModParticles.SIRENEN_SCHLEIER,
                    getX(),
                    getBodyY(0.48D),
                    getZ(),
                    4,
                    0.48D,
                    0.68D,
                    0.48D,
                    0.015D
            );
        }

        int songTick = age % SONG_INTERVAL;
        if (songTick == 0) {
            playSound(ModSounds.SIRENE_SONG, 1.4F, 0.92F);
        }
        if (songTick < SONG_DURATION) {
            charmNearbyEntities(world, songTick);
        }
    }

    private void charmNearbyEntities(ServerWorld world, int songTick) {
        List<LivingEntity> listeners = world.getEntitiesByClass(
                LivingEntity.class,
                getBoundingBox().expand(SONG_RADIUS),
                entity -> entity != this && entity.isAlive() && !(entity instanceof SireneEntity)
        );
        for (LivingEntity listener : listeners) {
            Vec3d pull = getBoundingBox().getCenter()
                    .subtract(listener.getBoundingBox().getCenter());
            if (pull.lengthSquared() < 0.01D) {
                continue;
            }

            double strength = listener instanceof PlayerEntity ? 0.055D : 0.035D;
            Vec3d force = pull.normalize().multiply(strength);
            listener.addVelocity(force.x, Math.max(0.012D, force.y * 0.35D), force.z);
            listener.velocityModified = true;

            if (listener instanceof MobEntity mob && songTick % 10 == 0) {
                mob.setTarget(null);
                mob.getNavigation().startMovingTo(getX(), getY(), getZ(), 0.85D);
            }
        }

        if (songTick % 2 == 0) {
            double radius = 2.0D + songTick * 0.22D;
            for (int note = 0; note < 12; note++) {
                double angle = Math.PI * 2.0D * note / 12.0D + age * 0.08D;
                world.spawnParticles(
                        ModParticles.SIRENEN_SCHLEIER,
                        getX() + Math.cos(angle) * radius,
                        getBodyY(0.45D),
                        getZ() + Math.sin(angle) * radius,
                        1,
                        0.0D,
                        0.03D,
                        0.0D,
                        0.0D
                );
            }
        }
    }

    @Override
    public boolean damage(ServerWorld world, DamageSource source, float amount) {
        if (source.getAttacker() instanceof PlayerEntity player
                && ResonanceEntityEffects.isOnBeat(player)) {
            amount *= 1.75F;
            world.spawnParticles(
                    ModParticles.BEAT_RING,
                    getX(),
                    getBodyY(0.5D),
                    getZ(),
                    18,
                    0.75D,
                    0.9D,
                    0.75D,
                    0.04D
            );
            playSound(ModSounds.BEAT_TICK, 1.0F, 1.65F);
        }
        return super.damage(world, source, amount);
    }

}
