package de.aetherklang.client.render;

import de.aetherklang.Aetherklang;
import de.aetherklang.motiv.MotivEntity;
import de.aetherklang.motiv.MotivVariantDef;
import net.minecraft.client.render.LightmapTextureManager;
import net.minecraft.client.render.OverlayTexture;
import net.minecraft.client.render.RenderLayer;
import net.minecraft.client.render.command.OrderedRenderCommandQueue;
import net.minecraft.client.render.entity.EntityRenderer;
import net.minecraft.client.render.entity.EntityRendererFactory;
import net.minecraft.client.render.state.CameraRenderState;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.RotationAxis;

/**
 * Applies both JSON palette colors and JSON scale to a Motiv archetype model.
 */
public final class MotivEntityRenderer extends EntityRenderer<MotivEntity, AetherEntityRenderState> {
    private final AetherEntityModel model;
    private final AetherEntityStyle style;
    private final float archetypeScale;
    private final Identifier texture;
    private final Identifier emissiveTexture;

    public MotivEntityRenderer(
            EntityRendererFactory.Context context,
            AetherEntityStyle style,
            float archetypeScale,
            float shadowRadius,
            String skinName
    ) {
        super(context);
        model = new AetherEntityModel(context.getPart(ModEntityRenderers.MODEL_LAYER));
        this.style = style;
        this.archetypeScale = archetypeScale;
        this.shadowRadius = shadowRadius;
        this.texture = skin(skinName, false);
        this.emissiveTexture = skin(skinName, true);
    }

    @Override
    public AetherEntityRenderState createRenderState() {
        return new AetherEntityRenderState();
    }

    @Override
    public void updateRenderState(MotivEntity entity, AetherEntityRenderState state, float tickDelta) {
        super.updateRenderState(entity, state, tickDelta);
        MotivVariantDef variant = entity.getVariant();
        state.style = style;
        state.yaw = entity.getYaw(tickDelta);
        state.pitch = entity.getPitch(tickDelta);
        state.motivScale = variant.scale();
        state.primaryColor = variant.primaryRgb();
        state.secondaryColor = variant.secondaryRgb();
    }

    @Override
    public void render(
            AetherEntityRenderState state,
            MatrixStack matrices,
            OrderedRenderCommandQueue queue,
            CameraRenderState cameraState
    ) {
        renderPaletteLayer(
                state,
                matrices,
                queue,
                model.getLayer(texture),
                state.light,
                argb(0xFF, state.primaryColor)
        );
        renderPaletteLayer(
                state,
                matrices,
                queue,
                RenderLayer.getEntityTranslucentEmissive(emissiveTexture),
                LightmapTextureManager.MAX_LIGHT_COORDINATE,
                argb(0xFF, state.secondaryColor)
        );
        super.render(state, matrices, queue, cameraState);
    }

    private void renderPaletteLayer(
            AetherEntityRenderState state,
            MatrixStack matrices,
            OrderedRenderCommandQueue queue,
            RenderLayer layer,
            int light,
            int color
    ) {
        matrices.push();
        matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(180.0F - state.yaw));
        if (style == AetherEntityStyle.ECHONOTE) {
            matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(state.pitch));
        }
        float scale = archetypeScale * state.motivScale;
        matrices.scale(-scale, -scale, scale);
        matrices.translate(0.0F, -1.5F, 0.0F);
        queue.submitModel(
                model,
                state,
                matrices,
                layer,
                light,
                OverlayTexture.DEFAULT_UV,
                color,
                null
        );
        matrices.pop();
    }

    private static int argb(int alpha, int rgb) {
        return alpha << 24 | rgb;
    }

    private static Identifier skin(String skinName, boolean emissive) {
        String suffix = emissive ? "_emissive" : "";
        return Aetherklang.id("textures/entity/" + skinName + suffix + ".png");
    }
}
