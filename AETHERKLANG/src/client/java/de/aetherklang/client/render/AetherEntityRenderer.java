package de.aetherklang.client.render;

import de.aetherklang.Aetherklang;
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
import net.minecraft.util.math.RotationAxis;

public final class AetherEntityRenderer<T extends Entity>
        extends EntityRenderer<T, AetherEntityRenderState> {
    private final AetherEntityModel model;
    private final AetherEntityStyle style;
    private final float scale;
    private final Identifier texture;
    private final Identifier emissiveTexture;

    public AetherEntityRenderer(
            EntityRendererFactory.Context context,
            AetherEntityStyle style,
            float scale,
            float shadowRadius,
            String skinName
    ) {
        super(context);
        this.model = new AetherEntityModel(context.getPart(ModEntityRenderers.MODEL_LAYER));
        this.style = style;
        this.scale = scale;
        this.shadowRadius = shadowRadius;
        this.texture = skin(skinName, false);
        this.emissiveTexture = skin(skinName, true);
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

        submitLayer(state, matrices, queue, model.getLayer(texture), state.light, 0xFFFFFFFF);
        submitLayer(
                state,
                matrices,
                queue,
                RenderLayer.getEntityTranslucentEmissive(emissiveTexture),
                LightmapTextureManager.MAX_LIGHT_COORDINATE,
                getEmissiveColor(state)
        );
        matrices.pop();
        super.render(state, matrices, queue, cameraState);
    }

    private void submitLayer(
            AetherEntityRenderState state,
            MatrixStack matrices,
            OrderedRenderCommandQueue queue,
            RenderLayer layer,
            int light,
            int color
    ) {
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
    }

    private int getEmissiveColor(AetherEntityRenderState state) {
        if (style == AetherEntityStyle.HALLWAECHTER && state.shielded) {
            return 0xFF5FF5E0;
        }
        if (style == AetherEntityStyle.ECHONOTE) {
            return state.healing ? 0xFF5FF5E0 : 0xFFF5C95F;
        }
        if (style == AetherEntityStyle.CHORAL) {
            return switch (state.phase) {
                case 1 -> 0xFF9263FF;
                case 2 -> 0xFFE03A8C;
                default -> 0xFFF5C95F;
            };
        }
        return 0xFFFFFFFF;
    }

    private static Identifier skin(String skinName, boolean emissive) {
        String suffix = emissive ? "_emissive" : "";
        return Aetherklang.id("textures/entity/" + skinName + suffix + ".png");
    }
}
