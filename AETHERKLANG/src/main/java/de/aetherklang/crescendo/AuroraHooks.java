package de.aetherklang.crescendo;

import de.aetherklang.Aetherklang;

/**
 * Shared, environment-safe contract for Crescendo's client spectacle.
 */
public final class AuroraHooks {
    public static final String KAMMERTON_PATH = "kammerton";
    public static final int MIN_RIPPLE_STREAK = 2;
    public static final int MAX_ENSEMBLE_SIZE = 16;
    public static final double FERMATE_TINT_RADIUS = 11.0D;
    public static final double ENSEMBLE_LINK_DISTANCE = 32.0D;

    private static boolean registered;

    private AuroraHooks() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        Aetherklang.LOGGER.debug("Registered Crescendo aurora and ensemble FX contract");
    }
}
