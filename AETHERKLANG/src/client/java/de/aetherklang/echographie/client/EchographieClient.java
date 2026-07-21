package de.aetherklang.echographie.client;

import de.aetherklang.echographie.Echographie;
import net.fabricmc.fabric.api.client.rendering.v1.EntityModelLayerRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.EntityRendererRegistry;

public final class EchographieClient {
    private EchographieClient() {
    }

    public static void register() {
        EntityModelLayerRegistry.registerModelLayer(
                EchoEntityRenderer.MODEL_LAYER,
                EchoEntityRenderer::getTexturedModelData
        );
        EntityRendererRegistry.register(Echographie.ECHO, EchoEntityRenderer::new);
    }
}
