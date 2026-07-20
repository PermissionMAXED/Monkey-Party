package de.aetherklang.client.render;

import de.aetherklang.Aetherklang;
import de.aetherklang.registry.ModEntities;
import net.fabricmc.fabric.api.client.rendering.v1.EntityModelLayerRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.EntityRendererRegistry;
import net.minecraft.client.render.entity.model.EntityModelLayer;

public final class ModEntityRenderers {
    public static final EntityModelLayer MODEL_LAYER =
            new EntityModelLayer(Aetherklang.id("aether_entities"), "main");

    private ModEntityRenderers() {
    }

    public static void register() {
        EntityModelLayerRegistry.registerModelLayer(MODEL_LAYER, AetherEntityModel::getTexturedModelData);
        EntityRendererRegistry.register(
                ModEntities.DISSONANZGEIST,
                context -> new AetherEntityRenderer<>(
                        context,
                        AetherEntityStyle.DISSONANZGEIST,
                        0.78F,
                        0.35F,
                        0xDDE03A8C
                )
        );
        EntityRendererRegistry.register(
                ModEntities.HALLWAECHTER,
                context -> new AetherEntityRenderer<>(
                        context,
                        AetherEntityStyle.HALLWAECHTER,
                        1.15F,
                        0.7F,
                        0xE8F5C95F
                )
        );
        EntityRendererRegistry.register(
                ModEntities.ECHONOTE,
                context -> new AetherEntityRenderer<>(
                        context,
                        AetherEntityStyle.ECHONOTE,
                        0.34F,
                        0.1F,
                        0xF0F5C95F
                )
        );
        EntityRendererRegistry.register(
                ModEntities.CHORAL,
                context -> new AetherEntityRenderer<>(
                        context,
                        AetherEntityStyle.CHORAL,
                        2.2F,
                        1.3F,
                        0xD89263FF
                )
        );
        EntityRendererRegistry.register(
                ModEntities.SIRENE,
                context -> new AetherEntityRenderer<>(
                        context,
                        AetherEntityStyle.DISSONANZGEIST,
                        0.72F,
                        0.35F,
                        0xD85FF5E0
                )
        );
        EntityRendererRegistry.register(
                ModEntities.TAKTLING,
                context -> new AetherEntityRenderer<>(
                        context,
                        AetherEntityStyle.ECHONOTE,
                        0.52F,
                        0.25F,
                        0xE8F5C95F
                )
        );
        EntityRendererRegistry.register(
                ModEntities.FERMATE_FELD,
                context -> new AetherEntityRenderer<>(
                        context,
                        AetherEntityStyle.ECHONOTE,
                        1.8F,
                        0.0F,
                        0x605FF5E0
                )
        );
    }
}
