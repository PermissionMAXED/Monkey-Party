package de.aetherklang.insel.client;

import de.aetherklang.Aetherklang;
import de.aetherklang.registry.ModPayloads;
import de.aetherklang.registry.ModSounds;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;

/**
 * Client endpoint for the frozen region_sync payload.
 */
public final class InselClientInitializer implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        RegionHud.register();
        ClientPlayNetworking.registerGlobalReceiver(
                ModPayloads.RegionSyncPayload.ID,
                (payload, context) -> context.client().execute(() -> {
                    ClientRegionState.accept(payload);
                    if (context.client().player != null) {
                        context.client().player.playSound(ModSounds.REGION_ENTER, 0.8F, 1.0F);
                    }
                    Aetherklang.LOGGER.debug(
                            "Klangmeer region synchronized: {} at {}/{}/{}",
                            payload.region(),
                            payload.anchorX(),
                            payload.anchorY(),
                            payload.anchorZ()
                    );
                })
        );
    }
}
