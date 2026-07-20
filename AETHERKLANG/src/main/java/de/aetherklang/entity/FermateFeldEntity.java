package de.aetherklang.entity;

import de.aetherklang.registry.ModEntities;
import de.aetherklang.registry.ModItems;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.damage.DamageSource;
import net.minecraft.entity.data.DataTracker;
import net.minecraft.entity.data.TrackedData;
import net.minecraft.entity.data.TrackedDataHandlerRegistry;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.entity.projectile.ProjectileEntity;
import net.minecraft.entity.projectile.thrown.ThrownItemEntity;
import net.minecraft.item.Item;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.storage.ReadView;
import net.minecraft.storage.WriteView;
import net.minecraft.util.hit.HitResult;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

/**
 * The thrown Fermata bell and its temporary time-dampening field share one
 * entity. On first impact the projectile anchors itself and unfolds a
 * six-block dome for eight seconds.
 */
public final class FermateFeldEntity extends ThrownItemEntity {
    private static final TrackedData<Boolean> ACTIVE =
            DataTracker.registerData(FermateFeldEntity.class, TrackedDataHandlerRegistry.BOOLEAN);
    private static final double RADIUS = 6.0D;
    private static final int DURATION_TICKS = 8 * 20;
    private static final int SLOWNESS_AMPLIFIER = 6;
    private int fieldTicks;

    public FermateFeldEntity(EntityType<? extends FermateFeldEntity> type, World world) {
        super(type, world);
    }

    public static FermateFeldEntity createThrown(ServerWorld world, ServerPlayerEntity owner) {
        FermateFeldEntity field = new FermateFeldEntity(ModEntities.FERMATE_FELD, world);
        field.setOwner(owner);
        field.setPosition(owner.getX(), owner.getEyeY() - 0.12D, owner.getZ());
        field.setVelocity(owner, owner.getPitch(), owner.getYaw(), -12.0F, 1.15F, 0.45F);
        return field;
    }

    @Override
    protected void initDataTracker(DataTracker.Builder builder) {
        super.initDataTracker(builder);
        builder.add(ACTIVE, false);
    }

    @Override
    protected Item getDefaultItem() {
        return ModItems.FERMATENGLOCKE;
    }

    public boolean isActive() {
        return dataTracker.get(ACTIVE);
    }

    @Override
    public void tick() {
        if (!isActive()) {
            super.tick();
            return;
        }

        baseTick();
        if (!(getEntityWorld() instanceof ServerWorld world)) {
            return;
        }

        fieldTicks++;
        if (fieldTicks >= DURATION_TICKS) {
            discard();
            return;
        }

        dampenEntities(world);
        if (fieldTicks % 2 == 0) {
            spawnDomeMotes(world, 8);
        }
    }

    @Override
    protected void onCollision(HitResult hitResult) {
        if (isActive() || !(getEntityWorld() instanceof ServerWorld world)) {
            return;
        }

        setPosition(hitResult.getPos().add(0.0D, 0.08D, 0.0D));
        setVelocity(Vec3d.ZERO);
        setNoGravity(true);
        noClip = true;
        dataTracker.set(ACTIVE, true);
        fieldTicks = 0;

        world.playSound(
                null,
                getX(),
                getY(),
                getZ(),
                ModSounds.FERMATE_CHIME,
                SoundCategory.PLAYERS,
                1.2F,
                0.82F
        );
        spawnDomeMotes(world, 48);
    }

    private void dampenEntities(ServerWorld world) {
        Entity owner = getOwner();
        Box area = new Box(
                getX() - RADIUS,
                getY() - 0.5D,
                getZ() - RADIUS,
                getX() + RADIUS,
                getY() + RADIUS,
                getZ() + RADIUS
        );
        for (Entity entity : world.getOtherEntities(this, area, this::isAffected)) {
            if (entity == owner || !insideDome(entity.getBoundingBox().getCenter())) {
                continue;
            }

            if (entity instanceof LivingEntity living) {
                living.addStatusEffect(new StatusEffectInstance(
                        StatusEffects.SLOWNESS,
                        8,
                        SLOWNESS_AMPLIFIER,
                        false,
                        true
                ));
            }

            double velocityFactor = entity instanceof ProjectileEntity ? 0.05D : 0.18D;
            entity.setVelocity(entity.getVelocity().multiply(velocityFactor));
            entity.velocityModified = true;
        }
    }

    private boolean isAffected(Entity entity) {
        return entity.isAlive() && !(entity instanceof FermateFeldEntity);
    }

    private boolean insideDome(Vec3d position) {
        Vec3d offset = position.subtract(getEntityPos());
        return offset.y >= -0.5D && offset.lengthSquared() <= RADIUS * RADIUS;
    }

    private void spawnDomeMotes(ServerWorld world, int count) {
        for (int mote = 0; mote < count; mote++) {
            double y = random.nextDouble() * RADIUS;
            double horizontalRadius = Math.sqrt(Math.max(0.0D, RADIUS * RADIUS - y * y));
            double angle = random.nextDouble() * Math.PI * 2.0D;
            double shellOffset = random.nextDouble() < 0.7D ? 1.0D : random.nextDouble();
            world.spawnParticles(
                    ModParticles.FERMATE_GLIMMER,
                    getX() + Math.cos(angle) * horizontalRadius * shellOffset,
                    getY() + y,
                    getZ() + Math.sin(angle) * horizontalRadius * shellOffset,
                    1,
                    0.03D,
                    0.03D,
                    0.03D,
                    0.005D
            );
        }
    }

    @Override
    protected void readCustomData(ReadView view) {
        super.readCustomData(view);
        boolean active = view.getBoolean("Active", false);
        dataTracker.set(ACTIVE, active);
        fieldTicks = Math.clamp(view.getInt("FieldTicks", 0), 0, DURATION_TICKS);
        setNoGravity(active);
        noClip = active;
    }

    @Override
    protected void writeCustomData(WriteView view) {
        super.writeCustomData(view);
        view.putBoolean("Active", isActive());
        view.putInt("FieldTicks", fieldTicks);
    }

    @Override
    public boolean damage(ServerWorld world, DamageSource source, float amount) {
        return false;
    }
}
