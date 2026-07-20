package de.aetherklang.partitur.client;

import de.aetherklang.partitur.PartiturPayloads;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;

public final class PartiturClient {
    private PartiturClient() {
    }

    public static void register() {
        ClientPlayNetworking.registerGlobalReceiver(
                PartiturPayloads.SyncPayload.ID,
                (payload, context) -> context.client().execute(() -> {
                    ClientPartiturState.update(payload);
                    if (payload.openScreen() || context.client().currentScreen instanceof NotenpultScreen) {
                        context.client().setScreen(new NotenpultScreen());
                    }
                })
        );
    }
}
