package de.aetherklang.crescendo;

import de.aetherklang.world.KammertonWorld;
import de.aetherklang.world.TonariumExpansionWorld;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerWorldEvents;

/**
 * Installs the authored Crescendo landmarks after Kammerton becomes ready.
 */
public final class WorldgenHooks {
    private static boolean registered;

    private WorldgenHooks() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        ServerWorldEvents.LOAD.register((server, world) -> {
            if (KammertonWorld.isKammerton(world)) {
                TonariumExpansionWorld.ensureGenerated(world);
            }
        });
    }
}
