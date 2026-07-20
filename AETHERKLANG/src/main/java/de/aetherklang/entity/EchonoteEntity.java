package de.aetherklang.entity;

import de.aetherklang.leitmotiv.LeitmotivEffects;
import de.aetherklang.registry.ModEntities;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import java.util.UUID;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.data.DataTracker;
import net.minecraft.entity.data.TrackedData;
import net.minecraft.entity.data.TrackedDataHandlerRegistry;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.entity.projectile.ExplosiveProjectileEntity;
import net.minecraft.particle.ParticleEffect;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.storage.ReadView;
import net.minecraft.storage.WriteView;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.hit.EntityHitResult;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

public final class EchonoteEntity extends ExplosiveProjectileEntity {
    private static final TrackedData<Boolean> HEALING =
            DataTracker.registerData(EchonoteEntity.class, TrackedDataHandlerRegistry.BOOLEAN);
    private static final int MAX_AGE = 160;
    private UUID targetUuid;

    public EchonoteEntity(EntityType<? extends EchonoteEntity> type, World world) {
        super(type, world);
        accelerationPower = 0.0;
    }

    public static EchonoteEntity create(
            ServerWorld world,
            LivingEntity owner,
            Entity target,
            boolean healing
    ) {
        EchonoteEntity note = new EchonoteEntity(ModEntities.ECHONOTE, world);
        note.setOwner(owner);
        note.setHealing(healing);
        note.setTarget(target);
        note.setPosition(owner.getX(), owner.getEyeY() - 0.15, owner.getZ());

        Vec3d direction = target == null
                ? owner.getRotationVec(1.0F)
                : target.getBoundingBox().getCenter().subtract(note.getEntityPos()).normalize();
        note.setVelocity(direction.multiply(0.62));
        return note;
    }

    public static EchonoteEntity createForMood(ServerWorld world, PlayerEntity owner) {
        return create(world, owner, null, ResonanceEntityEffects.isHealingMood(owner));
    }

    @Override
    protected void initDataTracker(DataTracker.Builder builder) {
        super.initDataTracker(builder);
        builder.add(HEALING, false);
    }

    public boolean isHealing() {
        return dataTracker.get(HEALING);
    }

    public void setHealing(boolean healing) {
        dataTracker.set(HEALING, healing);
    }

    public void setTarget(Entity target) {
        targetUuid = target == null ? null : target.getUuid();
    }

    @Override
    public void tick() {
        super.tick();
        if (!(getEntityWorld() instanceof ServerWorld world)) {
            return;
        }

        if (age > MAX_AGE) {
            discard();
            return;
        }

        Entity target = targetUuid == null ? null : world.getEntity(targetUuid);
        if (target != null && target.isAlive()) {
            Vec3d desired = target.getBoundingBox().getCenter().subtract(getEntityPos()).normalize();
            Vec3d steered = getVelocity().multiply(0.82).add(desired.multiply(0.18));
            if (steered.lengthSquared() > 0.0001) {
                setVelocity(steered.normalize().multiply(0.62));
            }
        }
    }

    @Override
    protected ParticleEffect getParticleType() {
        return ModParticles.NOTE_SPARK;
    }

    @Override
    protected float getDrag() {
        return 1.0F;
    }

    @Override
    protected float getDragInWater() {
        return 0.92F;
    }

    @Override
    protected void onEntityHit(EntityHitResult hitResult) {
        super.onEntityHit(hitResult);
        if (!(getEntityWorld() instanceof ServerWorld world)) {
            return;
        }

        Entity hit = hitResult.getEntity();
        if (isHealing() && hit instanceof LivingEntity living) {
            float healing = 7.0F;
            if (getOwner() instanceof ServerPlayerEntity player) {
                healing *= LeitmotivEffects.getHealingMultiplier(player);
            }
            living.heal(healing);
            world.spawnParticles(
                    ModParticles.BEAT_RING,
                    hit.getX(),
                    hit.getBodyY(0.5),
                    hit.getZ(),
                    8,
                    0.35,
                    0.45,
                    0.35,
                    0.035
            );
        } else {
            Entity owner = getOwner();
            hit.damage(
                    world,
                    world.getDamageSources().indirectMagic(this, owner == null ? this : owner),
                    7.0F
            );
            if (hit instanceof PlayerEntity player) {
                ResonanceEntityEffects.addDissonanz(player, 0.08F);
            }
            world.spawnParticles(
                    ModParticles.NOTE_SPARK,
                    hit.getX(),
                    hit.getBodyY(0.5),
                    hit.getZ(),
                    12,
                    0.4,
                    0.5,
                    0.4,
                    0.06
            );
        }
        playSound(ModSounds.RESONANCE_CAST, 0.8F, isHealing() ? 1.65F : 0.75F);
        discard();
    }

    @Override
    protected void onBlockHit(BlockHitResult hitResult) {
        super.onBlockHit(hitResult);
        if (!getEntityWorld().isClient()) {
            discard();
        }
    }

    @Override
    protected void writeCustomData(WriteView view) {
        super.writeCustomData(view);
        view.putBoolean("Healing", isHealing());
        if (targetUuid != null) {
            view.putString("Target", targetUuid.toString());
        }
    }

    @Override
    protected void readCustomData(ReadView view) {
        super.readCustomData(view);
        setHealing(view.getBoolean("Healing", false));
        String target = view.getString("Target", "");
        if (!target.isEmpty()) {
            try {
                targetUuid = UUID.fromString(target);
            } catch (IllegalArgumentException ignored) {
                targetUuid = null;
            }
        }
    }
}
