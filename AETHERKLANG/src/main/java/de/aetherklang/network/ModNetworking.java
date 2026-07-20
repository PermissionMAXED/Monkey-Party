package de.aetherklang.network;

import de.aetherklang.Aetherklang;
import de.aetherklang.registry.ModPayloads;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;

public final class ModNetworking {
    private ModNetworking() {
    }

    public static void register() {
        ServerPlayNetworking.registerGlobalReceiver(ModPayloads.DashPayload.ID, (payload, context) ->
                Aetherklang.LOGGER.debug(
                        "Dash stub received from {} with strength {}",
                        context.player().getName().getString(),
                        payload.strength()
                )
        );
    }
}
