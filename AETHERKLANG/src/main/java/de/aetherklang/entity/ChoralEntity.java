package de.aetherklang.entity;

import de.aetherklang.bosswerk.ChoralRepriseService;
import de.aetherklang.kanon.KanonEngine;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.attribute.DefaultAttributeContainer;
import net.minecraft.entity.attribute.EntityAttributeInstance;
import net.minecraft.entity.attribute.EntityAttributes;
import net.minecraft.entity.boss.BossBar;
import net.minecraft.entity.boss.ServerBossBar;
import net.minecraft.entity.mob.HostileEntity;
import net.minecraft.entity.mob.PhantomEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.particle.ParticleEffect;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.storage.ReadView;
import net.minecraft.storage.WriteView;
import net.minecraft.text.Text;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

public final class ChoralEntity extends PhantomEntity {
    private static final int PHASE_ONE_INTERVAL = 90;
    private static final int PHASE_TWO_INTERVAL = 100;
    private static final int PHASE_THREE_INTERVAL = 120;
    private int lastPhase = 1;
    private boolean reprise;
    private float attackMultiplier = 1.0F;
    private float echoChance;
    private float lifeSteal;
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

    public boolean isReprise() {
        return reprise;
    }

    public void setReprise(boolean reprise) {
        configureReprise(reprise, true);
    }

    private void configureReprise(boolean reprise, boolean refillHealth) {
        this.reprise = reprise;
        if (!reprise) {
            return;
        }

        ChoralRepriseService.RepriseAffixes affixes = ChoralRepriseService.affixes();
        attackMultiplier = 1.0F + affixes.attackBonus();
        echoChance = affixes.echoChance();
        lifeSteal = affixes.lifeSteal();
        setCustomName(Text.translatable("entity.aetherklang.choral_reprise"));

        setAttributeBase(EntityAttributes.MAX_HEALTH, 360.0D);
        setAttributeBase(EntityAttributes.ARMOR, 8.0D + affixes.armorBonus());
        setAttributeBase(EntityAttributes.ATTACK_DAMAGE, 10.0D * attackMultiplier);
        setAttributeBase(EntityAttributes.FLYING_SPEED, 0.62D * (1.0D + affixes.speedBonus()));
        if (refillHealth) {
            setHealth(getMaxHealth());
        } else {
            setHealth(Math.min(getHealth(), getMaxHealth()));
        }
    }

    private void setAttributeBase(
            net.minecraft.registry.entry.RegistryEntry<net.minecraft.entity.attribute.EntityAttribute> attribute,
            double value
    ) {
        EntityAttributeInstance instance = getAttributeInstance(attribute);
        if (instance != null) {
            instance.setBaseValue(value);
        }
    }

    @Override
    public void tick() {
        super.tick();
        if (!(getEntityWorld() instanceof ServerWorld world)) {
            return;
        }

        int phase = getPhase();
        if (phase != lastPhase) {
            spawnPhaseTransition(world, phase);
            lastPhase = phase;
        }

        bossBar.setPercent(getHealth() / getMaxHealth());
        bossBar.setName(getDisplayName());
        bossBar.setColor(switch (phase) {
            case 1 -> BossBar.Color.PURPLE;
            case 2 -> BossBar.Color.YELLOW;
            default -> BossBar.Color.RED;
        });

        if (age == 1) {
            playSound(ModSounds.CHORAL_THEME, 1.3F, 1.0F);
        }
        if (age % 4 == 0) {
            world.spawnParticles(
                    reprise ? ModParticles.KLANGOPERATION_RING
                            : getPhase() == 2 ? ModParticles.DISSONANZ_SMOKE : ModParticles.BEAM_MOTE,
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
        if (KanonEngine.isStaggered(this)) {
            return;
        }

        switch (phase) {
            case 1 -> tickNoteRing(world);
            case 2 -> tickDissonanzStorm(world);
            default -> tickChorusBeam(world);
        }
    }

    private void spawnPhaseTransition(ServerWorld world, int phase) {
        Vec3d center = getEntityPos().add(0.0D, getHeight() * 0.52D, 0.0D);
        for (int tier = 0; tier < 4; tier++) {
            spawnHorizontalRing(
                    world,
                    phase >= 3 ? ModParticles.AKKORD_GLYPH : ModParticles.BEAT_RING,
                    center.add(0.0D, (tier - 1.5D) * 0.85D, 0.0D),
                    2.2D + tier * 0.75D,
                    24 + tier * 4
            );
        }
        for (int step = -18; step <= 30; step++) {
            double y = center.y + step * 0.18D;
            double spiral = age * 0.12D + step * 0.48D;
            world.spawnParticles(
                    ModParticles.BEAM_MOTE,
                    center.x + Math.cos(spiral) * 0.55D,
                    y,
                    center.z + Math.sin(spiral) * 0.55D,
                    phase,
                    0.08D,
                    0.04D,
                    0.08D,
                    0.025D
            );
        }
        playSound(ModSounds.CHORAL_THEME, 1.8F, phase >= 3 ? 1.35F : 1.12F);
    }

    private void tickNoteRing(ServerWorld world) {
        int cycle = age % (reprise ? 65 : PHASE_ONE_INTERVAL);
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
        int noteCount = reprise && getRandom().nextFloat() < echoChance ? 20 : 14;
        for (int i = 0; i < noteCount; i++) {
            double angle = Math.PI * 2.0 * i / noteCount;
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

        int cycle = age % (reprise ? 78 : PHASE_TWO_INTERVAL);
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
            damagePlayer(world, player, 9.0F, 0.24F);
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

        int cycle = age % (reprise ? 92 : PHASE_THREE_INTERVAL);
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
                damagePlayer(world, player, 14.0F, 0.16F);
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

    private void damagePlayer(ServerWorld world, PlayerEntity player, float baseDamage, float dissonance) {
        float damage = baseDamage * attackMultiplier;
        if (player.damage(world, world.getDamageSources().magic(), damage)) {
            ResonanceEntityEffects.addDissonanz(player, dissonance * attackMultiplier);
            if (reprise && lifeSteal > 0.0F) {
                heal(damage * lifeSteal);
            }
        }
        if (reprise && getRandom().nextFloat() < echoChance) {
            float echoDamage = damage * 0.45F;
            if (player.damage(world, world.getDamageSources().magic(), echoDamage)) {
                ResonanceEntityEffects.addDissonanz(player, dissonance * 0.5F);
                if (lifeSteal > 0.0F) {
                    heal(echoDamage * lifeSteal);
                }
            }
        }
    }

    @Override
    protected void readCustomData(ReadView view) {
        super.readCustomData(view);
        configureReprise(view.getBoolean("AetherklangReprise", false), false);
    }

    @Override
    protected void writeCustomData(WriteView view) {
        super.writeCustomData(view);
        view.putBoolean("AetherklangReprise", reprise);
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
