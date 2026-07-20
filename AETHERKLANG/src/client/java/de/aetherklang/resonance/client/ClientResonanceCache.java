package de.aetherklang.resonance.client;

import de.aetherklang.registry.ModPayloads;
import de.aetherklang.resonance.ResonancePlayerData;
import de.aetherklang.resonance.Stimmung;

/**
 * Client-side snapshot populated exclusively by authoritative server payloads.
 */
public final class ClientResonanceCache {
    private static volatile Stimmung mood = Stimmung.STILLE;
    private static volatile int rp;
    private static volatile float beatPhase;
    private static volatile float dissonanz;
    private static volatile int lastBeat;

    private ClientResonanceCache() {
    }

    public static void update(ModPayloads.ResonanceSyncPayload payload) {
        mood = Stimmung.fromId(payload.mood());
        rp = Math.clamp(payload.rp(), 0, ResonancePlayerData.MAX_RP);
        beatPhase = clampUnit(payload.beatPhase());
        dissonanz = clampUnit(payload.dissonanz());
    }

    public static void onBeat(ModPayloads.BeatFxPayload payload) {
        lastBeat = payload.beat();
        beatPhase = 0.0F;
    }

    public static Stimmung getMood() {
        return mood;
    }

    public static int getRp() {
        return rp;
    }

    public static float getBeatPhase() {
        return beatPhase;
    }

    public static float getDissonanz() {
        return dissonanz;
    }

    public static int getLastBeat() {
        return lastBeat;
    }

    private static float clampUnit(float value) {
        if (!Float.isFinite(value)) {
            return 0.0F;
        }
        return Math.clamp(value, 0.0F, 1.0F);
    }
}
