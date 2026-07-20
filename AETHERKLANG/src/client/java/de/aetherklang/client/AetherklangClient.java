package de.aetherklang.client;

import de.aetherklang.Aetherklang;
import de.aetherklang.client.render.ModEntityRenderers;
import net.fabricmc.api.ClientModInitializer;

public final class AetherklangClient implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        ModKeybinds.register();
        ResonanceHud.register();
        ModParticleFactories.register();
        ModEntityRenderers.register();
        ClientNetworking.register();
        Aetherklang.LOGGER.info("Aetherklang-Client bereit.");
    }
}
