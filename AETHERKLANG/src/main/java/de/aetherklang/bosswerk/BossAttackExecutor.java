package de.aetherklang.bosswerk;

import de.aetherklang.Aetherklang;
import de.aetherklang.entity.EchonoteEntity;
import de.aetherklang.entity.ResonanceEntityEffects;
import de.aetherklang.registry.ModEntities;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import java.util.List;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.SpawnReason;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.entity.mob.HostileEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.particle.ParticleEffect;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;

final class BossAttackExecutor {
    private static final List<EntityType<? extends HostileEntity>> MOTIFS = List.of(
            ModEntities.MOTIV_LAEUFER,
            ModEntities.MOTIV_SCHWINGE,
            ModEntities.MOTIV_PULSER
    );

    private BossAttackExecutor() {
    }

    static void telegraph(
            ServerWorld world,
            BosswerkBossEntity boss,
            BossScore.Attack attack,
            Vec3d target
    ) {
        Vec3d center = switch (attack.operation()) {
            case STILLE_ZONE, FERMATE, GLEITSTOSS -> target;
            default -> boss.getEntityPos();
        };
        ParticleEffect particle = telegraphParticle(attack.operation());
        switch (attack.operation()) {
            case STRAHL_LINIE, GLEITSTOSS -> {
                Vec3d start = boss.getEntityPos().add(0.0D, boss.getHeight() * 0.55D, 0.0D);
                Vec3d end = target.add(0.0D, 0.65D, 0.0D);
                spawnBeam(world, start, end, particle, 0.0D);
                spawnBeam(world, start.add(0.0D, 0.18D, 0.0D), end.add(0.0D, 0.18D, 0.0D), ModParticles.BEAM_MOTE, 0.0D);
            }
            default -> {
                spawnRing(world, center.add(0.0D, 0.12D, 0.0D), attack.radius(), 48, particle);
                spawnRing(
                        world,
                        center.add(0.0D, 0.18D, 0.0D),
                        Math.max(0.7D, attack.radius() * 0.72D),
                        32,
                        attack.operation() == BossOperation.STILLE_ZONE
                                ? ModParticles.GENERALPAUSE_NEBEL
                                : ModParticles.KLANGOPERATION_RING
                );
            }
        }
    }

    static void execute(
            ServerWorld world,
            BosswerkBossEntity boss,
            BossScore.Attack attack,
            Vec3d target,
            Entity trackedTarget
    ) {
        Aetherklang.LOGGER.debug(
                "Bosswerk {} phase {} executes {}",
                boss.getBossId(),
                boss.getPhase() + 1,
                attack.operation()
        );
        switch (attack.operation()) {
            case SCHOCKWELLE -> shockwave(world, boss, attack);
            case NOTENRING -> noteRing(world, boss, attack, trackedTarget);
            case STRAHL_LINIE -> lineBeam(world, boss, attack, target);
            case STILLE_ZONE -> silenceZone(world, boss, attack, target);
            case BESCHWOERE_MOTIV -> summonMotifs(world, boss, trackedTarget);
            case KAKOPHONIE -> cacophony(world, boss, attack);
            case GLEITSTOSS -> glideStrike(world, boss, attack, target);
            case FERMATE -> fermata(world, boss, attack, target);
        }
        world.playSound(
                null,
                boss.getX(),
                boss.getY(),
                boss.getZ(),
                boss.getBossSound(),
                SoundCategory.HOSTILE,
                1.35F,
                0.82F + boss.getPhase() * 0.13F
        );
    }

    static void phaseTransition(ServerWorld world, BosswerkBossEntity boss) {
        Vec3d center = boss.getEntityPos().add(0.0D, boss.getHeight() * 0.5D, 0.0D);
        for (int tier = 0; tier < 3; tier++) {
            spawnRing(
                    world,
                    center.add(0.0D, (tier - 1) * 0.8D, 0.0D),
                    2.2D + tier * 1.1D,
                    44,
                    phaseParticle(boss)
            );
        }
        BosswerkNetworking.sendPhaseTransition(boss, boss.getPhase());
        world.playSound(
                null,
                boss.getX(),
                boss.getY(),
                boss.getZ(),
                boss.getBossSound(),
                SoundCategory.HOSTILE,
                1.8F,
                0.72F + boss.getPhase() * 0.18F
        );
    }

    static void intro(ServerWorld world, BosswerkBossEntity boss) {
        Vec3d center = boss.getEntityPos().add(0.0D, boss.getHeight() * 0.48D, 0.0D);
        ParticleEffect signature = phaseParticle(boss);
        for (int tier = 0; tier < 5; tier++) {
            spawnRing(
                    world,
                    center.add(0.0D, (tier - 2) * 0.62D, 0.0D),
                    1.8D + tier * 0.72D,
                    52 + tier * 4,
                    tier % 2 == 0 ? signature : ModParticles.KLANGOPERATION_RING
            );
        }
        world.spawnParticles(
                signature,
                center.x,
                center.y,
                center.z,
                84,
                boss.getWidth() * 0.9D,
                boss.getHeight() * 0.72D,
                boss.getWidth() * 0.9D,
                0.11D
        );
        BosswerkNetworking.sendIntro(boss);
        world.playSound(
                null,
                boss.getX(),
                boss.getY(),
                boss.getZ(),
                boss.getBossSound(),
                SoundCategory.HOSTILE,
                2.2F,
                0.62F
        );
    }

    private static void shockwave(ServerWorld world, BosswerkBossEntity boss, BossScore.Attack attack) {
        Vec3d center = boss.getEntityPos();
        spawnRing(world, center.add(0.0D, 0.15D, 0.0D), attack.radius(), 56, ModParticles.BEAT_RING);
        for (PlayerEntity player : playersAround(world, center, attack.radius())) {
            Vec3d away = player.getEntityPos().subtract(center);
            if (away.lengthSquared() < 0.01D) {
                away = new Vec3d(1.0D, 0.0D, 0.0D);
            }
            Vec3d force = away.normalize().multiply(1.15D).add(0.0D, 0.35D, 0.0D);
            player.addVelocity(force.x, force.y, force.z);
            player.velocityModified = true;
            damage(world, boss, player, attack.power(), 0.08F);
        }
    }

    private static void noteRing(
            ServerWorld world,
            BosswerkBossEntity boss,
            BossScore.Attack attack,
            Entity target
    ) {
        int notes = Math.clamp(Math.round(attack.radius() * 1.5F), 8, 18);
        for (int index = 0; index < notes; index++) {
            double angle = Math.PI * 2.0D * index / notes;
            Vec3d radial = new Vec3d(Math.cos(angle), 0.0D, Math.sin(angle));
            EchonoteEntity note = EchonoteEntity.create(world, boss, target, false);
            note.setPosition(boss.getEntityPos().add(radial.multiply(2.4D)).add(0.0D, boss.getHeight() * 0.5D, 0.0D));
            note.setVelocity(radial.multiply(0.34D).add(0.0D, 0.04D, 0.0D));
            world.spawnEntity(note);
        }
        spawnRing(
                world,
                boss.getEntityPos().add(0.0D, boss.getHeight() * 0.5D, 0.0D),
                2.4D,
                notes * 4,
                ModParticles.TREMOLO_SPLITTER
        );
    }

    private static void lineBeam(
            ServerWorld world,
            BosswerkBossEntity boss,
            BossScore.Attack attack,
            Vec3d target
    ) {
        Vec3d origin = boss.getEntityPos().add(0.0D, boss.getHeight() * 0.58D, 0.0D);
        Vec3d end = target.add(0.0D, 0.75D, 0.0D);
        Vec3d beam = end.subtract(origin);
        double length = beam.length();
        if (length < 0.01D) {
            return;
        }
        Vec3d direction = beam.normalize();
        double width = Math.max(1.0D, attack.radius() * 0.16D);
        for (PlayerEntity player : world.getEntitiesByClass(
                PlayerEntity.class,
                new Box(origin, end).expand(width),
                player -> player.isAlive() && !player.isSpectator()
        )) {
            Vec3d relative = player.getBoundingBox().getCenter().subtract(origin);
            double projection = relative.dotProduct(direction);
            double distanceSquared = relative.subtract(direction.multiply(projection)).lengthSquared();
            if (projection >= 0.0D && projection <= length && distanceSquared <= width * width) {
                damage(world, boss, player, attack.power(), 0.12F);
            }
        }
        spawnBeam(world, origin, end, ModParticles.BEAM_MOTE, 0.08D);
    }

    private static void silenceZone(
            ServerWorld world,
            BosswerkBossEntity boss,
            BossScore.Attack attack,
            Vec3d center
    ) {
        for (PlayerEntity player : playersAround(world, center, attack.radius())) {
            damage(world, boss, player, attack.power(), 0.16F);
            player.addStatusEffect(new StatusEffectInstance(StatusEffects.DARKNESS, 70, 0, false, true));
            player.addStatusEffect(new StatusEffectInstance(StatusEffects.SLOWNESS, 50, 1, false, true));
        }
        world.spawnParticles(
                ModParticles.GENERALPAUSE_NEBEL,
                center.x,
                center.y + 0.6D,
                center.z,
                110,
                attack.radius() * 0.6D,
                1.2D,
                attack.radius() * 0.6D,
                0.025D
        );
    }

    private static void summonMotifs(ServerWorld world, BosswerkBossEntity boss, Entity target) {
        for (int index = 0; index < MOTIFS.size(); index++) {
            EntityType<? extends HostileEntity> type = MOTIFS.get(index);
            HostileEntity motif = type.create(world, SpawnReason.EVENT);
            if (motif == null) {
                continue;
            }
            double angle = Math.PI * 2.0D * index / MOTIFS.size() + boss.getRandom().nextDouble() * 0.35D;
            motif.refreshPositionAndAngles(
                    boss.getX() + Math.cos(angle) * 3.5D,
                    boss.getY() + 0.2D,
                    boss.getZ() + Math.sin(angle) * 3.5D,
                    boss.getYaw(),
                    0.0F
            );
            motif.initialize(
                    world,
                    world.getLocalDifficulty(motif.getBlockPos()),
                    SpawnReason.EVENT,
                    null
            );
            if (target instanceof PlayerEntity player) {
                motif.setTarget(player);
            }
            world.spawnEntity(motif);
        }
        world.spawnParticles(
                ModParticles.LEITMOTIV_NOTE,
                boss.getX(),
                boss.getBodyY(0.5D),
                boss.getZ(),
                36,
                3.5D,
                1.2D,
                3.5D,
                0.04D
        );
    }

    private static void cacophony(ServerWorld world, BosswerkBossEntity boss, BossScore.Attack attack) {
        Vec3d center = boss.getEntityPos();
        for (PlayerEntity player : playersAround(world, center, attack.radius())) {
            damage(world, boss, player, attack.power(), 0.2F);
            player.addVelocity(
                    (boss.getRandom().nextDouble() - 0.5D) * 0.9D,
                    0.2D + boss.getRandom().nextDouble() * 0.25D,
                    (boss.getRandom().nextDouble() - 0.5D) * 0.9D
            );
            player.velocityModified = true;
        }
        world.spawnParticles(
                ModParticles.KAKOPHON_FUNKE,
                center.x,
                center.y + 1.0D,
                center.z,
                90,
                attack.radius() * 0.7D,
                2.2D,
                attack.radius() * 0.7D,
                0.12D
        );
    }

    private static void glideStrike(
            ServerWorld world,
            BosswerkBossEntity boss,
            BossScore.Attack attack,
            Vec3d target
    ) {
        Vec3d direction = target.subtract(boss.getEntityPos());
        if (direction.lengthSquared() > 0.01D) {
            Vec3d dash = direction.normalize().multiply(1.45D).add(0.0D, 0.18D, 0.0D);
            boss.setVelocity(dash);
            boss.velocityModified = true;
        }
        for (PlayerEntity player : playersAround(world, target, Math.max(2.5D, attack.radius() * 0.45D))) {
            damage(world, boss, player, attack.power(), 0.1F);
        }
        spawnBeam(
                world,
                boss.getEntityPos().add(0.0D, 0.8D, 0.0D),
                target.add(0.0D, 0.8D, 0.0D),
                ModParticles.GLISSANDO_SPUR,
                0.07D
        );
    }

    private static void fermata(
            ServerWorld world,
            BosswerkBossEntity boss,
            BossScore.Attack attack,
            Vec3d center
    ) {
        for (PlayerEntity player : playersAround(world, center, attack.radius())) {
            damage(world, boss, player, attack.power(), 0.1F);
            player.addStatusEffect(new StatusEffectInstance(StatusEffects.SLOWNESS, 65, 4, false, true));
            player.addStatusEffect(new StatusEffectInstance(StatusEffects.WEAKNESS, 65, 1, false, true));
        }
        for (int tier = 0; tier < 3; tier++) {
            spawnRing(
                    world,
                    center.add(0.0D, 0.25D + tier * 0.65D, 0.0D),
                    Math.max(1.0D, attack.radius() - tier * 1.3D),
                    24,
                    ModParticles.FERMATE_GLIMMER
            );
        }
        world.playSound(
                null,
                center.x,
                center.y,
                center.z,
                ModSounds.FERMATE_CHIME,
                SoundCategory.HOSTILE,
                1.3F,
                0.58F
        );
    }

    private static void damage(
            ServerWorld world,
            BosswerkBossEntity boss,
            PlayerEntity player,
            float amount,
            float dissonance
    ) {
        player.damage(world, world.getDamageSources().mobAttack(boss), amount);
        ResonanceEntityEffects.addDissonanz(player, dissonance);
    }

    private static List<PlayerEntity> playersAround(ServerWorld world, Vec3d center, double radius) {
        return world.getEntitiesByClass(
                PlayerEntity.class,
                Box.of(center, radius * 2.0D, Math.max(6.0D, radius), radius * 2.0D),
                player -> player.isAlive()
                        && !player.isSpectator()
                        && player.getEntityPos().squaredDistanceTo(center) <= radius * radius
        );
    }

    private static ParticleEffect telegraphParticle(BossOperation operation) {
        return switch (operation) {
            case SCHOCKWELLE -> ModParticles.BEAT_RING;
            case NOTENRING -> ModParticles.TREMOLO_SPLITTER;
            case STRAHL_LINIE -> ModParticles.BEAM_MOTE;
            case STILLE_ZONE -> ModParticles.GENERALPAUSE_NEBEL;
            case BESCHWOERE_MOTIV -> ModParticles.LEITMOTIV_NOTE;
            case KAKOPHONIE -> ModParticles.KAKOPHON_FUNKE;
            case GLEITSTOSS -> ModParticles.GLISSANDO_SPUR;
            case FERMATE -> ModParticles.FERMATE_GLIMMER;
        };
    }

    private static ParticleEffect phaseParticle(BosswerkBossEntity boss) {
        return switch (boss.getBossId()) {
            case ModEntities.BOSS_TREMOLO_ID -> ModParticles.TREMOLO_SPLITTER;
            case ModEntities.BOSS_GLISSANDA_ID -> ModParticles.GLISSANDO_SPUR;
            case ModEntities.BOSS_KAKOPHON_ID -> ModParticles.KAKOPHON_FUNKE;
            default -> ModParticles.GENERALPAUSE_NEBEL;
        };
    }

    private static void spawnRing(
            ServerWorld world,
            Vec3d center,
            double radius,
            int points,
            ParticleEffect particle
    ) {
        for (int point = 0; point < points; point++) {
            double angle = Math.PI * 2.0D * point / points;
            world.spawnParticles(
                    particle,
                    center.x + Math.cos(angle) * radius,
                    center.y,
                    center.z + Math.sin(angle) * radius,
                    1,
                    0.0D,
                    0.0D,
                    0.0D,
                    0.0D
            );
        }
    }

    private static void spawnBeam(
            ServerWorld world,
            Vec3d start,
            Vec3d end,
            ParticleEffect particle,
            double speed
    ) {
        Vec3d delta = end.subtract(start);
        int points = Math.max(6, (int) Math.ceil(delta.length() * 5.0D));
        for (int point = 0; point <= points; point++) {
            Vec3d position = start.add(delta.multiply(point / (double) points));
            world.spawnParticles(particle, position.x, position.y, position.z, 1, 0.04D, 0.04D, 0.04D, speed);
        }
    }
}
