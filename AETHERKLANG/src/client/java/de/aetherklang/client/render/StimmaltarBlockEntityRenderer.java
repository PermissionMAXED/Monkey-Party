package de.aetherklang.client.render;

import de.aetherklang.Aetherklang;
import de.aetherklang.block.StimmaltarBlockEntity;
import de.aetherklang.resonance.Stimmung;
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
import net.minecraft.client.render.block.entity.BlockEntityRenderer;
import net.minecraft.client.render.block.entity.BlockEntityRendererFactory;
import net.minecraft.client.render.block.entity.state.BlockEntityRenderState;
import net.minecraft.client.render.command.ModelCommandRenderer;
import net.minecraft.client.render.command.OrderedRenderCommandQueue;
import net.minecraft.client.render.entity.model.EntityModelLayer;
import net.minecraft.client.render.state.CameraRenderState;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.RotationAxis;
import net.minecraft.util.math.Vec3d;

/**
 * Gives the Stimmaltar a floating mood crystal circled by five musical sigils.
 */
public final class StimmaltarBlockEntityRenderer
        implements BlockEntityRenderer<StimmaltarBlockEntity, StimmaltarBlockEntityRenderer.State> {
    public static final EntityModelLayer MODEL_LAYER =
            new EntityModelLayer(Aetherklang.id("stimmaltar_crystal"), "main");
    private static final Identifier TEXTURE =
            Identifier.ofVanilla("textures/block/white_stained_glass.png");
    private static final int[] MOOD_COLORS = {
        0xE8A78BFA,
        0xE8F5C95F,
        0xE8E03A8C,
        0xE8708CCF,
        0xE85FF5E0
    };

    private final AltarModel model;

    public StimmaltarBlockEntityRenderer(BlockEntityRendererFactory.Context context) {
        model = new AltarModel(context.getLayerModelPart(MODEL_LAYER));
    }

    public static TexturedModelData getTexturedModelData() {
        ModelData data = new ModelData();
        ModelPartData root = data.getRoot();
        ModelPartData crystal = root.addChild(
                "crystal",
                ModelPartBuilder.create()
                        .uv(0, 0).cuboid(-2.5F, -5.0F, -2.5F, 5.0F, 10.0F, 5.0F)
                        .uv(20, 0).cuboid(-1.5F, -7.0F, -1.5F, 3.0F, 2.0F, 3.0F)
                        .uv(20, 6).cuboid(-1.5F, 5.0F, -1.5F, 3.0F, 2.0F, 3.0F),
                ModelTransform.rotation(0.0F, MathHelper.PI / 4.0F, 0.0F)
        );
        crystal.addChild(
                "cross",
                ModelPartBuilder.create()
                        .uv(0, 16).cuboid(-4.0F, -0.6F, -0.6F, 8.0F, 1.2F, 1.2F)
                        .uv(0, 19).cuboid(-0.6F, -0.6F, -4.0F, 1.2F, 1.2F, 8.0F),
                ModelTransform.rotation(0.0F, MathHelper.PI / 4.0F, 0.0F)
        );

        ModelPartData glyphs = root.addChild("glyphs", ModelPartBuilder.create(), ModelTransform.NONE);
        for (int glyph = 0; glyph < Stimmung.values().length; glyph++) {
            float angle = MathHelper.TAU * glyph / Stimmung.values().length;
            float x = MathHelper.cos(angle) * 7.5F;
            float z = MathHelper.sin(angle) * 7.5F;
            glyphs.addChild(
                    "glyph_" + glyph,
                    ModelPartBuilder.create()
                            .uv(0, 23).cuboid(-1.1F, -1.1F, -0.45F, 2.2F, 2.2F, 0.9F)
                            .uv(7, 23).cuboid(0.45F, -5.0F, -0.35F, 0.9F, 4.0F, 0.7F)
                            .uv(11, 23).cuboid(1.0F, -5.0F, -0.35F, 2.8F, 0.9F, 0.7F),
                    ModelTransform.of(x, 0.0F, z, 0.0F, -angle, 0.0F)
            );
        }
        return TexturedModelData.of(data, 32, 32);
    }

    @Override
    public State createRenderState() {
        return new State();
    }

    @Override
    public void updateRenderState(
            StimmaltarBlockEntity altar,
            State state,
            float tickDelta,
            Vec3d cameraPos,
            ModelCommandRenderer.CrumblingOverlayCommand crumblingOverlay
    ) {
        BlockEntityRenderer.super.updateRenderState(altar, state, tickDelta, cameraPos, crumblingOverlay);
        state.age = altar.getWorld() == null ? 0.0F : altar.getWorld().getTime() + tickDelta;
        state.mood = altar.getSelectedMood().ordinal();
    }

    @Override
    public void render(
            State state,
            MatrixStack matrices,
            OrderedRenderCommandQueue queue,
            CameraRenderState cameraState
    ) {
        float pulse = 1.0F + MathHelper.sin(state.age * 0.14F) * 0.05F;
        matrices.push();
        matrices.translate(
                0.5D,
                1.24D + MathHelper.sin(state.age * 0.09F) * 0.08D,
                0.5D
        );
        matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(state.age * 1.35F));
        matrices.scale(-pulse, -pulse, pulse);
        queue.submitModel(
                model,
                state,
                matrices,
                model.getLayer(TEXTURE),
                LightmapTextureManager.MAX_LIGHT_COORDINATE,
                OverlayTexture.DEFAULT_UV,
                MOOD_COLORS[Math.clamp(state.mood, 0, MOOD_COLORS.length - 1)],
                null
        );
        matrices.pop();
    }

    public static final class State extends BlockEntityRenderState {
        private float age;
        private int mood;
    }

    private static final class AltarModel extends Model<State> {
        private final ModelPart crystal;
        private final ModelPart glyphs;

        private AltarModel(ModelPart root) {
            super(root, RenderLayer::getEntityTranslucent);
            crystal = root.getChild("crystal");
            glyphs = root.getChild("glyphs");
        }

        @Override
        public void setAngles(State state) {
            crystal.pitch = MathHelper.sin(state.age * 0.035F) * 0.16F;
            crystal.roll = MathHelper.cos(state.age * 0.045F) * 0.12F;
            glyphs.yaw = state.age * -0.032F;
            glyphs.roll = MathHelper.sin(state.age * 0.025F) * 0.18F;
            for (int glyph = 0; glyph < Stimmung.values().length; glyph++) {
                ModelPart part = glyphs.getChild("glyph_" + glyph);
                part.originY = MathHelper.sin(state.age * 0.12F + glyph * 1.25F) * 1.4F;
                part.roll = MathHelper.sin(state.age * 0.08F + glyph) * 0.22F;
            }
        }
    }
}
