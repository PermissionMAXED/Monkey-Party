package de.aetherklang.komposition;

import de.aetherklang.entity.EchonoteEntity;
import de.aetherklang.klangwerk.Klangoperation;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.resonance.ResonanceApi;
import java.util.List;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.particle.ParticleEffect;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;

/**
 * Player-safe interpretations of Klangwerk operations. Combat shapes and FX intentionally
 * mirror Bosswerk's shockwave, beam, field, summon, and fermata vocabulary.
 */
public final class ZauberpartiturExecutor {
    private static final double EFFECT_RADIUS = 7.0D;

    private ZauberpartiturExecutor() {
    }

    public static int rpCost(Zauberpartitur score) {
        return score.operations().stream().mapToInt(ZauberpartiturExecutor::operationCost).sum();
    }

    public static void execute(
            ServerWorld world,
            ServerPlayerEntity player,
            Zauberpartitur score,
            float timingMultiplier
    ) {
        float phrasePower = timingMultiplier;
        Klangoperation previous = null;
        for (Klangoperation operation : score.operations()) {
            if (operation == Klangoperation.ECHO) {
                if (previous != null && previous != Klangoperation.ECHO) {
                    executeOperation(world, player, previous, phrasePower * 0.65F);
                } else {
                    flourish(world, player.getEntityPos().add(0.0D, 1.0D, 0.0D), ModParticles.NOTE_SPARK, 12);
                }
                continue;
            }

            executeOperation(world, player, operation, phrasePower);
            previous = operation;
            if (operation == Klangoperation.HALTEN) {
                phrasePower += 0.12F;
            } else if (operation == Klangoperation.CRESCENDO) {
                phrasePower += 0.25F;
            } else if (operation == Klangoperation.KADENZ || operation == Klangoperation.FREIGABE) {
                phrasePower = timingMultiplier;
            }
        }
    }

    private static int operationCost(Klangoperation operation) {
        return switch (operation) {
            case HEILUNG, BESCHWOERUNG, FERMATE, KADENZ -> 4;
            case STRAHL, FELD, SCHUTZ, CRESCENDO -> 3;
            default -> 2;
        };
    }

    private static void executeOperation(
            ServerWorld world,
            ServerPlayerEntity player,
            Klangoperation operation,
            float power
    ) {
        switch (operation) {
            case ANSCHLAG -> strike(world, player, power);
            case HALTEN -> {
                player.addStatusEffect(new StatusEffectInstance(StatusEffects.ABSORPTION, 80, 0));
                flourish(world, player.getEntityPos().add(0.0D, 1.0D, 0.0D), ModParticles.NOTE_SPARK, 10);
            }
            case FREIGABE -> pulse(world, player, power * 1.2F, 5.0D, true);
            case IMPULS -> pulse(world, player, power, 4.5D, true);
            case WELLE -> wave(world, player, power);
            case STRAHL -> beam(world, player, power);
            case FELD -> field(world, player, power, false);
            case ECHO -> {
                // ECHO is resolved by execute so it can replay the previous operation.
            }
            case FERMATE -> field(world, player, power, true);
            case CRESCENDO -> {
                player.addStatusEffect(new StatusEffectInstance(StatusEffects.STRENGTH, 120, power >= 1.5F ? 1 : 0));
                flourish(world, player.getEntityPos().add(0.0D, 1.0D, 0.0D), ModParticles.KLANGOPERATION_RING, 18);
            }
            case OSTINATO -> {
                player.addStatusEffect(new StatusEffectInstance(StatusEffects.SPEED, 140, power >= 1.5F ? 1 : 0));
                flourish(world, player.getEntityPos().add(0.0D, 0.2D, 0.0D), ModParticles.GLISSANDO_SPUR, 14);
            }
            case KADENZ -> cadence(world, player, power);
            case BEWEGUNG -> movement(player, power);
            case SCHUTZ -> protection(world, player, power);
            case HEILUNG -> healing(world, player, power);
            case BESCHWOERUNG -> summonNotes(world, player, power);
        }
    }

    private static void strike(ServerWorld world, ServerPlayerEntity player, float power) {
        LivingEntity target = aimedTargets(world, player, 10.0D, 0.45D).stream().findFirst().orElse(null);
        Vec3d end = target == null
                ? player.getEyePos().add(player.getRotationVector().normalize().multiply(10.0D))
                : target.getBoundingBox().getCenter();
        drawBeam(world, player.getEyePos(), end, ModParticles.BEAM_MOTE);
        if (target != null) {
            damage(world, player, target, 3.5F * power);
        }
    }

    private static void pulse(
            ServerWorld world,
            ServerPlayerEntity player,
            float power,
            double radius,
            boolean knockback
    ) {
        Vec3d center = player.getEntityPos();
        for (LivingEntity target : hostileTargets(world, player, radius)) {
            damage(world, player, target, 2.5F * power);
            if (knockback) {
                Vec3d force = target.getEntityPos().subtract(center).multiply(1.0D, 0.0D, 1.0D);
                if (force.lengthSquared() < 0.01D) {
                    force = player.getRotationVector().multiply(1.0D, 0.0D, 1.0D);
                }
                force = force.normalize().multiply(0.75D * power).add(0.0D, 0.2D, 0.0D);
                target.addVelocity(force);
                target.velocityModified = true;
            }
        }
        ring(world, center.add(0.0D, 0.15D, 0.0D), radius, ModParticles.BEAT_RING);
    }

    private static void wave(ServerWorld world, ServerPlayerEntity player, float power) {
        Vec3d look = player.getRotationVector().normalize();
        for (LivingEntity target : aimedTargets(world, player, 8.0D, 0.15D)) {
            damage(world, player, target, 3.0F * power);
            target.addVelocity(look.multiply(0.65D * power).add(0.0D, 0.12D, 0.0D));
            target.velocityModified = true;
        }
        for (int step = 1; step <= 12; step++) {
            Vec3d center = player.getEyePos().add(look.multiply(step * 0.55D));
            double width = 0.12D * step;
            world.spawnParticles(ModParticles.NOTE_SPARK, center.x, center.y, center.z, 2, width, 0.15D, width, 0.02D);
        }
    }

    private static void beam(ServerWorld world, ServerPlayerEntity player, float power) {
        Vec3d start = player.getEyePos();
        Vec3d end = start.add(player.getRotationVector().normalize().multiply(14.0D));
        drawBeam(world, start, end, ModParticles.BEAM_MOTE);
        for (LivingEntity target : aimedTargets(world, player, 14.0D, 0.82D)) {
            damage(world, player, target, 4.0F * power);
        }
    }

    private static void field(
            ServerWorld world,
            ServerPlayerEntity player,
            float power,
            boolean fermata
    ) {
        int amplifier = power >= 1.5F ? 2 : 1;
        int duration = fermata ? 100 : 80;
        for (LivingEntity target : hostileTargets(world, player, EFFECT_RADIUS)) {
            target.addStatusEffect(new StatusEffectInstance(StatusEffects.SLOWNESS, duration, amplifier));
            if (fermata) {
                target.addStatusEffect(new StatusEffectInstance(StatusEffects.WEAKNESS, duration, 1));
            }
        }
        ParticleEffect particle = fermata ? ModParticles.FERMATE_GLIMMER : ModParticles.KLANGOPERATION_RING;
        ring(world, player.getEntityPos().add(0.0D, 0.2D, 0.0D), EFFECT_RADIUS, particle);
    }

    private static void cadence(ServerWorld world, ServerPlayerEntity player, float power) {
        pulse(world, player, power, 5.5D, false);
        player.heal(2.0F * power);
        player.addStatusEffect(new StatusEffectInstance(StatusEffects.REGENERATION, 80, 0));
        flourish(world, player.getEntityPos().add(0.0D, 1.0D, 0.0D), ModParticles.LEITMOTIV_NOTE, 24);
    }

    private static void movement(ServerPlayerEntity player, float power) {
        Vec3d direction = player.getRotationVector().multiply(1.0D, 0.0D, 1.0D);
        if (direction.lengthSquared() < 0.01D) {
            return;
        }
        Vec3d velocity = direction.normalize().multiply(1.1D * power).add(0.0D, 0.18D, 0.0D);
        player.addVelocity(velocity);
        player.velocityModified = true;
    }

    private static void protection(ServerWorld world, ServerPlayerEntity player, float power) {
        int amplifier = power >= 1.5F ? 1 : 0;
        player.addStatusEffect(new StatusEffectInstance(StatusEffects.RESISTANCE, 120, amplifier));
        player.addStatusEffect(new StatusEffectInstance(StatusEffects.ABSORPTION, 120, amplifier));
        ring(world, player.getEntityPos().add(0.0D, 1.0D, 0.0D), 1.6D, ModParticles.KLANGOPERATION_RING);
    }

    private static void healing(ServerWorld world, ServerPlayerEntity player, float power) {
        for (LivingEntity target : alliedTargets(world, player, EFFECT_RADIUS)) {
            target.heal(3.0F * power);
            world.spawnParticles(
                    ModParticles.NOTE_SPARK,
                    target.getX(),
                    target.getBodyY(0.65D),
                    target.getZ(),
                    8,
                    0.35D,
                    0.45D,
                    0.35D,
                    0.04D
            );
        }
    }

    private static void summonNotes(ServerWorld world, ServerPlayerEntity player, float power) {
        LivingEntity target = aimedTargets(world, player, 16.0D, -0.1D).stream().findFirst().orElse(null);
        int notes = power >= 1.5F ? 4 : 3;
        for (int index = 0; index < notes; index++) {
            EchonoteEntity note = EchonoteEntity.create(world, player, target, false);
            double angle = Math.PI * 2.0D * index / notes;
            note.setPosition(player.getEntityPos().add(Math.cos(angle), 1.15D, Math.sin(angle)));
            world.spawnEntity(note);
        }
        flourish(world, player.getEntityPos().add(0.0D, 1.0D, 0.0D), ModParticles.LEITMOTIV_NOTE, 18);
    }

    private static void damage(
            ServerWorld world,
            ServerPlayerEntity player,
            LivingEntity target,
            float amount
    ) {
        target.damage(
                world,
                player.getDamageSources().magic(),
                amount * ResonanceApi.getDamageMultiplier(player)
        );
    }

    private static List<LivingEntity> hostileTargets(
            ServerWorld world,
            ServerPlayerEntity player,
            double radius
    ) {
        return world.getEntitiesByClass(
                LivingEntity.class,
                Box.of(player.getEntityPos(), radius * 2.0D, radius * 2.0D, radius * 2.0D),
                target -> target != player && target.isAlive() && !player.isTeammate(target)
        );
    }

    private static List<LivingEntity> alliedTargets(
            ServerWorld world,
            ServerPlayerEntity player,
            double radius
    ) {
        return world.getEntitiesByClass(
                LivingEntity.class,
                Box.of(player.getEntityPos(), radius * 2.0D, radius * 2.0D, radius * 2.0D),
                target -> target.isAlive() && (target == player || player.isTeammate(target))
        );
    }

    private static List<LivingEntity> aimedTargets(
            ServerWorld world,
            ServerPlayerEntity player,
            double range,
            double minimumDot
    ) {
        Vec3d eye = player.getEyePos();
        Vec3d look = player.getRotationVector().normalize();
        return hostileTargets(world, player, range).stream()
                .filter(target -> {
                    Vec3d direction = target.getBoundingBox().getCenter().subtract(eye);
                    return direction.lengthSquared() <= range * range
                            && look.dotProduct(direction.normalize()) >= minimumDot;
                })
                .sorted((left, right) -> Double.compare(
                        left.squaredDistanceTo(player),
                        right.squaredDistanceTo(player)
                ))
                .toList();
    }

    private static void ring(
            ServerWorld world,
            Vec3d center,
            double radius,
            ParticleEffect particle
    ) {
        for (int point = 0; point < 36; point++) {
            double angle = Math.PI * 2.0D * point / 36.0D;
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

    private static void drawBeam(
            ServerWorld world,
            Vec3d start,
            Vec3d end,
            ParticleEffect particle
    ) {
        Vec3d delta = end.subtract(start);
        int points = Math.max(8, (int) Math.ceil(delta.length() * 4.0D));
        for (int point = 0; point <= points; point++) {
            Vec3d position = start.add(delta.multiply(point / (double) points));
            world.spawnParticles(particle, position.x, position.y, position.z, 1, 0.03D, 0.03D, 0.03D, 0.0D);
        }
    }

    private static void flourish(
            ServerWorld world,
            Vec3d center,
            ParticleEffect particle,
            int count
    ) {
        world.spawnParticles(particle, center.x, center.y, center.z, count, 0.65D, 0.7D, 0.65D, 0.05D);
    }
}
