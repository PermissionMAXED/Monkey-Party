package de.aetherklang.insel.client;

import de.aetherklang.Aetherklang;
import de.aetherklang.insel.KlangmeerRegion;
import de.aetherklang.registry.ModPayloads;
import de.aetherklang.registry.ModSounds;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.text.Text;

/**
 * Client endpoint for the frozen region_sync payload.
 */
public final class InselClientInitializer implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        ClientPlayNetworking.registerGlobalReceiver(
                ModPayloads.RegionSyncPayload.ID,
                (payload, context) -> context.client().execute(() -> {
                    KlangmeerRegion region = KlangmeerRegion.byId(payload.region()).orElse(null);
                    if (context.client().player != null) {
                        String name = region == null ? payload.region() : region.anzeigename();
                        context.client().player.sendMessage(Text.literal("Klangmeer · " + name), true);
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
