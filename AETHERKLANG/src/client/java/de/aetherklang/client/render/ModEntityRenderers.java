package de.aetherklang.client.render;

import de.aetherklang.Aetherklang;
import de.aetherklang.registry.ModBlockEntities;
import de.aetherklang.registry.ModEntities;
import net.fabricmc.fabric.api.client.rendering.v1.BlockEntityRendererRegistry;
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
        EntityModelLayerRegistry.registerModelLayer(
                FermateFeldRenderer.MODEL_LAYER,
                FermateFeldRenderer::getTexturedModelData
        );
        EntityModelLayerRegistry.registerModelLayer(
                StimmaltarBlockEntityRenderer.MODEL_LAYER,
                StimmaltarBlockEntityRenderer::getTexturedModelData
        );
        BlockEntityRendererRegistry.register(
                ModBlockEntities.STIMMALTAR,
                StimmaltarBlockEntityRenderer::new
        );
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
                        AetherEntityStyle.SIRENE,
                        1.05F,
                        0.5F,
                        0xE05FF5E0
                )
        );
        EntityRendererRegistry.register(
                ModEntities.TAKTLING,
                context -> new AetherEntityRenderer<>(
                        context,
                        AetherEntityStyle.TAKTLING,
                        0.52F,
                        0.25F,
                        0xE8F5C95F
                )
        );
        EntityRendererRegistry.register(
                ModEntities.FERMATE_FELD,
                FermateFeldRenderer::new
        );
        EntityRendererRegistry.register(
                ModEntities.MOTIV_LAEUFER,
                context -> new MotivEntityRenderer(
                        context, AetherEntityStyle.HALLWAECHTER, 0.72F, 0.35F
                )
        );
        EntityRendererRegistry.register(
                ModEntities.MOTIV_SCHWINGE,
                context -> new MotivEntityRenderer(
                        context, AetherEntityStyle.SIRENE, 0.68F, 0.3F
                )
        );
        EntityRendererRegistry.register(
                ModEntities.MOTIV_PULSER,
                context -> new MotivEntityRenderer(
                        context, AetherEntityStyle.ECHONOTE, 0.85F, 0.35F
                )
        );
        EntityRendererRegistry.register(
                ModEntities.BOSS_TREMOLO,
                context -> new AetherEntityRenderer<>(
                        context, AetherEntityStyle.CHORAL, 1.55F, 0.9F, 0xE8E03A8C
                )
        );
        EntityRendererRegistry.register(
                ModEntities.BOSS_GLISSANDA,
                context -> new AetherEntityRenderer<>(
                        context, AetherEntityStyle.SIRENE, 1.8F, 0.9F, 0xE85FF5E0
                )
        );
        EntityRendererRegistry.register(
                ModEntities.BOSS_KAKOPHON,
                context -> new AetherEntityRenderer<>(
                        context, AetherEntityStyle.CHORAL, 1.8F, 1.0F, 0xE8E03A8C
                )
        );
        EntityRendererRegistry.register(
                ModEntities.BOSS_GENERALPAUSE,
                context -> new AetherEntityRenderer<>(
                        context, AetherEntityStyle.HALLWAECHTER, 2.0F, 1.1F, 0xE81A1033
                )
        );
        EntityRendererRegistry.register(
                ModEntities.BOSS_OSTINATO,
                context -> new AetherEntityRenderer<>(
                        context, AetherEntityStyle.CHORAL, 1.7F, 0.95F, 0xE87954D6
                )
        );
        EntityRendererRegistry.register(
                ModEntities.BOSS_RITARDANDO,
                context -> new AetherEntityRenderer<>(
                        context, AetherEntityStyle.HALLWAECHTER, 1.9F, 1.0F, 0xE85FF5E0
                )
        );
    }
}
