package de.aetherklang.client;

import de.aetherklang.Aetherklang;
import de.aetherklang.bosswerk.client.BossFxClient;
import de.aetherklang.client.fx.ClientFxController;
import de.aetherklang.client.fx.FxBudget;
import de.aetherklang.client.kodex.KodexOpener;
import de.aetherklang.client.photo.PhotoModus;
import de.aetherklang.client.photo.Resonanzlinse;
import de.aetherklang.client.render.ModEntityRenderers;
import de.aetherklang.crescendo.CrescendoClientHooks;
import de.aetherklang.kaskade.KaskadeClientFx;
import de.aetherklang.leitmotiv.client.LeitmotivOpener;
import de.aetherklang.partitur.client.PartiturClient;
import net.fabricmc.api.ClientModInitializer;

public final class AetherklangClient implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        FxBudget.register();
        ModKeybinds.register();
        KodexOpener.register();
        LeitmotivOpener.register();
        ResonanceHud.register();
        ModParticleFactories.register();
        ModEntityRenderers.register();
        ClientFxController.register();
        ClientNetworking.register();
        BossFxClient.register();
        KaskadeClientFx.register();
        PartiturClient.register();
        CrescendoClientHooks.register();
        PhotoModus.register();
        Resonanzlinse.register();
        Aetherklang.LOGGER.info("Aetherklang-Client bereit.");
    }
}
