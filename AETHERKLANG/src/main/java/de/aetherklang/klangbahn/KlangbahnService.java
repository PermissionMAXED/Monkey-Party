package de.aetherklang.klangbahn;

import de.aetherklang.block.StimmpfeilerBlock;
import de.aetherklang.registry.ModBlocks;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.UUID;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.block.BlockState;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.decoration.ArmorStandEntity;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.text.Text;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;

/**
 * Owns active Klangbahn rides and paints their paired light rails.
 */
public final class KlangbahnService {
    public static final int MAX_ROUTE_RANGE = 64;

    private static final int MAX_VERTICAL_RANGE = 32;
    private static final double CRUISE_SPEED = 0.58D;
    private static final double BEAT_SPEED = 0.82D;
    private static final int TICKS_PER_BEAT = 10;
    private static final Map<UUID, Ride> ACTIVE_RIDES = new HashMap<>();
    private static boolean registered;

    private KlangbahnService() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        ServerTickEvents.END_SERVER_TICK.register(KlangbahnService::tick);
        ServerLifecycleEvents.SERVER_STOPPING.register(server -> clear());
    }

    public static boolean boardFromAnchor(ServerWorld world, BlockPos anchor, ServerPlayerEntity player) {
        BlockPos pillar = findAttunedPillar(world, anchor);
        if (pillar == null) {
            player.sendMessage(Text.translatable("message.aetherklang.klangbahn.no_pillar"), true);
            return false;
        }
        return beginRide(world, anchor, pillar, player);
    }

    /**
     * Gives an attuned pillar's normal use priority to a nearby Bahnanker.
     * Without an anchor, the established cross-region pillar route remains unchanged.
     */
    public static boolean boardFromPillar(ServerWorld world, BlockPos pillar, ServerPlayerEntity player) {
        BlockPos anchor = findAnchor(world, pillar);
        return anchor != null && beginRide(world, normalizePillarTop(world, pillar), anchor, player);
    }

    private static boolean beginRide(
            ServerWorld world,
            BlockPos departure,
            BlockPos destination,
            ServerPlayerEntity player
    ) {
        if (ACTIVE_RIDES.containsKey(player.getUuid()) || player.hasVehicle()) {
            player.sendMessage(Text.translatable("message.aetherklang.klangbahn.already_riding"), true);
            return false;
        }

        KlangbahnRoute route = KlangbahnRoute.between(departure, destination);
        ArmorStandEntity carriage = new ArmorStandEntity(EntityType.ARMOR_STAND, world);
        carriage.setPosition(route.start());
        carriage.setInvisible(true);
        carriage.setInvulnerable(true);
        carriage.setNoGravity(true);
        carriage.setSilent(true);
        carriage.noClip = true;

        if (!world.spawnEntity(carriage) || !player.startRiding(carriage)) {
            carriage.discard();
            player.sendMessage(Text.translatable("message.aetherklang.klangbahn.blocked"), true);
            return false;
        }

        player.fallDistance = 0.0F;
        player.setVelocity(Vec3d.ZERO);
        ACTIVE_RIDES.put(player.getUuid(), new Ride(world, carriage, route));
        pulseWholeRail(world, route);
        world.playSound(null, departure, ModSounds.RESONANCE_CAST, SoundCategory.PLAYERS, 0.9F, 1.55F);
        player.sendMessage(Text.translatable("message.aetherklang.klangbahn.departure"), true);
        return true;
    }

    private static void tick(MinecraftServer server) {
        Iterator<Map.Entry<UUID, Ride>> iterator = ACTIVE_RIDES.entrySet().iterator();
        while (iterator.hasNext()) {
            Map.Entry<UUID, Ride> entry = iterator.next();
            ServerPlayerEntity player = server.getPlayerManager().getPlayer(entry.getKey());
            Ride ride = entry.getValue();
            if (!canContinue(player, ride)) {
                abort(player, ride);
                iterator.remove();
                continue;
            }

            int beatPhase = Math.floorMod(ride.world.getTime(), TICKS_PER_BEAT);
            double speed = beatPhase < 2 ? BEAT_SPEED : CRUISE_SPEED;
            ride.progress = Math.min(1.0D, ride.progress + speed / ride.route.length());
            Vec3d previous = ride.carriage.getEntityPos();
            Vec3d next = ride.route.sample(ride.progress);
            ride.carriage.setPosition(next);
            ride.carriage.setYaw(ride.route.yaw(ride.progress));
            ride.carriage.setVelocity(next.subtract(previous));
            ride.carriage.velocityModified = true;
            ride.carriage.updatePassengerPosition(player);
            player.fallDistance = 0.0F;
            spawnMovingRails(ride.world, ride.route, ride.progress);

            if (beatPhase == 0) {
                pulseWholeRail(ride.world, ride.route);
                ride.world.spawnParticles(
                        ModParticles.BEAT_RING,
                        next.x,
                        next.y + 0.35D,
                        next.z,
                        12,
                        0.45D,
                        0.35D,
                        0.45D,
                        0.035D
                );
                ride.world.playSound(
                        null,
                        next.x,
                        next.y,
                        next.z,
                        ModSounds.BEAT_TICK,
                        SoundCategory.PLAYERS,
                        0.55F,
                        1.45F
                );
            }

            if (ride.progress >= 1.0D) {
                finish(player, ride);
                iterator.remove();
            }
        }
    }

    private static boolean canContinue(ServerPlayerEntity player, Ride ride) {
        return player != null
                && player.isAlive()
                && !ride.carriage.isRemoved()
                && player.getVehicle() == ride.carriage
                && player.getEntityWorld() == ride.world;
    }

    private static void finish(ServerPlayerEntity player, Ride ride) {
        player.stopRiding();
        ride.carriage.discard();
        Vec3d end = ride.route.end();
        player.requestTeleport(end.x, end.y, end.z);
        player.setVelocity(Vec3d.ZERO);
        player.fallDistance = 0.0F;
        pulseWholeRail(ride.world, ride.route);
        ride.world.playSound(
                null,
                end.x,
                end.y,
                end.z,
                ModSounds.RESONANCE_CAST,
                SoundCategory.PLAYERS,
                0.9F,
                1.85F
        );
        player.sendMessage(Text.translatable("message.aetherklang.klangbahn.arrival"), true);
    }

    private static void abort(ServerPlayerEntity player, Ride ride) {
        if (player != null && player.getVehicle() == ride.carriage) {
            player.stopRiding();
        }
        ride.carriage.discard();
    }

    private static void clear() {
        for (Ride ride : ACTIVE_RIDES.values()) {
            ride.carriage.discard();
        }
        ACTIVE_RIDES.clear();
    }

    private static BlockPos findAttunedPillar(ServerWorld world, BlockPos origin) {
        for (BlockPos candidate : BlockPos.iterateOutwards(
                origin,
                MAX_ROUTE_RANGE,
                MAX_VERTICAL_RANGE,
                MAX_ROUTE_RANGE
        )) {
            if (!world.isChunkLoaded(candidate)) {
                continue;
            }
            BlockState state = world.getBlockState(candidate);
            if (state.isOf(ModBlocks.STIMMPFEILER) && state.get(StimmpfeilerBlock.ATTUNED)) {
                return normalizePillarTop(world, candidate);
            }
        }
        return null;
    }

    private static BlockPos findAnchor(ServerWorld world, BlockPos origin) {
        for (BlockPos candidate : BlockPos.iterateOutwards(
                origin,
                MAX_ROUTE_RANGE,
                MAX_VERTICAL_RANGE,
                MAX_ROUTE_RANGE
        )) {
            if (world.isChunkLoaded(candidate) && world.getBlockState(candidate).isOf(Klangbahn.BAHNANKER)) {
                return candidate.toImmutable();
            }
        }
        return null;
    }

    private static BlockPos normalizePillarTop(ServerWorld world, BlockPos pillar) {
        if (world.getBlockState(pillar.up()).isOf(ModBlocks.STIMMPFEILER)) {
            return pillar.up();
        }
        return pillar.toImmutable();
    }

    private static void spawnMovingRails(ServerWorld world, KlangbahnRoute route, double progress) {
        Vec3d center = route.sample(progress);
        Vec3d ahead = route.sample(Math.min(1.0D, progress + 0.02D));
        Vec3d direction = ahead.subtract(center);
        Vec3d lateral = new Vec3d(-direction.z, 0.0D, direction.x);
        if (lateral.lengthSquared() > 0.0001D) {
            lateral = lateral.normalize().multiply(0.38D);
        }

        for (double side : new double[]{-1.0D, 1.0D}) {
            Vec3d rail = center.add(lateral.multiply(side));
            world.spawnParticles(
                    ModParticles.BEAM_MOTE,
                    rail.x,
                    rail.y - 0.2D,
                    rail.z,
                    2,
                    0.04D,
                    0.04D,
                    0.04D,
                    0.005D
            );
        }
    }

    private static void pulseWholeRail(ServerWorld world, KlangbahnRoute route) {
        int samples = Math.max(8, (int) Math.ceil(route.length() / 2.2D));
        for (int sample = 0; sample <= samples; sample++) {
            Vec3d point = route.sample(sample / (double) samples);
            world.spawnParticles(
                    sample % 4 == 0 ? ModParticles.LEITMOTIV_NOTE : ModParticles.BEAM_MOTE,
                    point.x,
                    point.y - 0.2D,
                    point.z,
                    1,
                    0.03D,
                    0.03D,
                    0.03D,
                    0.005D
            );
        }
    }

    private static final class Ride {
        private final ServerWorld world;
        private final ArmorStandEntity carriage;
        private final KlangbahnRoute route;
        private double progress;

        private Ride(ServerWorld world, ArmorStandEntity carriage, KlangbahnRoute route) {
            this.world = world;
            this.carriage = carriage;
            this.route = route;
        }
    }
}
