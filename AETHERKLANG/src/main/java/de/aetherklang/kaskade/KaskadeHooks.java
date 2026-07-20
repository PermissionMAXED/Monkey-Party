package de.aetherklang.kaskade;

import de.aetherklang.resonance.Stimmung;
import java.util.UUID;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.server.network.ServerPlayerEntity;

/**
 * Stable common entry point for Kaskade events and Weltakkord mechanics.
 */
public final class KaskadeHooks {
    private static boolean registered;

    private KaskadeHooks() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        KaskadeEventEngine.register();
        KaskadeCommands.register();
        ServerPlayConnectionEvents.DISCONNECT.register((handler, server) ->
                removePlayer(handler.getPlayer().getUuid())
        );
        ServerLifecycleEvents.SERVER_STOPPED.register(server -> WeltakkordEngine.clear());
    }

    public static void onOnBeatAction(ServerPlayerEntity player, Stimmung mood) {
        WeltakkordEngine.onOnBeatAction(player, mood);
    }

    private static void removePlayer(UUID playerId) {
        WeltakkordEngine.removePlayer(playerId);
    }
}
