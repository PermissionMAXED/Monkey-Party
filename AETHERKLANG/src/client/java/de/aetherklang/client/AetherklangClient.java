package de.aetherklang.client;

import de.aetherklang.Aetherklang;
import de.aetherklang.client.fx.ClientFxController;
import de.aetherklang.client.kodex.KodexOpener;
import de.aetherklang.client.render.ModEntityRenderers;
import de.aetherklang.crescendo.CrescendoClientHooks;
import net.fabricmc.api.ClientModInitializer;

public final class AetherklangClient implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        ModKeybinds.register();
        KodexOpener.register();
        ResonanceHud.register();
        ModParticleFactories.register();
        ModEntityRenderers.register();
        ClientFxController.register();
        ClientNetworking.register();
        CrescendoClientHooks.register();
        Aetherklang.LOGGER.info("Aetherklang-Client bereit.");
    }
}
