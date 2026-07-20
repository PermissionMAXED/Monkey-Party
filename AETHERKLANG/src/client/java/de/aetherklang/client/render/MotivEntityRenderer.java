package de.aetherklang.client.render;

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
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.RotationAxis;

/**
 * Applies both JSON palette colors and JSON scale to a Motiv archetype model.
 */
public final class MotivEntityRenderer extends EntityRenderer<MotivEntity, AetherEntityRenderState> {
    private static final Identifier TEXTURE =
            Identifier.ofVanilla("textures/block/white_stained_glass.png");

    private final AetherEntityModel model;
    private final AetherEntityStyle style;
    private final float archetypeScale;

    public MotivEntityRenderer(
            EntityRendererFactory.Context context,
            AetherEntityStyle style,
            float archetypeScale,
            float shadowRadius
    ) {
        super(context);
        model = new AetherEntityModel(context.getPart(ModEntityRenderers.MODEL_LAYER));
        this.style = style;
        this.archetypeScale = archetypeScale;
        this.shadowRadius = shadowRadius;
    }

    @Override
    protected int getBlockLight(MotivEntity entity, BlockPos pos) {
        return 15;
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
        renderPaletteLayer(state, matrices, queue, 1.07F, argb(0x58, state.secondaryColor));
        renderPaletteLayer(state, matrices, queue, 1.0F, argb(0xE8, state.primaryColor));
        super.render(state, matrices, queue, cameraState);
    }

    private void renderPaletteLayer(
            AetherEntityRenderState state,
            MatrixStack matrices,
            OrderedRenderCommandQueue queue,
            float layerScale,
            int color
    ) {
        matrices.push();
        matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(180.0F - state.yaw));
        if (style == AetherEntityStyle.ECHONOTE) {
            matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(state.pitch));
        }
        float scale = archetypeScale * state.motivScale * layerScale;
        matrices.scale(-scale, -scale, scale);
        matrices.translate(0.0F, -1.5F, 0.0F);
        RenderLayer layer = model.getLayer(TEXTURE);
        queue.submitModel(
                model,
                state,
                matrices,
                layer,
                LightmapTextureManager.MAX_LIGHT_COORDINATE,
                OverlayTexture.DEFAULT_UV,
                color,
                null
        );
        matrices.pop();
    }

    private static int argb(int alpha, int rgb) {
        return alpha << 24 | rgb;
    }
}
