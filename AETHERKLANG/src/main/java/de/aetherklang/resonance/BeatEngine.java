package de.aetherklang.resonance;

import de.aetherklang.crescendo.ArmorHooks;
import de.aetherklang.network.ModNetworking;
import de.aetherklang.registry.ModCriteria;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.PlayerLookup;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;

/**
 * Advances the authoritative server beat and evaluates player timing.
 */
public final class BeatEngine {
    public static final float TEMPO_BPM = 120.0F;
    public static final float PERFECT_WINDOW = BeatTiming.PERFECT_WINDOW;
    public static final float GOOD_WINDOW = BeatTiming.GOOD_WINDOW;
    public static final int PERFECT_RP_REWARD = 2;

    private static final float PHASE_PER_TICK = TEMPO_BPM / 60.0F / 20.0F;
    private static final float DISSONANZ_DECAY_PER_TICK = 0.000025F;
    private static final double BEAT_FX_RADIUS = 32.0D;
    private static final Map<UUID, PerfectStreak> PERFECT_STREAKS = new HashMap<>();
    private static boolean registered;

    private BeatEngine() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        ServerTickEvents.END_SERVER_TICK.register(BeatEngine::tick);
    }

    public static boolean isOnBeat(ServerPlayerEntity player, float window) {
        float activeWindow = Float.compare(window, GOOD_WINDOW) == 0
                ? ArmorHooks.getGoodWindow(player, window)
                : window;
        return BeatTiming.isWithinWindow(ResonanceApi.getData(player).getBeatPhase(), activeWindow);
    }

    public static BeatTiming getTiming(ServerPlayerEntity player) {
        float phase = ResonanceApi.getData(player).getBeatPhase();
        if (BeatTiming.isWithinWindow(phase, PERFECT_WINDOW)) {
            return BeatTiming.PERFECT;
        }
        if (BeatTiming.isWithinWindow(phase, ArmorHooks.getGoodWindow(player, GOOD_WINDOW))) {
            return BeatTiming.GOOD;
        }
        return BeatTiming.MISS;
    }

    /**
     * Item and weapon timing hooks can call this after a successful action.
     */
    public static boolean grantPerfectTimingRp(ServerPlayerEntity player) {
        return grantPerfectTimingRp(player, ignored -> {
        });
    }

    /**
     * Rewards a perfect action and supplies its half-strength replay to Klangweber's Nachhall.
     */
    public static boolean grantPerfectTimingRp(ServerPlayerEntity player, Consumer<Float> echoAction) {
        if (getTiming(player) != BeatTiming.PERFECT) {
            PERFECT_STREAKS.remove(player.getUuid());
            return false;
        }

        recordPerfect(player);
        ResonanceApi.addRp(player, PERFECT_RP_REWARD);
        ModNetworking.sendBeatFx(player, currentBeat(player));
        ModCriteria.PERFECT_BEAT.trigger(player);
        ArmorHooks.scheduleNachhall(player, strength -> {
            ResonanceApi.addRp(player, Math.max(1, Math.round(PERFECT_RP_REWARD * strength)));
            echoAction.accept(strength);
        });
        return true;
    }

    private static void tick(MinecraftServer server) {
        Set<ServerPlayerEntity> beatFxRecipients = new HashSet<>();

        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            ResonancePlayerData data = ResonanceApi.getData(player);
            float advancedPhase = data.getBeatPhase() + PHASE_PER_TICK;
            boolean crossedBeat = advancedPhase >= 1.0F;
            data.setBeatPhase(crossedBeat ? advancedPhase % 1.0F : advancedPhase);
            ResonanceApi.tickMoodModifier(player);
            decayDissonanz(player, data);

            if (crossedBeat) {
                beatFxRecipients.addAll(
                        PlayerLookup.around(world(player), player.getEntityPos(), BEAT_FX_RADIUS)
                );
            }
        }

        for (ServerPlayerEntity recipient : beatFxRecipients) {
            ModNetworking.sendBeatFx(recipient, currentBeat(recipient));
            ResonanceApi.sync(recipient);
        }
    }

    private static void decayDissonanz(ServerPlayerEntity player, ResonancePlayerData data) {
        if (data.getDissonanz() <= 0.0F) {
            return;
        }

        float decay = DISSONANZ_DECAY_PER_TICK;
        if (data.getMood() == Stimmung.STILLE) {
            decay *= 3.0F;
        }
        if (hasActivePerfectStreak(player)) {
            decay *= 2.0F;
        }
        data.setDissonanz(data.getDissonanz() - decay);
    }

    private static void recordPerfect(ServerPlayerEntity player) {
        int beat = currentBeat(player);
        PERFECT_STREAKS.compute(player.getUuid(), (uuid, streak) -> {
            if (streak == null) {
                return new PerfectStreak(beat, 1);
            }
            if (beat == streak.lastBeat()) {
                return streak;
            }
            int count = beat == streak.lastBeat() + 1 ? streak.count() + 1 : 1;
            return new PerfectStreak(beat, Math.min(count, 8));
        });
    }

    private static boolean hasActivePerfectStreak(ServerPlayerEntity player) {
        PerfectStreak streak = PERFECT_STREAKS.get(player.getUuid());
        return streak != null
                && streak.count() >= 2
                && currentBeat(player) - streak.lastBeat() <= 1;
    }

    private static int currentBeat(ServerPlayerEntity player) {
        float ticksPerBeat = 20.0F / (TEMPO_BPM / 60.0F);
        return (int) (world(player).getTime() / ticksPerBeat);
    }

    private static ServerWorld world(ServerPlayerEntity player) {
        return (ServerWorld) player.getEntityWorld();
    }

    private record PerfectStreak(int lastBeat, int count) {
    }
}
