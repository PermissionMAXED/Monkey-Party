package de.aetherklang.insel;

import de.aetherklang.Aetherklang;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerWorldEvents;

/**
 * Server hooks for procedural islands, authored landmarks, and region sync.
 */
public final class InselServerInitializer implements ModInitializer {
    private static boolean registered;

    @Override
    public void onInitialize() {
        if (registered) {
            return;
        }
        registered = true;

        ServerWorldEvents.LOAD.register((server, world) -> {
            KlangmeerKomponist.ensureGenerated(world);
            KlangmeerLandmarks.ensureGenerated(world);
            KlangmeerEliteIslands.ensureGenerated(world);
        });
        ServerTickEvents.END_WORLD_TICK.register(KlangmeerLandmarks::tick);
        ServerTickEvents.END_WORLD_TICK.register(KlangmeerEliteIslands::tick);
        ServerTickEvents.END_WORLD_TICK.register(OverworldResonanzorte::tick);
        RegionSyncHooks.register();
        Aetherklang.LOGGER.info(
                "Insel-Komponist registered: {} Klangmeer islands across {} archetypes",
                KlangmeerKomponist.INSEL_ANZAHL,
                InselArchetyp.values().length
        );
    }
}
