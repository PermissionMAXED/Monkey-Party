package de.aetherklang.insel;

import de.aetherklang.Aetherklang;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerWorldEvents;

/**
 * Additive Fabric hook for S3; authored Kammerton composers remain untouched.
 */
public final class InselServerInitializer implements ModInitializer {
    private static boolean registered;

    @Override
    public void onInitialize() {
        if (registered) {
            return;
        }
        registered = true;

        ServerWorldEvents.LOAD.register((server, world) -> KlangmeerKomponist.ensureGenerated(world));
        RegionSyncHooks.register();
        Aetherklang.LOGGER.info(
                "Insel-Komponist registered: {} Klangmeer islands across {} archetypes",
                KlangmeerKomponist.INSEL_ANZAHL,
                InselArchetyp.values().length
        );
    }
}
