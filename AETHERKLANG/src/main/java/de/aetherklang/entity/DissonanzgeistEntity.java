package de.aetherklang.entity;

import de.aetherklang.registry.ModBlocks;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.SpawnReason;
import net.minecraft.entity.attribute.DefaultAttributeContainer;
import net.minecraft.entity.attribute.EntityAttributes;
import net.minecraft.entity.damage.DamageSource;
import net.minecraft.entity.mob.HostileEntity;
import net.minecraft.entity.mob.PhantomEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.storage.ReadView;
import net.minecraft.storage.WriteView;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.World;
import net.minecraft.world.WorldAccess;
import net.minecraft.world.Heightmap;

public final class DissonanzgeistEntity extends PhantomEntity {
    private static final int RIFT_SEARCH_RADIUS = 8;
    private boolean riftSeeded;

    public DissonanzgeistEntity(EntityType<? extends DissonanzgeistEntity> type, World world) {
        super(type, world);
    }

    public static DefaultAttributeContainer.Builder createAttributes() {
        return HostileEntity.createHostileAttributes()
                .add(EntityAttributes.MAX_HEALTH, 28.0)
                .add(EntityAttributes.ATTACK_DAMAGE, 5.0)
                .add(EntityAttributes.FOLLOW_RANGE, 32.0)
                .add(EntityAttributes.FLYING_SPEED, 0.7);
    }

    @Override
    public void tick() {
        super.tick();
        if (!(getEntityWorld() instanceof ServerWorld world)) {
            return;
        }

        if (!riftSeeded) {
            riftSeeded = true;
            seedDissonanzriss(world);
        }
        if (age % 3 == 0) {
            world.spawnParticles(
                    ParticleTypes.WITCH,
                    getX(),
                    getBodyY(0.55),
                    getZ(),
                    2,
                    0.3,
                    0.45,
                    0.3,
                    0.01
            );
        }

        Entity target = getTarget();
        if (target != null && target.isAlive() && squaredDistanceTo(target) < 24.0 * 24.0 && age % 70 == 0) {
            EchonoteEntity note = EchonoteEntity.create(world, this, target, false);
            world.spawnEntity(note);
            playSound(ModSounds.DISSONANZ_HIT, 0.55F, 1.45F);
        }
    }

    @Override
    public boolean tryAttack(ServerWorld world, Entity target) {
        boolean attacked = super.tryAttack(world, target);
        if (attacked) {
            target.damage(world, world.getDamageSources().magic(), 3.0F);
            if (target instanceof PlayerEntity player) {
                ResonanceEntityEffects.addDissonanz(player, 0.12F);
            }
            world.spawnParticles(
                    ModParticles.DISSONANZ_SMOKE,
                    target.getX(),
                    target.getBodyY(0.5),
                    target.getZ(),
                    8,
                    0.35,
                    0.5,
                    0.35,
                    0.03
            );
        }
        return attacked;
    }

    @Override
    public boolean damage(ServerWorld world, DamageSource source, float amount) {
        if (source.getAttacker() instanceof PlayerEntity player && ResonanceEntityEffects.isOnBeat(player)) {
            amount *= 1.75F;
            world.spawnParticles(
                    ModParticles.BEAT_RING,
                    getX(),
                    getBodyY(0.5),
                    getZ(),
                    14,
                    0.55,
                    0.65,
                    0.55,
                    0.04
            );
            playSound(ModSounds.BEAT_TICK, 0.9F, 1.8F);
        }
        return super.damage(world, source, amount);
    }

    @Override
    public boolean canSpawn(WorldAccess world, SpawnReason reason) {
        if (reason == SpawnReason.COMMAND || reason == SpawnReason.SPAWN_ITEM_USE) {
            return true;
        }
        return super.canSpawn(world, reason)
                && (world.getLightLevel(getBlockPos()) <= 6 || isNearDissonanzriss(world, getBlockPos()));
    }

    private void seedDissonanzriss(ServerWorld world) {
        if (world.getRegistryKey() != World.OVERWORLD || isNearDissonanzriss(world, getBlockPos())) {
            return;
        }

        for (int attempt = 0; attempt < 8; attempt++) {
            BlockPos horizontal = getBlockPos().add(
                    getRandom().nextInt(7) - 3,
                    0,
                    getRandom().nextInt(7) - 3
            );
            BlockPos riftPos = world.getTopPosition(Heightmap.Type.MOTION_BLOCKING_NO_LEAVES, horizontal);
            if (world.getBlockState(riftPos).isAir()) {
                world.setBlockState(riftPos, ModBlocks.DISSONANZRISS.getDefaultState());
                world.spawnParticles(
                        ModParticles.DISSONANZ_SMOKE,
                        riftPos.getX() + 0.5D,
                        riftPos.getY() + 0.5D,
                        riftPos.getZ() + 0.5D,
                        16,
                        0.45D,
                        0.45D,
                        0.45D,
                        0.035D
                );
                return;
            }
        }
    }

    private static boolean isNearDissonanzriss(WorldAccess world, BlockPos center) {
        for (BlockPos pos : BlockPos.iterateOutwards(
                center,
                RIFT_SEARCH_RADIUS,
                RIFT_SEARCH_RADIUS / 2,
                RIFT_SEARCH_RADIUS
        )) {
            if (world.getBlockState(pos).isOf(ModBlocks.DISSONANZRISS)) {
                return true;
            }
        }
        return false;
    }

    @Override
    protected void writeCustomData(WriteView view) {
        super.writeCustomData(view);
        view.putBoolean("RiftSeeded", riftSeeded);
    }

    @Override
    protected void readCustomData(ReadView view) {
        super.readCustomData(view);
        riftSeeded = view.getBoolean("RiftSeeded", false);
    }
}
