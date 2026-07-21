package de.aetherklang.echographie.client;

import de.aetherklang.Aetherklang;
import de.aetherklang.echographie.EchoEntity;
import net.minecraft.client.model.Dilation;
import net.minecraft.client.model.Model;
import net.minecraft.client.model.ModelData;
import net.minecraft.client.model.ModelPart;
import net.minecraft.client.model.ModelPartBuilder;
import net.minecraft.client.model.ModelPartData;
import net.minecraft.client.model.ModelTransform;
import net.minecraft.client.model.TexturedModelData;
import net.minecraft.client.render.LightmapTextureManager;
import net.minecraft.client.render.OverlayTexture;
import net.minecraft.client.render.RenderLayer;
import net.minecraft.client.render.command.OrderedRenderCommandQueue;
import net.minecraft.client.render.entity.EntityRenderer;
import net.minecraft.client.render.entity.EntityRendererFactory;
import net.minecraft.client.render.entity.model.EntityModelLayer;
import net.minecraft.client.render.entity.state.EntityRenderState;
import net.minecraft.client.render.state.CameraRenderState;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.RotationAxis;

/**
 * Renders the captured performer as a cyan, emissive, translucent silhouette.
 */
public final class EchoEntityRenderer
        extends EntityRenderer<EchoEntity, EchoEntityRenderer.State> {
    public static final EntityModelLayer MODEL_LAYER =
            new EntityModelLayer(Aetherklang.id("echographie_echo"), "main");
    private static final Identifier TEXTURE =
            Identifier.ofVanilla("textures/entity/player/wide/steve.png");
    private static final int GHOST_COLOR = 0x765FF5E0;
    private static final int INNER_GLOW_COLOR = 0x385FF5E0;
    private final EchoModel model;

    public EchoEntityRenderer(EntityRendererFactory.Context context) {
        super(context);
        model = new EchoModel(context.getPart(MODEL_LAYER));
        shadowRadius = 0.0F;
    }

    public static TexturedModelData getTexturedModelData() {
        ModelData data = new ModelData();
        ModelPartData root = data.getRoot();
        root.addChild(
                "head",
                ModelPartBuilder.create()
                        .uv(0, 0).cuboid(-4.0F, -8.0F, -4.0F, 8.0F, 8.0F, 8.0F)
                        .uv(32, 0).cuboid(
                                -4.0F,
                                -8.0F,
                                -4.0F,
                                8.0F,
                                8.0F,
                                8.0F,
                                new Dilation(0.3F)
                        ),
                ModelTransform.origin(0.0F, 0.0F, 0.0F)
        );
        root.addChild(
                "body",
                ModelPartBuilder.create()
                        .uv(16, 16).cuboid(-4.0F, 0.0F, -2.0F, 8.0F, 12.0F, 4.0F),
                ModelTransform.NONE
        );
        root.addChild(
                "right_arm",
                ModelPartBuilder.create()
                        .uv(40, 16).cuboid(-3.0F, -2.0F, -2.0F, 4.0F, 12.0F, 4.0F),
                ModelTransform.origin(-5.0F, 2.0F, 0.0F)
        );
        root.addChild(
                "left_arm",
                ModelPartBuilder.create()
                        .uv(32, 48).cuboid(-1.0F, -2.0F, -2.0F, 4.0F, 12.0F, 4.0F),
                ModelTransform.origin(5.0F, 2.0F, 0.0F)
        );
        root.addChild(
                "right_leg",
                ModelPartBuilder.create()
                        .uv(0, 16).cuboid(-2.0F, 0.0F, -2.0F, 4.0F, 12.0F, 4.0F),
                ModelTransform.origin(-1.9F, 12.0F, 0.0F)
        );
        root.addChild(
                "left_leg",
                ModelPartBuilder.create()
                        .uv(16, 48).cuboid(-2.0F, 0.0F, -2.0F, 4.0F, 12.0F, 4.0F),
                ModelTransform.origin(1.9F, 12.0F, 0.0F)
        );
        return TexturedModelData.of(data, 64, 64);
    }

    @Override
    protected int getBlockLight(EchoEntity entity, BlockPos pos) {
        return 15;
    }

    @Override
    public State createRenderState() {
        return new State();
    }

    @Override
    public void updateRenderState(EchoEntity entity, State state, float tickDelta) {
        super.updateRenderState(entity, state, tickDelta);
        state.yaw = entity.getYaw(tickDelta);
        state.pitch = entity.getPitch(tickDelta);
        state.actionPulse = entity.getActionPulse();
    }

    @Override
    public void render(
            State state,
            MatrixStack matrices,
            OrderedRenderCommandQueue queue,
            CameraRenderState cameraState
    ) {
        matrices.push();
        matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(180.0F - state.yaw));
        matrices.scale(-1.0F, -1.0F, 1.0F);
        matrices.translate(0.0F, -1.5F, 0.0F);
        queue.submitModel(
                model,
                state,
                matrices,
                RenderLayer.getEntityTranslucentEmissive(TEXTURE),
                LightmapTextureManager.MAX_LIGHT_COORDINATE,
                OverlayTexture.DEFAULT_UV,
                GHOST_COLOR,
                null
        );
        matrices.push();
        float shimmer = 1.015F + Math.max(0.0F, MathHelper.sin(state.age * 0.22F)) * 0.018F;
        matrices.scale(shimmer, shimmer, shimmer);
        queue.submitModel(
                model,
                state,
                matrices,
                RenderLayer.getEntityTranslucentEmissive(TEXTURE),
                LightmapTextureManager.MAX_LIGHT_COORDINATE,
                OverlayTexture.DEFAULT_UV,
                INNER_GLOW_COLOR,
                null
        );
        matrices.pop();
        matrices.pop();
        super.render(state, matrices, queue, cameraState);
    }

    public static final class State extends EntityRenderState {
        private float yaw;
        private float pitch;
        private int actionPulse;
    }

    private static final class EchoModel extends Model<State> {
        private final ModelPart head;
        private final ModelPart rightArm;
        private final ModelPart leftArm;
        private final ModelPart rightLeg;
        private final ModelPart leftLeg;

        private EchoModel(ModelPart root) {
            super(root, RenderLayer::getEntityTranslucentEmissive);
            head = root.getChild("head");
            rightArm = root.getChild("right_arm");
            leftArm = root.getChild("left_arm");
            rightLeg = root.getChild("right_leg");
            leftLeg = root.getChild("left_leg");
        }

        @Override
        public void setAngles(State state) {
            head.pitch = state.pitch * MathHelper.RADIANS_PER_DEGREE;
            float stride = MathHelper.sin(state.age * 0.45F) * 0.48F;
            rightLeg.pitch = stride;
            leftLeg.pitch = -stride;
            rightArm.pitch = -stride * 0.75F;
            leftArm.pitch = stride * 0.75F;
            float action = Math.max(0.0F, MathHelper.sin(state.age * 0.9F + state.actionPulse));
            if ((state.actionPulse & 1) == 0) {
                rightArm.pitch -= action * 0.9F;
            } else {
                leftArm.pitch -= action * 0.9F;
            }
            root.originY = MathHelper.sin(state.age * 0.16F) * 0.16F;
        }
    }
}
