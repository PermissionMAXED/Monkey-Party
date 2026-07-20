package de.aetherklang.kaskade;

import de.aetherklang.entity.TaktlingEntity;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.resonance.EnsembleEngine;
import de.aetherklang.resonance.Stimmung;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.entity.mob.HostileEntity;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.text.Text;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;

/**
 * Resolves the five-mood world chord across an ensemble, with solo fallbacks.
 */
public final class WeltakkordEngine {
    private static final WeltakkordPattern FULL_PATTERN = new WeltakkordPattern(
            Stimmung.STILLE.ordinal(),
            Stimmung.FREUDE.ordinal(),
            Stimmung.WUNDER.ordinal(),
            Stimmung.TRAUER.ordinal(),
            Stimmung.ZORN.ordinal()
    );
    private static final WeltakkordPattern REDUCED_PATTERN = new WeltakkordPattern(
            Stimmung.STILLE.ordinal(),
            Stimmung.FREUDE.ordinal(),
            Stimmung.WUNDER.ordinal()
    );
    private static final int PROGRESS_TIMEOUT_TICKS = 20 * 12;
    private static final int COOLDOWN_TICKS = 20 * 25;
    private static final double TAKTLING_RADIUS = 12.0D;

    private static final Map<UUID, ProgressState> PROGRESS = new HashMap<>();
    private static final Map<UUID, Integer> PLAYER_COOLDOWNS = new HashMap<>();

    private WeltakkordEngine() {
    }

    public static void onOnBeatAction(ServerPlayerEntity player, Stimmung mood) {
        int tick = player.getEntityWorld().getServer().getTicks();
        Set<UUID> ensembleIds = EnsembleEngine.getEnsembleMembers(player);
        boolean ensemble = ensembleIds.size() >= 2;
        boolean taktlingPartner = !ensemble && hasTaktlingPartner(player);
        boolean reduced = !ensemble && !taktlingPartner;
        Set<ServerPlayerEntity> participants = resolveParticipants(
                player,
                ensemble ? ensembleIds : Set.of(player.getUuid())
        );
        if (participants.isEmpty() || isCoolingDown(participants, tick)) {
            return;
        }

        if (ensemble) {
            StimmlagenService.assign(player.getEntityWorld().getServer(), ensembleIds);
        }
        UUID groupId = participants.stream()
                .map(ServerPlayerEntity::getUuid)
                .min(UUID::compareTo)
                .orElse(player.getUuid());
        WeltakkordPattern pattern = reduced ? REDUCED_PATTERN : FULL_PATTERN;
        ProgressState state = PROGRESS.get(groupId);
        if (state == null
                || state.reduced != reduced
                || tick - state.lastActionTick > PROGRESS_TIMEOUT_TICKS
                || !state.participants.equals(playerIds(participants))) {
            state = new ProgressState(reduced, playerIds(participants));
            PROGRESS.put(groupId, state);
        }

        state.progress = pattern.advance(state.progress, mood.ordinal());
        state.lastActionTick = tick;
        if (!pattern.complete(state.progress)) {
            showProgress(participants, state.progress, pattern.length(), reduced);
            return;
        }

        PROGRESS.remove(groupId);
        for (ServerPlayerEntity participant : participants) {
            PLAYER_COOLDOWNS.put(participant.getUuid(), tick + COOLDOWN_TICKS);
        }
        fire(player, participants, taktlingPartner, reduced);
    }

    public static void removePlayer(UUID playerId) {
        PLAYER_COOLDOWNS.remove(playerId);
        PROGRESS.entrySet().removeIf(entry -> entry.getValue().participants.contains(playerId));
        StimmlagenService.removePlayer(playerId);
    }

    public static void clear() {
        PROGRESS.clear();
        PLAYER_COOLDOWNS.clear();
        StimmlagenService.clear();
    }

    private static void fire(
            ServerPlayerEntity source,
            Set<ServerPlayerEntity> participants,
            boolean taktlingPartner,
            boolean reduced
    ) {
        ServerWorld world = source.getEntityWorld();
        Vec3d center = center(participants);
        long distinctRoles = participants.stream()
                .map(player -> StimmlagenService.get(player.getUuid()))
                .filter(java.util.Objects::nonNull)
                .distinct()
                .count();
        int voices = participants.size() + (taktlingPartner ? 1 : 0);
        int power = reduced
                ? 1
                : Math.clamp(voices + Math.max(0, (int) distinctRoles - 1), 2, 6);
        double radius = reduced ? 9.0D : 12.0D + power;
        float heal = reduced ? 4.0F : 4.0F + power;
        float damage = reduced ? 6.0F : 7.0F + power * 2.0F;
        Box area = Box.of(center, radius * 2.0D, radius * 2.0D, radius * 2.0D);

        for (ServerPlayerEntity player : world.getEntitiesByClass(
                ServerPlayerEntity.class,
                area,
                candidate -> candidate.isAlive() && !candidate.isSpectator()
        )) {
            player.heal(heal);
            player.addStatusEffect(new StatusEffectInstance(
                    reduced ? StatusEffects.REGENERATION : StatusEffects.ABSORPTION,
                    reduced ? 20 * 6 : 20 * (8 + power),
                    reduced ? 0 : Math.max(0, power / 3 - 1)
            ));
        }
        for (HostileEntity hostile : world.getEntitiesByClass(
                HostileEntity.class,
                area,
                candidate -> candidate.isAlive()
                        && candidate.getEntityPos().squaredDistanceTo(center) <= radius * radius
        )) {
            hostile.damage(world, source.getDamageSources().magic(), damage);
            Vec3d push = hostile.getEntityPos().subtract(center).multiply(1.0D, 0.0D, 1.0D);
            if (push.lengthSquared() > 0.01D) {
                hostile.addVelocity(push.normalize().multiply(0.35D + power * 0.08D).add(0.0D, 0.3D, 0.0D));
                hostile.velocityModified = true;
            }
        }

        spawnFx(world, center, power, reduced);
        world.playSound(
                null,
                center.x,
                center.y,
                center.z,
                ModSounds.AKKORD_COMPLETE,
                SoundCategory.PLAYERS,
                reduced ? 1.1F : 1.8F,
                reduced ? 1.2F : 0.9F + power * 0.08F
        );
        for (ServerPlayerEntity participant : participants) {
            participant.sendMessage(
                    Text.translatable(
                            reduced
                                    ? "message.aetherklang.weltakkord.reduced"
                                    : "message.aetherklang.weltakkord.complete",
                            voices,
                            power
                    ),
                    false
            );
        }
        KaskadeNetworking.broadcastWeltakkord(world, center, participants, power, reduced);
    }

    private static void spawnFx(ServerWorld world, Vec3d center, int power, boolean reduced) {
        int rings = reduced ? 3 : 5;
        for (int ring = 0; ring < rings; ring++) {
            double radius = 1.5D + ring * (reduced ? 1.0D : 1.45D);
            int points = 20 + ring * 8;
            for (int point = 0; point < points; point++) {
                double angle = point * Math.PI * 2.0D / points + ring * 0.37D;
                world.spawnParticles(
                        ring % 2 == 0 ? ModParticles.AKKORD_GLYPH : ModParticles.ENSEMBLE_FUNKE,
                        center.x + Math.cos(angle) * radius,
                        center.y + 0.2D + ring * 0.28D,
                        center.z + Math.sin(angle) * radius,
                        1,
                        0.025D,
                        0.045D,
                        0.025D,
                        0.035D
                );
            }
        }
        world.spawnParticles(
                ParticleTypes.END_ROD,
                center.x,
                center.y + 1.0D,
                center.z,
                reduced ? 32 : 64 + power * 12,
                reduced ? 2.0D : 3.5D,
                reduced ? 1.0D : 2.2D,
                reduced ? 2.0D : 3.5D,
                0.09D
        );
        world.spawnParticles(
                ParticleTypes.HEART,
                center.x,
                center.y + 1.0D,
                center.z,
                reduced ? 12 : 20 + power * 3,
                2.5D,
                1.2D,
                2.5D,
                0.05D
        );
    }

    private static boolean hasTaktlingPartner(ServerPlayerEntity player) {
        return !player.getEntityWorld().getEntitiesByClass(
                TaktlingEntity.class,
                player.getBoundingBox().expand(TAKTLING_RADIUS),
                taktling -> taktling.isAlive() && taktling.isOwner(player)
        ).isEmpty();
    }

    private static Set<ServerPlayerEntity> resolveParticipants(
            ServerPlayerEntity source,
            Set<UUID> playerIds
    ) {
        Set<ServerPlayerEntity> players = new HashSet<>();
        for (UUID playerId : playerIds) {
            ServerPlayerEntity player = source.getEntityWorld().getServer()
                    .getPlayerManager()
                    .getPlayer(playerId);
            if (player != null
                    && player.isAlive()
                    && !player.isSpectator()
                    && player.getEntityWorld() == source.getEntityWorld()) {
                players.add(player);
            }
        }
        return Set.copyOf(players);
    }

    private static Set<UUID> playerIds(Set<ServerPlayerEntity> players) {
        return players.stream()
                .map(ServerPlayerEntity::getUuid)
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    private static boolean isCoolingDown(Set<ServerPlayerEntity> players, int tick) {
        PLAYER_COOLDOWNS.entrySet().removeIf(entry -> entry.getValue() <= tick);
        return players.stream().anyMatch(player -> PLAYER_COOLDOWNS.getOrDefault(
                player.getUuid(),
                Integer.MIN_VALUE
        ) > tick);
    }

    private static Vec3d center(Set<ServerPlayerEntity> players) {
        Vec3d sum = Vec3d.ZERO;
        for (ServerPlayerEntity player : players) {
            sum = sum.add(player.getEntityPos());
        }
        return sum.multiply(1.0D / players.size());
    }

    private static void showProgress(
            Set<ServerPlayerEntity> participants,
            int progress,
            int length,
            boolean reduced
    ) {
        Text message = Text.translatable(
                reduced
                        ? "message.aetherklang.weltakkord.progress.reduced"
                        : "message.aetherklang.weltakkord.progress",
                progress,
                length
        );
        for (ServerPlayerEntity participant : participants) {
            participant.sendMessage(message, true);
        }
    }

    private static final class ProgressState {
        private final boolean reduced;
        private final Set<UUID> participants;
        private int progress;
        private int lastActionTick;

        private ProgressState(boolean reduced, Set<UUID> participants) {
            this.reduced = reduced;
            this.participants = participants;
        }
    }
}
