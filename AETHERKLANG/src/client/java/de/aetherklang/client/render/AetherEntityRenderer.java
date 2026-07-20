package de.aetherklang.client.render;

import de.aetherklang.entity.ChoralEntity;
import de.aetherklang.entity.EchonoteEntity;
import de.aetherklang.entity.HallwaechterEntity;
import net.minecraft.client.render.LightmapTextureManager;
import net.minecraft.client.render.OverlayTexture;
import net.minecraft.client.render.RenderLayer;
import net.minecraft.client.render.command.OrderedRenderCommandQueue;
import net.minecraft.client.render.entity.EntityRenderer;
import net.minecraft.client.render.entity.EntityRendererFactory;
import net.minecraft.client.render.state.CameraRenderState;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.entity.Entity;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.RotationAxis;

public final class AetherEntityRenderer<T extends Entity>
        extends EntityRenderer<T, AetherEntityRenderState> {
    private static final Identifier TEXTURE =
            Identifier.ofVanilla("textures/block/white_stained_glass.png");
    private final AetherEntityModel model;
    private final AetherEntityStyle style;
    private final float scale;
    private final int baseColor;

    public AetherEntityRenderer(
            EntityRendererFactory.Context context,
            AetherEntityStyle style,
            float scale,
            float shadowRadius,
            int baseColor
    ) {
        super(context);
        this.model = new AetherEntityModel(context.getPart(ModEntityRenderers.MODEL_LAYER));
        this.style = style;
        this.scale = scale;
        this.shadowRadius = shadowRadius;
        this.baseColor = baseColor;
    }

    @Override
    protected int getBlockLight(T entity, BlockPos pos) {
        return 15;
    }

    @Override
    public AetherEntityRenderState createRenderState() {
        return new AetherEntityRenderState();
    }

    @Override
    public void updateRenderState(T entity, AetherEntityRenderState state, float tickDelta) {
        super.updateRenderState(entity, state, tickDelta);
        state.style = style;
        state.yaw = entity.getYaw(tickDelta);
        state.pitch = entity.getPitch(tickDelta);
        state.shielded = entity instanceof HallwaechterEntity hallwaechter && hallwaechter.isShielded();
        state.healing = entity instanceof EchonoteEntity echonote && echonote.isHealing();
        state.phase = entity instanceof ChoralEntity choral ? choral.getPhase() : 1;
    }

    @Override
    public void render(
            AetherEntityRenderState state,
            MatrixStack matrices,
            OrderedRenderCommandQueue queue,
            CameraRenderState cameraState
    ) {
        matrices.push();
        matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(180.0F - state.yaw));
        if (style == AetherEntityStyle.ECHONOTE) {
            matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(state.pitch));
        }
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
                getColor(state),
                null
        );
        matrices.pop();
        super.render(state, matrices, queue, cameraState);
    }

    private int getColor(AetherEntityRenderState state) {
        if (style == AetherEntityStyle.HALLWAECHTER && state.shielded) {
            return 0xE05FF5E0;
        }
        if (style == AetherEntityStyle.ECHONOTE) {
            return state.healing ? 0xF05FF5E0 : 0xF0F5C95F;
        }
        if (style == AetherEntityStyle.CHORAL) {
            return switch (state.phase) {
                case 1 -> 0xD89263FF;
                case 2 -> 0xD8E03A8C;
                default -> 0xE8F5C95F;
            };
        }
        return baseColor;
    }
}
