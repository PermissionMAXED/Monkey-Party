package de.aetherklang.resonance;

/**
 * Result of comparing an action with the nearest beat.
 */
public enum BeatTiming {
    PERFECT,
    GOOD,
    MISS;

    public static final float PERFECT_WINDOW = 0.08F;
    public static final float GOOD_WINDOW = 0.20F;
    private static final float FLOAT_EPSILON = 0.000001F;

    public static BeatTiming fromPhase(float phase) {
        if (isWithinWindow(phase, PERFECT_WINDOW)) {
            return PERFECT;
        }
        if (isWithinWindow(phase, GOOD_WINDOW)) {
            return GOOD;
        }
        return MISS;
    }

    public static boolean isWithinWindow(float phase, float window) {
        float safeWindow = Math.clamp(window, 0.0F, 0.5F);
        return distanceToBeat(phase) <= safeWindow + FLOAT_EPSILON;
    }

    public static float distanceToBeat(float phase) {
        if (!Float.isFinite(phase)) {
            return 0.5F;
        }

        float normalized = phase - (float) Math.floor(phase);
        return Math.min(normalized, 1.0F - normalized);
    }
}
