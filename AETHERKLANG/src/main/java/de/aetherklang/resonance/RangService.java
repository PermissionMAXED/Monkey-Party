package de.aetherklang.resonance;

import de.aetherklang.network.ModNetworking;
import de.aetherklang.registry.ModCriteria;
import net.minecraft.server.network.ServerPlayerEntity;

/**
 * Derives a player's resonance grade from Resonance Points earned over their lifetime.
 */
public final class RangService {
    public static final long NOVIZE_THRESHOLD = 0L;
    public static final long ADEPT_THRESHOLD = 150L;
    public static final long VIRTUOSE_THRESHOLD = 400L;
    public static final long MAESTRO_THRESHOLD = 900L;

    private RangService() {
    }

    public static Rang fromGesamtRp(long gesamtRp) {
        long total = Math.max(0L, gesamtRp);
        if (total >= MAESTRO_THRESHOLD) {
            return Rang.MAESTRO;
        }
        if (total >= VIRTUOSE_THRESHOLD) {
            return Rang.VIRTUOSE;
        }
        if (total >= ADEPT_THRESHOLD) {
            return Rang.ADEPT;
        }
        return Rang.NOVIZE;
    }

    public static Rang fromOrdinal(int ordinal) {
        Rang[] values = Rang.values();
        return values[Math.clamp(ordinal, 0, values.length - 1)];
    }

    public static Rang getRang(ResonancePlayerData data) {
        return fromGesamtRp(data.getGesamtRp());
    }

    /**
     * Records RP that were actually credited to the spendable pool.
     */
    public static void recordRpGain(ServerPlayerEntity player, int gainedRp) {
        if (gainedRp <= 0) {
            return;
        }

        ResonancePlayerData data = ResonanceApi.getData(player);
        long current = data.getGesamtRp();
        long updated = current > Long.MAX_VALUE - gainedRp ? Long.MAX_VALUE : current + gainedRp;
        data.setGesamtRp(updated);
        reconcile(data);
        if (current < ADEPT_THRESHOLD && updated >= ADEPT_THRESHOLD) {
            ModCriteria.REACH_ADEPT.trigger(player);
        }
    }

    public static void reconcileAndSync(ServerPlayerEntity player) {
        ResonancePlayerData data = ResonanceApi.getData(player);
        reconcile(data);
        sync(player);
    }

    public static void sync(ServerPlayerEntity player) {
        ModNetworking.sendRangSync(player, ResonanceApi.getData(player));
    }

    private static void reconcile(ResonancePlayerData data) {
        data.setRang(getRang(data).ordinal());
    }

    public enum Rang {
        NOVIZE("novize", NOVIZE_THRESHOLD),
        ADEPT("adept", ADEPT_THRESHOLD),
        VIRTUOSE("virtuose", VIRTUOSE_THRESHOLD),
        MAESTRO("maestro", MAESTRO_THRESHOLD);

        private final String id;
        private final long threshold;

        Rang(String id, long threshold) {
            this.id = id;
            this.threshold = threshold;
        }

        public String id() {
            return id;
        }

        public long threshold() {
            return threshold;
        }

        public String getTranslationKey() {
            return "rang.aetherklang." + id;
        }
    }
}
