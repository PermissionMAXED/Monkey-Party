package de.aetherklang.crescendo;

import de.aetherklang.client.fx.ScreenRippleFx;
import de.aetherklang.client.fx.sky.AuroraSkyFx;
import de.aetherklang.client.fx.sky.EnsembleBeamFx;

/**
 * Stable client entry point for Crescendo work packages.
 */
public final class CrescendoClientHooks {
    private CrescendoClientHooks() {
    }

    public static void register() {
        AuroraSkyFx.register();
        ScreenRippleFx.register();
        EnsembleBeamFx.register();
    }
}
