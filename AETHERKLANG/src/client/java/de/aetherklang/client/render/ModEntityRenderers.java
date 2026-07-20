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
                        "dissonanzgeist"
                )
        );
        EntityRendererRegistry.register(
                ModEntities.HALLWAECHTER,
                context -> new AetherEntityRenderer<>(
                        context,
                        AetherEntityStyle.HALLWAECHTER,
                        1.15F,
                        0.7F,
                        "hallwaechter"
                )
        );
        EntityRendererRegistry.register(
                ModEntities.ECHONOTE,
                context -> new AetherEntityRenderer<>(
                        context,
                        AetherEntityStyle.ECHONOTE,
                        0.34F,
                        0.1F,
                        "echonote"
                )
        );
        EntityRendererRegistry.register(
                ModEntities.CHORAL,
                context -> new AetherEntityRenderer<>(
                        context,
                        AetherEntityStyle.CHORAL,
                        2.2F,
                        1.3F,
                        "choral"
                )
        );
        EntityRendererRegistry.register(
                ModEntities.SIRENE,
                context -> new AetherEntityRenderer<>(
                        context,
                        AetherEntityStyle.SIRENE,
                        1.05F,
                        0.5F,
                        "sirene"
                )
        );
        EntityRendererRegistry.register(
                ModEntities.TAKTLING,
                context -> new AetherEntityRenderer<>(
                        context,
                        AetherEntityStyle.TAKTLING,
                        0.52F,
                        0.25F,
                        "taktling"
                )
        );
        EntityRendererRegistry.register(
                ModEntities.FERMATE_FELD,
                FermateFeldRenderer::new
        );
        EntityRendererRegistry.register(
                ModEntities.MOTIV_LAEUFER,
                context -> new MotivEntityRenderer(
                        context, AetherEntityStyle.HALLWAECHTER, 0.72F, 0.35F, "motiv_laeufer"
                )
        );
        EntityRendererRegistry.register(
                ModEntities.MOTIV_SCHWINGE,
                context -> new MotivEntityRenderer(
                        context, AetherEntityStyle.SIRENE, 0.68F, 0.3F, "motiv_schwinge"
                )
        );
        EntityRendererRegistry.register(
                ModEntities.MOTIV_PULSER,
                context -> new MotivEntityRenderer(
                        context, AetherEntityStyle.ECHONOTE, 0.85F, 0.35F, "motiv_pulser"
                )
        );
        EntityRendererRegistry.register(
                ModEntities.MOTIV_KOLOSS,
                context -> new MotivEntityRenderer(
                        context, AetherEntityStyle.CHORAL, 1.15F, 0.55F, "motiv_koloss"
                )
        );
        EntityRendererRegistry.register(
                ModEntities.MOTIV_WEBER,
                context -> new MotivEntityRenderer(
                        context, AetherEntityStyle.DISSONANZGEIST, 0.95F, 0.4F, "motiv_weber"
                )
        );
        EntityRendererRegistry.register(
                ModEntities.MOTIV_SCHUETZE,
                context -> new MotivEntityRenderer(
                        context, AetherEntityStyle.HALLWAECHTER, 0.78F, 0.32F, "motiv_schuetze"
                )
        );
        EntityRendererRegistry.register(
                ModEntities.BOSS_TREMOLO,
                context -> new AetherEntityRenderer<>(
                        context, AetherEntityStyle.CHORAL, 1.55F, 0.9F, "boss_tremolo"
                )
        );
        EntityRendererRegistry.register(
                ModEntities.BOSS_GLISSANDA,
                context -> new AetherEntityRenderer<>(
                        context, AetherEntityStyle.SIRENE, 1.8F, 0.9F, "boss_glissanda"
                )
        );
        EntityRendererRegistry.register(
                ModEntities.BOSS_KAKOPHON,
                context -> new AetherEntityRenderer<>(
                        context, AetherEntityStyle.CHORAL, 1.8F, 1.0F, "boss_kakophon"
                )
        );
        EntityRendererRegistry.register(
                ModEntities.BOSS_GENERALPAUSE,
                context -> new AetherEntityRenderer<>(
                        context, AetherEntityStyle.HALLWAECHTER, 2.0F, 1.1F, "boss_generalpause"
                )
        );
        EntityRendererRegistry.register(
                ModEntities.BOSS_OSTINATO,
                context -> new AetherEntityRenderer<>(
                        context, AetherEntityStyle.CHORAL, 1.7F, 0.95F, "boss_ostinato"
                )
        );
        EntityRendererRegistry.register(
                ModEntities.BOSS_RITARDANDO,
                context -> new AetherEntityRenderer<>(
                        context, AetherEntityStyle.HALLWAECHTER, 1.9F, 1.0F, "boss_ritardando"
                )
        );
    }
}
