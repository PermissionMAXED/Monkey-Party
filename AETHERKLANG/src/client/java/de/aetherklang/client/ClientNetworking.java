package de.aetherklang.client;

import de.aetherklang.Aetherklang;
import de.aetherklang.client.fx.ClientFxController;
import de.aetherklang.registry.ModPayloads;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.resonance.client.ClientResonanceCache;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;

public final class ClientNetworking {
    private ClientNetworking() {
    }

    public static void register() {
        ClientPlayNetworking.registerGlobalReceiver(
                ModPayloads.ResonanceSyncPayload.ID,
                (payload, context) -> context.client().execute(() -> {
                    ClientResonanceCache.update(payload);
                    Aetherklang.LOGGER.debug(
                            "Resonance synchronized: mood={}, rp={}",
                            payload.mood(),
                            payload.rp()
                    );
                })
        );
        ClientPlayNetworking.registerGlobalReceiver(
                ModPayloads.RangSyncPayload.ID,
                (payload, context) -> context.client().execute(() -> {
                    ClientResonanceCache.updateRang(payload);
                    Aetherklang.LOGGER.debug(
                            "Resonance grade synchronized: rang={}, gesamt_rp={}",
                            payload.rang(),
                            payload.gesamtRp()
                    );
                })
        );
        ClientPlayNetworking.registerGlobalReceiver(
                ModPayloads.BeatFxPayload.ID,
                (payload, context) -> context.client().execute(() -> {
                    ClientResonanceCache.onBeat(payload);
                    ClientFxController.onBeat(payload.beat());
                    if (context.client().player != null) {
                        context.client().player.playSound(ModSounds.BEAT_TICK, 0.35F, 1.0F);
                    }
                })
        );
    }
}
