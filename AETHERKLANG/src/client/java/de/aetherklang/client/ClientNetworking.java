package de.aetherklang.client;

import de.aetherklang.Aetherklang;
import de.aetherklang.registry.ModPayloads;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;

public final class ClientNetworking {
    private ClientNetworking() {
    }

    public static void register() {
        ClientPlayNetworking.registerGlobalReceiver(
                ModPayloads.ResonanceSyncPayload.ID,
                (payload, context) -> Aetherklang.LOGGER.debug(
                        "Resonance sync stub: mood={}, rp={}",
                        payload.mood(),
                        payload.rp()
                )
        );
        ClientPlayNetworking.registerGlobalReceiver(
                ModPayloads.BeatFxPayload.ID,
                (payload, context) -> Aetherklang.LOGGER.debug("Beat FX stub: {}", payload.beat())
        );
    }
}
