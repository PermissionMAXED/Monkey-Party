package de.aetherklang.komposition.client;

import de.aetherklang.komposition.KompositionPayloads;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;

public final class KompositionClient implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        ClientPlayNetworking.registerGlobalReceiver(
                KompositionPayloads.OpenEditorPayload.ID,
                (payload, context) -> context.client().execute(() ->
                        context.client().setScreen(new KomponistenScreen(payload.hand(), payload.score()))
                )
        );
    }
}
