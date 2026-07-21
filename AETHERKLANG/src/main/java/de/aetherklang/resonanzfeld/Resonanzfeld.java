package de.aetherklang.resonanzfeld;

/**
 * Common bootstrap for linked crystal-resonator territories.
 */
public final class Resonanzfeld {
    private static boolean registered;

    private Resonanzfeld() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        ResonanzfeldEngine.register();
        ResonanzfeldCommands.register();
    }
}
