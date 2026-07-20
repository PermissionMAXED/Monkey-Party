package de.aetherklang.crescendo;

/**
 * Stable common entry point for all Crescendo work-package hooks.
 */
public final class CrescendoServerHooks {
    private CrescendoServerHooks() {
    }

    public static void register() {
        AuroraHooks.register();
        EnsembleAkkordHooks.register();
        InstrumentHooks.register();
        ArmorHooks.register();
        WorldgenHooks.register();
        CreatureHooks.register();
        MusicHooks.register();
        RangKodexHooks.register();
    }
}
