package de.aetherklang.sturmfront;

import de.aetherklang.Aetherklang;
import de.aetherklang.resonance.AkkordEngine;
import de.aetherklang.entity.ResonanceEntityEffects;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.world.KammertonWorld;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.text.Text;
import net.minecraft.util.math.Vec3d;

/**
 * Server-authoritative dissonance weather that patrols a fixed route across the Klangmeer.
 */
public final class SturmfrontEngine {
    private static final List<Vec3d> ROUTE = List.of(
            new Vec3d(-1_800.0D, 0.0D, -420.0D),
            new Vec3d(-900.0D, 0.0D, 0.0D),
            new Vec3d(-180.0D, 0.0D, 620.0D),
            new Vec3d(0.0D, 0.0D, 1_600.0D),
            new Vec3d(780.0D, 0.0D, 960.0D),
            new Vec3d(900.0D, 0.0D, 0.0D),
            new Vec3d(240.0D, 0.0D, -1_420.0D),
            new Vec3d(-980.0D, 0.0D, -1_080.0D)
    );
    private static final double MARCH_SPEED = 0.22D;
    private static final float BASE_RADIUS = 220.0F;
    private static final float MIN_INTENSITY = 0.28F;
    private static final float RECOVERY_PER_TICK = 0.000015F;
    private static final double RESPONSE_REACH = 72.0D;
    private static final int SYNC_INTERVAL_TICKS = 20;
    private static final int AMBIENT_INTERVAL_TICKS = 5;

    private static final Map<ServerWorld, ActiveFront> ACTIVE = new IdentityHashMap<>();
    private static boolean registered;

    private SturmfrontEngine() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        ServerTickEvents.END_WORLD_TICK.register(SturmfrontEngine::tick);
        ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> sync(handler.getPlayer()));
        ServerLifecycleEvents.SERVER_STOPPED.register(server -> ACTIVE.clear());
        SturmfrontCommands.register();
    }

    public static SturmfrontSnapshot snapshot(ServerWorld world) {
        ActiveFront front = ACTIVE.get(world);
        return front == null ? SturmfrontSnapshot.inactive() : front.snapshot();
    }

    public static void sync(ServerPlayerEntity player) {
        if (!KammertonWorld.isKammerton(player.getEntityWorld())) {
            SturmfrontNetworking.send(player, SturmfrontSnapshot.inactive());
            return;
        }
        SturmfrontNetworking.send(player, snapshot(player.getEntityWorld()));
    }

    /**
     * Places the front at an explicit location for operators and deterministic smoke tests.
     */
    static boolean summon(ServerWorld world, Vec3d position) {
        if (!KammertonWorld.isKammerton(world)
                || !Double.isFinite(position.x)
                || !Double.isFinite(position.z)) {
            return false;
        }
        ActiveFront front = ACTIVE.computeIfAbsent(world, ignored -> ActiveFront.create());
        front.relocate(position.x, position.z);
        SturmfrontNetworking.broadcast(world, front.snapshot());
        Aetherklang.LOGGER.info(
                "Sturmfront summoned in {} at x={}, z={}",
                world.getRegistryKey().getValue(),
                Math.round(front.centerX),
                Math.round(front.centerZ)
        );
        return true;
    }

    /**
     * Completed three-note chords shove and briefly weaken a nearby front.
     */
    public static double onAkkord(ServerPlayerEntity player, AkkordEngine.Akkord akkord) {
        double distance = switch (akkord) {
            case HEILENDER_DREIKLANG -> 24.0D;
            case STURZKADENZ -> 38.0D;
            case SANFTE_AUFLOESUNG -> 30.0D;
            case STERNENFORTISSIMO -> 54.0D;
        };
        float suppression = switch (akkord) {
            case HEILENDER_DREIKLANG -> 0.03F;
            case STURZKADENZ -> 0.05F;
            case SANFTE_AUFLOESUNG -> 0.04F;
            case STERNENFORTISSIMO -> 0.08F;
        };
        double pushed = push(player.getEntityWorld(), player.getEntityPos(), distance, suppression);
        if (pushed > 0.0D) {
            player.sendMessage(
                    Text.translatable("message.aetherklang.sturmfront.akkord_push", Math.round(pushed)),
                    true
            );
        }
        return pushed;
    }

    /**
     * A World Chord provides the strongest counterplay and can throw the front beyond an island.
     */
    public static double onWeltakkord(
            ServerWorld world,
            Vec3d origin,
            int power,
            boolean reduced
    ) {
        int clampedPower = Math.clamp(power, 1, 8);
        double distance = reduced ? 72.0D : 120.0D + clampedPower * 14.0D;
        float suppression = reduced ? 0.12F : 0.18F + clampedPower * 0.03F;
        double pushed = push(world, origin, distance, suppression);
        if (pushed <= 0.0D) {
            return 0.0D;
        }

        for (ServerPlayerEntity player : world.getPlayers(candidate ->
                candidate.isAlive() && candidate.squaredDistanceTo(origin) <= 48.0D * 48.0D
        )) {
            player.sendMessage(
                    Text.translatable("message.aetherklang.sturmfront.weltakkord_push", Math.round(pushed)),
                    false
            );
        }
        return pushed;
    }

    static double pushForCommand(ServerWorld world, Vec3d origin, int power) {
        return onWeltakkord(world, origin, power, false);
    }

    private static double push(
            ServerWorld world,
            Vec3d origin,
            double distance,
            float suppression
    ) {
        if (!KammertonWorld.isKammerton(world)) {
            return 0.0D;
        }
        ActiveFront front = ACTIVE.get(world);
        if (front == null || front.distanceSquared(origin) > square(front.radius() + RESPONSE_REACH)) {
            return 0.0D;
        }

        Vec3d away = new Vec3d(front.centerX - origin.x, 0.0D, front.centerZ - origin.z);
        if (away.lengthSquared() < 0.0001D) {
            away = new Vec3d(-front.directionX, 0.0D, -front.directionZ);
        }
        if (away.lengthSquared() < 0.0001D) {
            away = new Vec3d(1.0D, 0.0D, 0.0D);
        }
        Vec3d impulse = away.normalize().multiply(distance);
        front.centerX += impulse.x;
        front.centerZ += impulse.z;
        front.intensity = Math.max(MIN_INTENSITY, front.intensity - suppression);
        front.revision++;

        responseFx(world, origin, distance);
        SturmfrontNetworking.broadcast(world, front.snapshot());
        Aetherklang.LOGGER.info(
                "Sturmfront pushed {} blocks to x={}, z={}; intensity={}",
                Math.round(distance),
                Math.round(front.centerX),
                Math.round(front.centerZ),
                String.format(java.util.Locale.ROOT, "%.2f", front.intensity)
        );
        return distance;
    }

    private static void tick(ServerWorld world) {
        if (!KammertonWorld.isKammerton(world)) {
            return;
        }

        ActiveFront front = ACTIVE.computeIfAbsent(world, ignored -> {
            Aetherklang.LOGGER.info("Sturmfront entered the Klangmeer patrol");
            return ActiveFront.create();
        });
        front.march();
        int tick = world.getServer().getTicks();
        if (tick % AMBIENT_INTERVAL_TICKS == 0) {
            spawnAmbient(world, front);
        }
        if (tick % SYNC_INTERVAL_TICKS == 0) {
            affectPlayers(world, front);
            SturmfrontNetworking.broadcast(world, front.snapshot());
        }
    }

    private static void affectPlayers(ServerWorld world, ActiveFront front) {
        Set<UUID> currentlyExposed = new HashSet<>();
        for (ServerPlayerEntity player : world.getPlayers()) {
            float exposure = front.exposureAt(player.getEntityPos());
            if (exposure <= 0.0F || !player.isAlive() || player.isSpectator()) {
                continue;
            }
            currentlyExposed.add(player.getUuid());
            if (front.exposedPlayers.add(player.getUuid())) {
                player.sendMessage(Text.translatable("message.aetherklang.sturmfront.enter"), false);
            }

            ResonanceEntityEffects.addDissonanz(player, 0.012F + exposure * 0.026F);
            player.addStatusEffect(new StatusEffectInstance(
                    StatusEffects.SLOWNESS,
                    50,
                    exposure >= 0.72F ? 1 : 0,
                    true,
                    true
            ));
            if (exposure >= 0.58F) {
                player.addStatusEffect(new StatusEffectInstance(
                        StatusEffects.DARKNESS,
                        35,
                        0,
                        true,
                        true
                ));
            }
            if (world.getServer().getTicks() % 80 == 0) {
                world.playSound(
                        null,
                        player.getBlockPos(),
                        ModSounds.DISSONANZ_HIT,
                        SoundCategory.AMBIENT,
                        0.45F + exposure * 0.35F,
                        0.58F + exposure * 0.18F
                );
            }
        }
        front.exposedPlayers.retainAll(currentlyExposed);
    }

    private static void spawnAmbient(ServerWorld world, ActiveFront front) {
        for (ServerPlayerEntity player : world.getPlayers()) {
            float exposure = front.exposureAt(player.getEntityPos());
            if (exposure <= 0.0F) {
                continue;
            }
            int smoke = 2 + Math.round(exposure * 7.0F);
            double spread = 2.5D + exposure * 4.0D;
            world.spawnParticles(
                    ModParticles.DISSONANZ_SMOKE,
                    player.getX(),
                    player.getY() + 2.0D,
                    player.getZ(),
                    smoke,
                    spread,
                    2.0D + exposure * 2.5D,
                    spread,
                    0.018D + exposure * 0.025D
            );
            if (exposure >= 0.45F) {
                world.spawnParticles(
                        ModParticles.GENERALPAUSE_NEBEL,
                        player.getX(),
                        player.getY() + 0.8D,
                        player.getZ(),
                        2 + Math.round(exposure * 3.0F),
                        spread * 0.72D,
                        0.8D,
                        spread * 0.72D,
                        0.012D
                );
            }
        }
    }

    private static void responseFx(ServerWorld world, Vec3d origin, double distance) {
        int points = 28 + Math.min(36, (int) Math.round(distance / 5.0D));
        for (int point = 0; point < points; point++) {
            double angle = point * Math.PI * 2.0D / points;
            double radius = 2.5D + distance / 90.0D;
            world.spawnParticles(
                    ModParticles.AKKORD_GLYPH,
                    origin.x + Math.cos(angle) * radius,
                    origin.y + 0.25D,
                    origin.z + Math.sin(angle) * radius,
                    1,
                    0.02D,
                    0.04D,
                    0.02D,
                    0.03D
            );
        }
        world.spawnParticles(
                ModParticles.DISSONANZ_SMOKE,
                origin.x,
                origin.y + 1.0D,
                origin.z,
                36,
                2.8D,
                1.5D,
                2.8D,
                0.12D
        );
        world.playSound(
                null,
                origin.x,
                origin.y,
                origin.z,
                ModSounds.AKKORD_COMPLETE,
                SoundCategory.PLAYERS,
                1.35F,
                0.82F
        );
    }

    private static double square(double value) {
        return value * value;
    }

    private static final class ActiveFront {
        private final Set<UUID> exposedPlayers = new HashSet<>();
        private double centerX;
        private double centerZ;
        private float directionX;
        private float directionZ;
        private float intensity = 1.0F;
        private int nextWaypoint = 1;
        private long revision = 1L;

        private static ActiveFront create() {
            ActiveFront front = new ActiveFront();
            Vec3d start = ROUTE.getFirst();
            front.centerX = start.x;
            front.centerZ = start.z;
            front.updateDirection();
            return front;
        }

        private void march() {
            Vec3d target = ROUTE.get(nextWaypoint);
            double deltaX = target.x - centerX;
            double deltaZ = target.z - centerZ;
            double remaining = Math.hypot(deltaX, deltaZ);
            if (remaining <= 8.0D) {
                centerX = target.x;
                centerZ = target.z;
                nextWaypoint = (nextWaypoint + 1) % ROUTE.size();
                updateDirection();
            } else {
                directionX = (float) (deltaX / remaining);
                directionZ = (float) (deltaZ / remaining);
                double step = Math.min(MARCH_SPEED, remaining);
                centerX += directionX * step;
                centerZ += directionZ * step;
            }
            intensity = Math.min(1.0F, intensity + RECOVERY_PER_TICK);
        }

        private void relocate(double x, double z) {
            centerX = x;
            centerZ = z;
            int nearest = 0;
            double nearestDistance = Double.MAX_VALUE;
            for (int index = 0; index < ROUTE.size(); index++) {
                Vec3d waypoint = ROUTE.get(index);
                double distance = square(centerX - waypoint.x) + square(centerZ - waypoint.z);
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearest = index;
                }
            }
            nextWaypoint = (nearest + 1) % ROUTE.size();
            intensity = 1.0F;
            revision++;
            updateDirection();
        }

        private void updateDirection() {
            Vec3d target = ROUTE.get(nextWaypoint);
            double deltaX = target.x - centerX;
            double deltaZ = target.z - centerZ;
            double length = Math.hypot(deltaX, deltaZ);
            if (length > 0.0001D) {
                directionX = (float) (deltaX / length);
                directionZ = (float) (deltaZ / length);
            }
        }

        private float radius() {
            return BASE_RADIUS * (0.72F + intensity * 0.28F);
        }

        private float exposureAt(Vec3d position) {
            double distance = Math.sqrt(distanceSquared(position));
            float falloff = 1.0F - (float) (distance / radius());
            return Math.clamp(falloff * intensity, 0.0F, 1.0F);
        }

        private double distanceSquared(Vec3d position) {
            return square(centerX - position.x) + square(centerZ - position.z);
        }

        private SturmfrontSnapshot snapshot() {
            return new SturmfrontSnapshot(
                    true,
                    centerX,
                    centerZ,
                    radius(),
                    directionX,
                    directionZ,
                    intensity,
                    revision
            );
        }
    }
}
