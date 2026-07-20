package de.aetherklang.entity;

import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.attribute.DefaultAttributeContainer;
import net.minecraft.entity.attribute.EntityAttributes;
import net.minecraft.entity.boss.BossBar;
import net.minecraft.entity.boss.ServerBossBar;
import net.minecraft.entity.mob.HostileEntity;
import net.minecraft.entity.mob.PhantomEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.particle.ParticleEffect;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

public final class ChoralEntity extends PhantomEntity {
    private static final int PHASE_ONE_INTERVAL = 90;
    private static final int PHASE_TWO_INTERVAL = 100;
    private static final int PHASE_THREE_INTERVAL = 120;
    private final ServerBossBar bossBar =
            new ServerBossBar(Text.translatable("entity.aetherklang.choral"), BossBar.Color.PURPLE, BossBar.Style.PROGRESS);

    public ChoralEntity(EntityType<? extends ChoralEntity> type, World world) {
        super(type, world);
        setPersistent();
        bossBar.setDarkenSky(true);
        bossBar.setDragonMusic(true);
        bossBar.setThickenFog(true);
    }

    public static DefaultAttributeContainer.Builder createAttributes() {
        return HostileEntity.createHostileAttributes()
                .add(EntityAttributes.MAX_HEALTH, 220.0)
                .add(EntityAttributes.ARMOR, 8.0)
                .add(EntityAttributes.ATTACK_DAMAGE, 10.0)
                .add(EntityAttributes.FOLLOW_RANGE, 48.0)
                .add(EntityAttributes.KNOCKBACK_RESISTANCE, 0.9)
                .add(EntityAttributes.FLYING_SPEED, 0.62);
    }

    public int getPhase() {
        float healthRatio = getHealth() / getMaxHealth();
        if (healthRatio > 0.66F) {
            return 1;
        }
        if (healthRatio > 0.33F) {
            return 2;
        }
        return 3;
    }

    @Override
    public void tick() {
        super.tick();
        if (!(getEntityWorld() instanceof ServerWorld world)) {
            return;
        }

        bossBar.setPercent(getHealth() / getMaxHealth());
        bossBar.setName(getDisplayName());
        bossBar.setColor(switch (getPhase()) {
            case 1 -> BossBar.Color.PURPLE;
            case 2 -> BossBar.Color.YELLOW;
            default -> BossBar.Color.RED;
        });

        if (age == 1) {
            playSound(ModSounds.CHORAL_THEME, 1.3F, 1.0F);
        }
        if (age % 4 == 0) {
            world.spawnParticles(
                    getPhase() == 2 ? ModParticles.DISSONANZ_SMOKE : ModParticles.BEAM_MOTE,
                    getX(),
                    getBodyY(0.58),
                    getZ(),
                    4 + getPhase(),
                    1.2,
                    1.4,
                    1.2,
                    0.02
            );
        }

        switch (getPhase()) {
            case 1 -> tickNoteRing(world);
            case 2 -> tickDissonanzStorm(world);
            default -> tickChorusBeam(world);
        }
    }

    private void tickNoteRing(ServerWorld world) {
        int cycle = age % PHASE_ONE_INTERVAL;
        if (cycle >= 65 && cycle % 3 == 0) {
            spawnHorizontalRing(
                    world,
                    ModParticles.BEAT_RING,
                    getEntityPos().add(0.0, getHeight() * 0.55, 0.0),
                    3.2,
                    20
            );
        }
        if (cycle != 0) {
            return;
        }

        Entity target = getTarget();
        for (int i = 0; i < 14; i++) {
            double angle = Math.PI * 2.0 * i / 14.0;
            Vec3d radial = new Vec3d(Math.cos(angle), 0.06 * Math.sin(angle * 3.0), Math.sin(angle));
            EchonoteEntity note = EchonoteEntity.create(world, this, target, false);
            note.setPosition(getEntityPos().add(radial.multiply(3.0)).add(0.0, getHeight() * 0.55, 0.0));
            note.setVelocity(radial.multiply(0.48));
            world.spawnEntity(note);
        }
        playSound(ModSounds.RESONANCE_CAST, 1.2F, 0.9F);
    }

    private void tickDissonanzStorm(ServerWorld world) {
        Entity target = getTarget();
        if (target == null) {
            return;
        }

        int cycle = age % PHASE_TWO_INTERVAL;
        Vec3d center = target.getEntityPos();
        if (cycle >= 65 && cycle % 3 == 0) {
            double radius = 5.0 - (cycle - 65) * 0.1;
            spawnHorizontalRing(world, ModParticles.DISSONANZ_SMOKE, center.add(0.0, 0.15, 0.0), Math.max(1.5, radius), 18);
        }
        if (cycle != 0) {
            return;
        }

        Box storm = Box.of(center, 12.0, 6.0, 12.0);
        for (PlayerEntity player : world.getEntitiesByClass(PlayerEntity.class, storm, PlayerEntity::isAlive)) {
            player.damage(world, world.getDamageSources().magic(), 9.0F);
            ResonanceEntityEffects.addDissonanz(player, 0.24F);
        }
        world.spawnParticles(
                ModParticles.DISSONANZ_SMOKE,
                center.x,
                center.y + 1.0,
                center.z,
                72,
                4.5,
                2.2,
                4.5,
                0.08
        );
        playSound(ModSounds.DISSONANZ_HIT, 1.35F, 0.55F);
    }

    private void tickChorusBeam(ServerWorld world) {
        Entity target = getTarget();
        if (target == null) {
            return;
        }

        int cycle = age % PHASE_THREE_INTERVAL;
        Vec3d origin = getEntityPos().add(0.0, getHeight() * 0.62, 0.0);
        Vec3d end = target.getBoundingBox().getCenter();
        if (cycle >= 75 && cycle % 2 == 0) {
            spawnBeam(world, origin, end, ModParticles.BEAM_MOTE, 0.0);
        }
        if (cycle != 0) {
            return;
        }

        spawnBeam(world, origin, end, ModParticles.BEAM_MOTE, 0.12);
        Vec3d beam = end.subtract(origin);
        double length = beam.length();
        Vec3d direction = beam.normalize();
        Box affected = new Box(origin, end).expand(2.0);
        for (PlayerEntity player : world.getEntitiesByClass(PlayerEntity.class, affected, PlayerEntity::isAlive)) {
            Vec3d relative = player.getBoundingBox().getCenter().subtract(origin);
            double projection = relative.dotProduct(direction);
            if (projection >= 0.0
                    && projection <= length
                    && relative.subtract(direction.multiply(projection)).lengthSquared() <= 2.25) {
                player.damage(world, world.getDamageSources().magic(), 14.0F);
                ResonanceEntityEffects.addDissonanz(player, 0.16F);
            }
        }
        playSound(ModSounds.DISSONANZ_HIT, 1.5F, 1.5F);
    }

    private static void spawnHorizontalRing(
            ServerWorld world,
            ParticleEffect particle,
            Vec3d center,
            double radius,
            int count
    ) {
        for (int i = 0; i < count; i++) {
            double angle = Math.PI * 2.0 * i / count;
            world.spawnParticles(
                    particle,
                    center.x + Math.cos(angle) * radius,
                    center.y,
                    center.z + Math.sin(angle) * radius,
                    1,
                    0.0,
                    0.0,
                    0.0,
                    0.0
            );
        }
    }

    private static void spawnBeam(
            ServerWorld world,
            Vec3d origin,
            Vec3d end,
            ParticleEffect particle,
            double speed
    ) {
        Vec3d delta = end.subtract(origin);
        int points = Math.max(4, (int) (delta.length() * 3.0));
        for (int i = 0; i <= points; i++) {
            Vec3d point = origin.add(delta.multiply(i / (double) points));
            world.spawnParticles(particle, point.x, point.y, point.z, 2, 0.08, 0.08, 0.08, speed);
        }
    }

    @Override
    public void onStartedTrackingBy(ServerPlayerEntity player) {
        super.onStartedTrackingBy(player);
        bossBar.addPlayer(player);
    }

    @Override
    public void onStoppedTrackingBy(ServerPlayerEntity player) {
        super.onStoppedTrackingBy(player);
        bossBar.removePlayer(player);
    }
}
