package de.aetherklang.crescendo;

import de.aetherklang.resonance.RangService;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;

/**
 * Connects persistent resonance grades to the player lifecycle.
 */
public final class RangKodexHooks {
    private static boolean registered;

    private RangKodexHooks() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        ServerPlayConnectionEvents.JOIN.register(
                (handler, sender, server) -> RangService.reconcileAndSync(handler.getPlayer())
        );
    }
}
