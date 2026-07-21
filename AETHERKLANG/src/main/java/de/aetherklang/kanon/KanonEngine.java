package de.aetherklang.kanon;

import de.aetherklang.Aetherklang;
import de.aetherklang.bosswerk.BosswerkBossEntity;
import de.aetherklang.entity.ChoralEntity;
import de.aetherklang.entity.ResonanceEntityEffects;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.resonance.ResonanceApi;
import de.aetherklang.resonance.Stimmung;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.particle.DustParticleEffect;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.text.Text;
import net.minecraft.util.math.Vec3d;

/**
 * Server-authoritative four-note call-and-response state machine.
 */
public final class KanonEngine {
    public static final int PHRASE_LENGTH = KanonPayloads.PHRASE_LENGTH;
    public static final int TICKS_PER_BEAT = 10;
    public static final int RESPONSE_BEAT_SPACING = 2;

    private static final int RESPONSE_SPACING_TICKS = TICKS_PER_BEAT * RESPONSE_BEAT_SPACING;
    private static final int TIMING_TOLERANCE_TICKS = 2;
    private static final int BOSS_CHALLENGE_COOLDOWN_TICKS = 20 * 30;
    private static final int DUEL_REWARD_RP = 8;
    private static final int SOLO_REWARD_RP = 12;
    private static final int STAGGER_TICKS = 70;
    private static final double BOSS_CHALLENGE_RADIUS = 32.0D;
    private static final double STAGGER_SEARCH_RADIUS = 24.0D;

    private static final Map<UUID, Challenge> CHALLENGES = new HashMap<>();
    private static final Map<UUID, Duel> DUELS = new HashMap<>();
    private static final Map<UUID, Integer> BOSS_COOLDOWNS = new HashMap<>();
    private static final Map<UUID, Long> STAGGERED_UNTIL = new HashMap<>();
    private static boolean registered;

    private KanonEngine() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        KanonPayloads.register();
        ServerTickEvents.END_SERVER_TICK.register(KanonEngine::tick);
        ServerPlayConnectionEvents.DISCONNECT.register(
                (handler, server) -> disconnect(server, handler.getPlayer().getUuid())
        );
        ServerLifecycleEvents.SERVER_STOPPED.register(server -> clear());
    }

    public static boolean startCommandChallenge(ServerPlayerEntity player) {
        return startChallenge(
                player,
                ChallengeKind.COMMAND,
                null,
                createPhrase(player, ChallengeKind.COMMAND),
                null,
                ""
        );
    }

    public static boolean startDuel(ServerPlayerEntity challenger, ServerPlayerEntity opponent) {
        if (challenger == opponent
                || !challenger.isAlive()
                || !opponent.isAlive()
                || challenger.isSpectator()
                || opponent.isSpectator()
                || challenger.getEntityWorld() != opponent.getEntityWorld()
                || challenger.squaredDistanceTo(opponent) > 64.0D
                || isActive(challenger)
                || isActive(opponent)) {
            return false;
        }

        UUID duelId = UUID.randomUUID();
        List<KanonNote> phrase = createPhrase(challenger, ChallengeKind.DUEL);
        long callStartTick = nextBeatTick(challenger.getEntityWorld().getTime());
        Duel duel = new Duel(duelId, challenger.getUuid(), opponent.getUuid());
        DUELS.put(duelId, duel);

        Challenge challengerRound = new Challenge(
                challenger.getUuid(),
                ChallengeKind.DUEL,
                opponent.getUuid(),
                phrase,
                duelId,
                opponent.getDisplayName().getString(),
                callStartTick
        );
        Challenge opponentRound = new Challenge(
                opponent.getUuid(),
                ChallengeKind.DUEL,
                challenger.getUuid(),
                phrase,
                duelId,
                challenger.getDisplayName().getString(),
                callStartTick
        );
        CHALLENGES.put(challenger.getUuid(), challengerRound);
        CHALLENGES.put(opponent.getUuid(), opponentRound);
        sync(challenger, challengerRound);
        sync(opponent, opponentRound);
        challenger.sendMessage(
                Text.translatable("message.aetherklang.kanon.duel.start", opponent.getDisplayName()),
                true
        );
        opponent.sendMessage(
                Text.translatable("message.aetherklang.kanon.duel.start", challenger.getDisplayName()),
                true
        );
        return true;
    }

    public static boolean onOnBeatAction(
            ServerPlayerEntity player,
            Stimmung mood,
            KanonAction action
    ) {
        Challenge challenge = CHALLENGES.get(player.getUuid());
        if (challenge == null || challenge.phase != Phase.RESPONSE) {
            return false;
        }

        long now = player.getEntityWorld().getTime();
        long expectedTick = challenge.expectedResponseTick();
        if (now < expectedTick - TIMING_TOLERANCE_TICKS) {
            return false;
        }
        if (now > expectedTick + TIMING_TOLERANCE_TICKS) {
            fail(player, challenge, FailureReason.TIMEOUT);
            return false;
        }

        KanonNote expected = challenge.phrase.get(challenge.progress);
        if (!expected.matches(mood, action)) {
            player.sendMessage(
                    Text.translatable(
                            "message.aetherklang.kanon.wrong",
                            Text.translatable(expected.mood().getTranslationKey()),
                            Text.translatable(expected.action().getTranslationKey())
                    ),
                    true
            );
            fail(player, challenge, FailureReason.WRONG_NOTE);
            return false;
        }

        challenge.progress++;
        spawnAnswerFx(player, expected);
        if (challenge.progress >= PHRASE_LENGTH) {
            succeed(player, challenge);
        } else {
            sync(player, challenge);
        }
        return true;
    }

    public static boolean isActive(ServerPlayerEntity player) {
        return CHALLENGES.containsKey(player.getUuid());
    }

    public static Text status(ServerPlayerEntity player) {
        Challenge challenge = CHALLENGES.get(player.getUuid());
        if (challenge == null) {
            return Text.translatable("command.aetherklang.kanon.status.idle");
        }
        return Text.translatable(
                "command.aetherklang.kanon.status.active",
                Text.translatable(challenge.phase.translationKey()),
                challenge.progress,
                PHRASE_LENGTH
        );
    }

    public static boolean cancel(ServerPlayerEntity player) {
        Challenge challenge = CHALLENGES.get(player.getUuid());
        if (challenge == null) {
            return false;
        }
        cancelChallenge(player.getEntityWorld().getServer(), challenge, true);
        return true;
    }

    public static boolean isStaggered(Entity entity) {
        Long until = STAGGERED_UNTIL.get(entity.getUuid());
        if (until == null) {
            return false;
        }
        if (entity.getEntityWorld().getTime() >= until) {
            STAGGERED_UNTIL.remove(entity.getUuid());
            return false;
        }
        return true;
    }

    private static void tick(MinecraftServer server) {
        for (Challenge challenge : List.copyOf(CHALLENGES.values())) {
            if (CHALLENGES.get(challenge.playerId) != challenge) {
                continue;
            }
            ServerPlayerEntity player = server.getPlayerManager().getPlayer(challenge.playerId);
            if (player == null) {
                continue;
            }
            if (!player.isAlive() || player.isSpectator()) {
                fail(player, challenge, FailureReason.INTERRUPTED);
                continue;
            }
            if (challenge.kind == ChallengeKind.BOSS && !hasLivingSource(player, challenge)) {
                cancelChallenge(server, challenge, false);
                player.sendMessage(Text.translatable("message.aetherklang.kanon.cancelled"), true);
                continue;
            }
            tickChallenge(player, challenge);
        }

        if (Math.floorMod(server.getTicks(), 20) == 0) {
            challengePlayersNearBosses(server);
        }
    }

    private static void tickChallenge(ServerPlayerEntity player, Challenge challenge) {
        long now = player.getEntityWorld().getTime();
        if (challenge.phase == Phase.CALL) {
            while (challenge.revealed < PHRASE_LENGTH
                    && now >= challenge.callStartTick + (long) challenge.revealed * TICKS_PER_BEAT) {
                telegraph(player, challenge, challenge.revealed);
                challenge.revealed++;
                sync(player, challenge);
            }
            if (now >= challenge.responseStartTick() - TICKS_PER_BEAT) {
                challenge.phase = Phase.RESPONSE;
                player.sendMessage(Text.translatable("message.aetherklang.kanon.respond"), true);
                sync(player, challenge);
            }
            return;
        }

        if (challenge.phase == Phase.RESPONSE
                && now > challenge.expectedResponseTick() + TIMING_TOLERANCE_TICKS) {
            fail(player, challenge, FailureReason.TIMEOUT);
        }
    }

    private static void challengePlayersNearBosses(MinecraftServer server) {
        int now = server.getTicks();
        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            if (!player.isAlive()
                    || player.isSpectator()
                    || isActive(player)
                    || BOSS_COOLDOWNS.getOrDefault(player.getUuid(), 0) > now) {
                continue;
            }
            LivingEntity boss = nearestBoss(player);
            if (boss == null) {
                continue;
            }
            if (startChallenge(
                    player,
                    ChallengeKind.BOSS,
                    boss.getUuid(),
                    createPhrase(player, ChallengeKind.BOSS),
                    null,
                    boss.getDisplayName().getString()
            )) {
                BOSS_COOLDOWNS.put(player.getUuid(), now + BOSS_CHALLENGE_COOLDOWN_TICKS);
            }
        }
    }

    private static boolean startChallenge(
            ServerPlayerEntity player,
            ChallengeKind kind,
            UUID sourceId,
            List<KanonNote> phrase,
            UUID duelId,
            String counterpart
    ) {
        if (!player.isAlive() || player.isSpectator() || isActive(player)) {
            return false;
        }
        Challenge challenge = new Challenge(
                player.getUuid(),
                kind,
                sourceId,
                phrase,
                duelId,
                counterpart,
                nextBeatTick(player.getEntityWorld().getTime())
        );
        CHALLENGES.put(player.getUuid(), challenge);
        sync(player, challenge);
        player.sendMessage(
                Text.translatable(
                        kind == ChallengeKind.BOSS
                                ? "message.aetherklang.kanon.boss.call"
                                : "message.aetherklang.kanon.call"
                ),
                true
        );
        return true;
    }

    private static List<KanonNote> createPhrase(
            ServerPlayerEntity player,
            ChallengeKind kind
    ) {
        List<KanonNote> phrase = new ArrayList<>(PHRASE_LENGTH);
        Stimmung previous = null;
        for (int index = 0; index < PHRASE_LENGTH; index++) {
            Stimmung mood = Stimmung.values()[player.getRandom().nextInt(Stimmung.values().length)];
            if (mood == previous) {
                mood = Stimmung.values()[(mood.ordinal() + 1
                        + player.getRandom().nextInt(Stimmung.values().length - 1))
                        % Stimmung.values().length];
            }
            KanonAction action = switch (kind) {
                case COMMAND -> KanonAction.RESONATE;
                case DUEL -> KanonAction.STIMMGABEL;
                case BOSS -> (index + player.getRandom().nextInt(2)) % 2 == 0
                        ? KanonAction.STRIKE
                        : KanonAction.RESONATE;
            };
            phrase.add(new KanonNote(mood, action));
            previous = mood;
        }
        return List.copyOf(phrase);
    }

    private static void telegraph(
            ServerPlayerEntity player,
            Challenge challenge,
            int noteIndex
    ) {
        ServerWorld world = player.getEntityWorld();
        KanonNote note = challenge.phrase.get(noteIndex);
        Entity source = sourceEntity(player, challenge);
        Vec3d center = source == null
                ? player.getEntityPos().add(0.0D, 1.0D, 0.0D)
                : source.getEntityPos().add(0.0D, source.getHeight() * 0.58D, 0.0D);
        DustParticleEffect color = new DustParticleEffect(moodColor(note.mood()), 1.15F);
        double radius = 1.25D + noteIndex * 0.24D;
        for (int point = 0; point < 28; point++) {
            double angle = Math.PI * 2.0D * point / 28.0D;
            world.spawnParticles(
                    color,
                    center.x + Math.cos(angle) * radius,
                    center.y + Math.sin(angle * 2.0D) * 0.18D,
                    center.z + Math.sin(angle) * radius,
                    1,
                    0.0D,
                    0.0D,
                    0.0D,
                    0.0D
            );
        }
        if (note.action() == KanonAction.STRIKE) {
            for (int step = -7; step <= 7; step++) {
                world.spawnParticles(
                        color,
                        center.x + step * 0.11D,
                        center.y + step * 0.13D,
                        center.z,
                        1,
                        0.0D,
                        0.0D,
                        0.0D,
                        0.0D
                );
            }
        } else {
            world.spawnParticles(
                    ModParticles.NOTE_SPARK,
                    center.x,
                    center.y,
                    center.z,
                    10,
                    0.65D,
                    0.45D,
                    0.65D,
                    0.035D
            );
        }
        world.playSound(
                null,
                center.x,
                center.y,
                center.z,
                ModSounds.RESONANCE_CAST,
                SoundCategory.HOSTILE,
                1.0F,
                moodPitch(note.mood())
        );
    }

    private static void spawnAnswerFx(ServerPlayerEntity player, KanonNote note) {
        ServerWorld world = player.getEntityWorld();
        DustParticleEffect color = new DustParticleEffect(moodColor(note.mood()), 0.9F);
        world.spawnParticles(
                color,
                player.getX(),
                player.getBodyY(0.55D),
                player.getZ(),
                18,
                0.55D,
                0.75D,
                0.55D,
                0.04D
        );
        world.playSound(
                null,
                player.getX(),
                player.getY(),
                player.getZ(),
                ModSounds.BEAT_TICK,
                SoundCategory.PLAYERS,
                0.75F,
                moodPitch(note.mood())
        );
    }

    private static void succeed(ServerPlayerEntity player, Challenge challenge) {
        if (challenge.kind == ChallengeKind.DUEL) {
            resolveDuelWin(player, challenge);
            return;
        }

        challenge.phase = Phase.SUCCESS;
        sync(player, challenge);
        CHALLENGES.remove(player.getUuid());
        ResonanceApi.addRp(player, SOLO_REWARD_RP);
        int staggered = staggerBoss(player, challenge);
        player.sendMessage(
                Text.translatable("message.aetherklang.kanon.success", SOLO_REWARD_RP, staggered),
                true
        );
        Aetherklang.LOGGER.info(
                "Kanon success for {}: source={}, staggered={}",
                player.getName().getString(),
                challenge.counterpart,
                staggered
        );
    }

    private static void fail(
            ServerPlayerEntity player,
            Challenge challenge,
            FailureReason reason
    ) {
        if (challenge.kind == ChallengeKind.DUEL) {
            resolveDuelLoss(player, challenge, reason);
            return;
        }

        challenge.phase = Phase.FAILURE;
        sync(player, challenge);
        CHALLENGES.remove(player.getUuid());
        applyFailure(player, 0.18F);
        player.sendMessage(Text.translatable(reason.translationKey), true);
        Aetherklang.LOGGER.info(
                "Kanon failure for {}: reason={}",
                player.getName().getString(),
                reason
        );
    }

    private static void resolveDuelWin(ServerPlayerEntity winner, Challenge challenge) {
        Duel duel = challenge.duelId == null ? null : DUELS.remove(challenge.duelId);
        if (duel == null || duel.resolved) {
            CHALLENGES.remove(winner.getUuid());
            return;
        }
        duel.resolved = true;
        UUID loserId = duel.other(winner.getUuid());
        ServerPlayerEntity loser = winner.getEntityWorld().getServer().getPlayerManager().getPlayer(loserId);
        Challenge loserChallenge = CHALLENGES.get(loserId);

        challenge.phase = Phase.SUCCESS;
        sync(winner, challenge);
        ResonanceApi.addRp(winner, DUEL_REWARD_RP);
        winner.sendMessage(
                Text.translatable("message.aetherklang.kanon.duel.win", challenge.counterpart, DUEL_REWARD_RP),
                true
        );
        if (loser != null && loserChallenge != null) {
            loserChallenge.phase = Phase.FAILURE;
            sync(loser, loserChallenge);
            applyFailure(loser, 0.12F);
            loser.sendMessage(
                    Text.translatable("message.aetherklang.kanon.duel.lose", winner.getDisplayName()),
                    true
            );
        }
        CHALLENGES.remove(winner.getUuid());
        CHALLENGES.remove(loserId);
    }

    private static void resolveDuelLoss(
            ServerPlayerEntity loser,
            Challenge challenge,
            FailureReason reason
    ) {
        Duel duel = challenge.duelId == null ? null : DUELS.get(challenge.duelId);
        if (duel == null || duel.resolved) {
            CHALLENGES.remove(loser.getUuid());
            return;
        }
        UUID opponentId = duel.other(loser.getUuid());
        Challenge opponentChallenge = CHALLENGES.get(opponentId);
        ServerPlayerEntity opponent = loser.getEntityWorld().getServer().getPlayerManager().getPlayer(opponentId);

        if (reason == FailureReason.TIMEOUT
                && opponentChallenge != null
                && loser.getEntityWorld().getTime()
                        > opponentChallenge.expectedResponseTick() + TIMING_TOLERANCE_TICKS) {
            duel.resolved = true;
            DUELS.remove(duel.id);
            challenge.phase = Phase.FAILURE;
            sync(loser, challenge);
            applyFailure(loser, 0.08F);
            loser.sendMessage(Text.translatable("message.aetherklang.kanon.duel.draw"), true);
            if (opponent != null) {
                opponentChallenge.phase = Phase.FAILURE;
                sync(opponent, opponentChallenge);
                applyFailure(opponent, 0.08F);
                opponent.sendMessage(Text.translatable("message.aetherklang.kanon.duel.draw"), true);
            }
            CHALLENGES.remove(loser.getUuid());
            CHALLENGES.remove(opponentId);
            return;
        }

        if (opponent != null && opponentChallenge != null) {
            resolveDuelWin(opponent, opponentChallenge);
        } else {
            duel.resolved = true;
            DUELS.remove(duel.id);
            challenge.phase = Phase.FAILURE;
            sync(loser, challenge);
            applyFailure(loser, 0.12F);
            CHALLENGES.remove(loser.getUuid());
        }
    }

    private static void applyFailure(ServerPlayerEntity player, float dissonance) {
        ServerWorld world = player.getEntityWorld();
        ResonanceEntityEffects.addDissonanz(player, dissonance);
        player.addStatusEffect(new StatusEffectInstance(StatusEffects.NAUSEA, 60, 0, false, true));
        world.spawnParticles(
                ModParticles.DISSONANZ_SMOKE,
                player.getX(),
                player.getBodyY(0.5D),
                player.getZ(),
                32,
                0.8D,
                1.0D,
                0.8D,
                0.06D
        );
        world.playSound(
                null,
                player.getX(),
                player.getY(),
                player.getZ(),
                ModSounds.DISSONANZ_HIT,
                SoundCategory.PLAYERS,
                0.85F,
                1.2F
        );
    }

    private static int staggerBoss(ServerPlayerEntity player, Challenge challenge) {
        LivingEntity boss = null;
        Entity source = sourceEntity(player, challenge);
        if (source instanceof LivingEntity living && isBoss(living) && living.isAlive()) {
            boss = living;
        }
        if (boss == null) {
            boss = nearestBoss(player, STAGGER_SEARCH_RADIUS);
        }
        if (boss == null) {
            return 0;
        }

        boss.addStatusEffect(new StatusEffectInstance(StatusEffects.SLOWNESS, STAGGER_TICKS, 5, false, true));
        boss.addStatusEffect(new StatusEffectInstance(StatusEffects.WEAKNESS, STAGGER_TICKS, 2, false, true));
        boss.addStatusEffect(new StatusEffectInstance(StatusEffects.GLOWING, STAGGER_TICKS, 0, false, true));
        boss.setVelocity(boss.getVelocity().multiply(0.1D, 0.25D, 0.1D));
        boss.velocityModified = true;
        STAGGERED_UNTIL.put(boss.getUuid(), boss.getEntityWorld().getTime() + STAGGER_TICKS);
        player.getEntityWorld().spawnParticles(
                ModParticles.FERMATE_GLIMMER,
                boss.getX(),
                boss.getBodyY(0.5D),
                boss.getZ(),
                48,
                boss.getWidth(),
                boss.getHeight() * 0.45D,
                boss.getWidth(),
                0.04D
        );
        return 1;
    }

    private static void sync(ServerPlayerEntity player, Challenge challenge) {
        long now = player.getEntityWorld().getTime();
        long nextTick = challenge.phase == Phase.CALL
                ? challenge.callStartTick + (long) challenge.revealed * TICKS_PER_BEAT
                : challenge.phase == Phase.RESPONSE
                        ? challenge.expectedResponseTick()
                        : now + 40;
        KanonNetworking.send(
                player,
                challenge.phrase,
                challenge.phase,
                challenge.progress,
                challenge.revealed,
                (int) Math.max(0L, nextTick - now),
                challenge.kind == ChallengeKind.DUEL,
                challenge.counterpart
        );
    }

    private static LivingEntity nearestBoss(ServerPlayerEntity player) {
        return nearestBoss(player, BOSS_CHALLENGE_RADIUS);
    }

    private static LivingEntity nearestBoss(ServerPlayerEntity player, double radius) {
        return player.getEntityWorld().getEntitiesByClass(
                LivingEntity.class,
                player.getBoundingBox().expand(radius),
                entity -> entity.isAlive()
                        && isBoss(entity)
                        && entity.squaredDistanceTo(player) <= radius * radius
        ).stream().min(Comparator.comparingDouble(entity -> entity.squaredDistanceTo(player))).orElse(null);
    }

    private static boolean isBoss(LivingEntity entity) {
        return entity instanceof BosswerkBossEntity || entity instanceof ChoralEntity;
    }

    private static boolean hasLivingSource(ServerPlayerEntity player, Challenge challenge) {
        Entity source = sourceEntity(player, challenge);
        return source instanceof LivingEntity living
                && living.isAlive()
                && source.getEntityWorld() == player.getEntityWorld()
                && source.squaredDistanceTo(player) <= BOSS_CHALLENGE_RADIUS * BOSS_CHALLENGE_RADIUS * 2.25D;
    }

    private static Entity sourceEntity(ServerPlayerEntity player, Challenge challenge) {
        return challenge.sourceId == null ? null : player.getEntityWorld().getEntity(challenge.sourceId);
    }

    private static void disconnect(MinecraftServer server, UUID playerId) {
        Challenge challenge = CHALLENGES.get(playerId);
        if (challenge != null) {
            cancelChallenge(server, challenge, false);
        }
        BOSS_COOLDOWNS.remove(playerId);
    }

    private static void cancelChallenge(
            MinecraftServer server,
            Challenge challenge,
            boolean notify
    ) {
        CHALLENGES.remove(challenge.playerId);
        ServerPlayerEntity player = server.getPlayerManager().getPlayer(challenge.playerId);
        if (player != null) {
            KanonNetworking.clear(player);
        }
        if (challenge.duelId != null) {
            Duel duel = DUELS.remove(challenge.duelId);
            if (duel != null) {
                UUID otherId = duel.other(challenge.playerId);
                CHALLENGES.remove(otherId);
                ServerPlayerEntity other = server.getPlayerManager().getPlayer(otherId);
                if (other != null) {
                    KanonNetworking.clear(other);
                    other.sendMessage(Text.translatable("message.aetherklang.kanon.cancelled"), true);
                }
            }
        }
        if (notify && player != null) {
            player.sendMessage(Text.translatable("message.aetherklang.kanon.cancelled"), true);
        }
    }

    private static long nextBeatTick(long worldTime) {
        return (Math.floorDiv(worldTime, TICKS_PER_BEAT) + 1L) * TICKS_PER_BEAT;
    }

    private static int moodColor(Stimmung mood) {
        return switch (mood) {
            case STILLE -> 0xC5ABFF;
            case FREUDE -> 0xF5C95F;
            case ZORN -> 0xE03A8C;
            case TRAUER -> 0x70B8FF;
            case WUNDER -> 0x5FF5E0;
        };
    }

    private static float moodPitch(Stimmung mood) {
        return switch (mood) {
            case STILLE -> 0.72F;
            case TRAUER -> 0.88F;
            case FREUDE -> 1.06F;
            case WUNDER -> 1.24F;
            case ZORN -> 1.42F;
        };
    }

    private static void clear() {
        CHALLENGES.clear();
        DUELS.clear();
        BOSS_COOLDOWNS.clear();
        STAGGERED_UNTIL.clear();
    }

    public enum Phase {
        CALL(1, "kanon.phase.aetherklang.call"),
        RESPONSE(2, "kanon.phase.aetherklang.response"),
        SUCCESS(3, "kanon.phase.aetherklang.success"),
        FAILURE(4, "kanon.phase.aetherklang.failure");

        private final int networkId;
        private final String translationKey;

        Phase(int networkId, String translationKey) {
            this.networkId = networkId;
            this.translationKey = translationKey;
        }

        public int networkId() {
            return networkId;
        }

        public String translationKey() {
            return translationKey;
        }
    }

    private enum ChallengeKind {
        COMMAND,
        BOSS,
        DUEL
    }

    private enum FailureReason {
        WRONG_NOTE("message.aetherklang.kanon.failure"),
        TIMEOUT("message.aetherklang.kanon.timeout"),
        INTERRUPTED("message.aetherklang.kanon.interrupted");

        private final String translationKey;

        FailureReason(String translationKey) {
            this.translationKey = translationKey;
        }
    }

    private static final class Challenge {
        private final UUID playerId;
        private final ChallengeKind kind;
        private final UUID sourceId;
        private final List<KanonNote> phrase;
        private final UUID duelId;
        private final String counterpart;
        private final long callStartTick;
        private Phase phase = Phase.CALL;
        private int progress;
        private int revealed;

        private Challenge(
                UUID playerId,
                ChallengeKind kind,
                UUID sourceId,
                List<KanonNote> phrase,
                UUID duelId,
                String counterpart,
                long callStartTick
        ) {
            this.playerId = playerId;
            this.kind = kind;
            this.sourceId = sourceId;
            this.phrase = phrase;
            this.duelId = duelId;
            this.counterpart = counterpart;
            this.callStartTick = callStartTick;
        }

        private long responseStartTick() {
            return callStartTick + (PHRASE_LENGTH + 1L) * TICKS_PER_BEAT;
        }

        private long expectedResponseTick() {
            return responseStartTick() + (long) progress * RESPONSE_SPACING_TICKS;
        }
    }

    private static final class Duel {
        private final UUID id;
        private final UUID first;
        private final UUID second;
        private boolean resolved;

        private Duel(UUID id, UUID first, UUID second) {
            this.id = id;
            this.first = first;
            this.second = second;
        }

        private UUID other(UUID participant) {
            return first.equals(participant) ? second : first;
        }
    }
}
