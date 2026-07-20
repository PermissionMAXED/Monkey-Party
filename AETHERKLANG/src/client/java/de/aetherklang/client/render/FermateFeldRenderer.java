package de.aetherklang.client.render;

import de.aetherklang.Aetherklang;
import de.aetherklang.entity.FermateFeldEntity;
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
 * Renders the active Fermata field as a translucent, gently pulsing dome cage.
 */
public final class FermateFeldRenderer
        extends EntityRenderer<FermateFeldEntity, FermateFeldRenderer.State> {
    public static final EntityModelLayer MODEL_LAYER =
            new EntityModelLayer(Aetherklang.id("fermate_feld"), "main");
    private static final Identifier TEXTURE =
            Identifier.ofVanilla("textures/block/white_stained_glass.png");
    private static final int DOME_COLOR = 0x485FF5E0;
    private final DomeModel model;

    public FermateFeldRenderer(EntityRendererFactory.Context context) {
        super(context);
        model = new DomeModel(context.getPart(MODEL_LAYER));
        shadowRadius = 0.0F;
    }

    public static TexturedModelData getTexturedModelData() {
        ModelData data = new ModelData();
        ModelPartData dome = data.getRoot().addChild("dome", ModelPartBuilder.create(), ModelTransform.NONE);
        addRing(dome, "lower", 16.0F, 23.0F, 20);
        addRing(dome, "middle", 14.8F, 19.0F, 18);
        addRing(dome, "upper", 11.5F, 15.0F, 14);
        addRing(dome, "crown", 6.8F, 11.0F, 10);
        dome.addChild(
                "cap",
                ModelPartBuilder.create().uv(0, 0).cuboid(-3.0F, -0.5F, -3.0F, 6.0F, 1.0F, 6.0F),
                ModelTransform.origin(0.0F, 8.5F, 0.0F)
        );
        return TexturedModelData.of(data, 32, 32);
    }

    private static void addRing(
            ModelPartData dome,
            String name,
            float radius,
            float y,
            int segments
    ) {
        ModelPartData ring = dome.addChild(name, ModelPartBuilder.create(), ModelTransform.NONE);
        float segmentLength = (float) (Math.PI * 2.0D * radius / segments * 1.08D);
        for (int segment = 0; segment < segments; segment++) {
            float angle = (float) (Math.PI * 2.0D * segment / segments);
            ring.addChild(
                    "segment_" + segment,
                    ModelPartBuilder.create()
                            .uv(0, 0)
                            .cuboid(-segmentLength / 2.0F, -0.5F, -0.5F, segmentLength, 1.0F, 1.0F),
                    ModelTransform.of(
                            MathHelper.cos(angle) * radius,
                            y,
                            MathHelper.sin(angle) * radius,
                            0.0F,
                            -angle,
                            0.0F
                    )
            );
        }
    }

    @Override
    protected int getBlockLight(FermateFeldEntity entity, BlockPos pos) {
        return 15;
    }

    @Override
    public State createRenderState() {
        return new State();
    }

    @Override
    public void updateRenderState(FermateFeldEntity entity, State state, float tickDelta) {
        super.updateRenderState(entity, state, tickDelta);
        state.active = entity.isActive();
    }

    @Override
    public void render(
            State state,
            MatrixStack matrices,
            OrderedRenderCommandQueue queue,
            CameraRenderState cameraState
    ) {
        matrices.push();
        float pulse = state.active ? 1.0F + MathHelper.sin(state.age * 0.12F) * 0.025F : 0.06F;
        float scale = 6.0F * pulse;
        matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(state.age * (state.active ? 0.25F : 5.0F)));
        matrices.scale(-scale, -scale, scale);
        matrices.translate(0.0F, -1.5F, 0.0F);

        queue.submitModel(
                model,
                state,
                matrices,
                model.getLayer(TEXTURE),
                LightmapTextureManager.MAX_LIGHT_COORDINATE,
                OverlayTexture.DEFAULT_UV,
                DOME_COLOR,
                null
        );
        matrices.pop();
        super.render(state, matrices, queue, cameraState);
    }

    public static final class State extends EntityRenderState {
        private boolean active;
    }

    private static final class DomeModel extends Model<State> {
        private DomeModel(ModelPart root) {
            super(root, RenderLayer::getEntityTranslucent);
        }

        @Override
        public void setAngles(State state) {
        }
    }
}
