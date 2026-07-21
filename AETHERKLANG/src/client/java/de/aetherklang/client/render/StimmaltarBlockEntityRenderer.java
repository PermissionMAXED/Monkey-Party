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
 * Turns the Stimmaltar into a hovering, mood-reactive resonance instrument.
 */
public final class StimmaltarBlockEntityRenderer
        implements BlockEntityRenderer<StimmaltarBlockEntity, StimmaltarBlockEntityRenderer.State> {
    public static final EntityModelLayer MODEL_LAYER =
            new EntityModelLayer(Aetherklang.id("stimmaltar_crystal"), "main");
    private static final Identifier TEXTURE =
            Identifier.ofVanilla("textures/block/white_stained_glass.png");
    private static final int[] MOOD_COLORS = {
        0xFFA78BFA,
        0xFFF5C95F,
        0xFFE03A8C,
        0xFF708CCF,
        0xFF5FF5E0
    };
    private static final int[] ORBIT_COLORS = {
        0xD85FF5E0,
        0xD8F5C95F,
        0xC8E03A8C
    };

    private final CrystalModel crystal;
    private final HeartModel heart;
    private final CageModel cage;
    private final OrbitModel[] orbits;
    private final MoodGlyphModel[] glyphs;

    public StimmaltarBlockEntityRenderer(BlockEntityRendererFactory.Context context) {
        ModelPart root = context.getLayerModelPart(MODEL_LAYER);
        crystal = new CrystalModel(root.getChild("crystal"));
        heart = new HeartModel(root.getChild("heart"));
        cage = new CageModel(root.getChild("cage"));

        ModelPart haloRoot = root.getChild("halos");
        orbits = new OrbitModel[3];
        for (int orbit = 0; orbit < orbits.length; orbit++) {
            orbits[orbit] = new OrbitModel(haloRoot.getChild("orbit_" + orbit), orbit);
        }

        ModelPart glyphRoot = root.getChild("glyphs");
        glyphs = new MoodGlyphModel[Stimmung.values().length];
        for (int glyph = 0; glyph < glyphs.length; glyph++) {
            glyphs[glyph] = new MoodGlyphModel(glyphRoot.getChild("glyph_" + glyph), glyph);
        }
    }

    public static TexturedModelData getTexturedModelData() {
        ModelData data = new ModelData();
        ModelPartData root = data.getRoot();
        root.addChild(
                "heart",
                ModelPartBuilder.create()
                        .uv(0, 0).cuboid(-1.45F, -4.8F, -1.45F, 2.9F, 9.6F, 2.9F)
                        .uv(14, 0).cuboid(-2.25F, -2.25F, -0.7F, 4.5F, 4.5F, 1.4F)
                        .uv(14, 6).cuboid(-0.7F, -2.25F, -2.25F, 1.4F, 4.5F, 4.5F),
                ModelTransform.rotation(0.0F, MathHelper.PI / 4.0F, 0.0F)
        );
        ModelPartData crystal = root.addChild(
                "crystal",
                ModelPartBuilder.create()
                        .uv(0, 16).cuboid(-2.8F, -5.4F, -2.8F, 5.6F, 10.8F, 5.6F)
                        .uv(24, 16).cuboid(-1.75F, -7.8F, -1.75F, 3.5F, 2.4F, 3.5F)
                        .uv(24, 22).cuboid(-1.75F, 5.4F, -1.75F, 3.5F, 2.4F, 3.5F),
                ModelTransform.rotation(0.0F, MathHelper.PI / 4.0F, 0.0F)
        );
        crystal.addChild(
                "facets",
                ModelPartBuilder.create()
                        .uv(0, 28).cuboid(-4.4F, -0.48F, -0.48F, 8.8F, 0.96F, 0.96F)
                        .uv(20, 28).cuboid(-0.48F, -0.48F, -4.4F, 0.96F, 0.96F, 8.8F),
                ModelTransform.rotation(0.0F, MathHelper.PI / 4.0F, 0.0F)
        );

        ModelPartData cage = root.addChild("cage", ModelPartBuilder.create(), ModelTransform.NONE);
        float[][] equator = {
            {4.3F, 0.0F, 0.0F},
            {0.0F, 0.0F, 4.3F},
            {-4.3F, 0.0F, 0.0F},
            {0.0F, 0.0F, -4.3F}
        };
        for (int point = 0; point < equator.length; point++) {
            float[] current = equator[point];
            float[] next = equator[(point + 1) % equator.length];
            addStrut(cage, "upper_" + point, 0.0F, -9.4F, 0.0F,
                    current[0], current[1], current[2], 0.42F);
            addStrut(cage, "lower_" + point, current[0], current[1], current[2],
                    0.0F, 9.4F, 0.0F, 0.42F);
            addStrut(cage, "belt_" + point, current[0], current[1], current[2],
                    next[0], next[1], next[2], 0.34F);
        }
        cage.addChild(
                "crown",
                ModelPartBuilder.create()
                        .uv(0, 32).cuboid(-1.25F, -11.2F, -1.25F, 2.5F, 1.2F, 2.5F)
                        .uv(10, 32).cuboid(-0.55F, -13.0F, -0.55F, 1.1F, 2.0F, 1.1F),
                ModelTransform.rotation(0.0F, MathHelper.PI / 4.0F, 0.0F)
        );

        ModelPartData halos = root.addChild("halos", ModelPartBuilder.create(), ModelTransform.NONE);
        addOrbit(halos, "orbit_0", 7.0F, 24,
                ModelTransform.rotation(0.28F, 0.0F, 0.16F));
        addOrbit(halos, "orbit_1", 8.0F, 28,
                ModelTransform.rotation(-0.42F, 0.0F, 0.34F));
        addOrbit(halos, "orbit_2", 9.0F, 32,
                ModelTransform.rotation(0.62F, 0.0F, -0.28F));

        ModelPartData glyphs = root.addChild("glyphs", ModelPartBuilder.create(), ModelTransform.NONE);
        for (int glyph = 0; glyph < Stimmung.values().length; glyph++) {
            float angle = MathHelper.TAU * glyph / Stimmung.values().length;
            float x = MathHelper.cos(angle) * 10.8F;
            float z = MathHelper.sin(angle) * 10.8F;
            glyphs.addChild(
                    "glyph_" + glyph,
                    ModelPartBuilder.create()
                            .uv(0, 36).cuboid(-1.65F, -1.65F, -0.38F, 3.3F, 3.3F, 0.76F)
                            .uv(14, 36).cuboid(0.58F, -6.1F, -0.32F, 0.82F, 4.75F, 0.64F)
                            .uv(18, 36).cuboid(1.15F, -6.1F, -0.32F, 3.25F, 0.82F, 0.64F)
                            .uv(18, 40).cuboid(3.65F, -5.45F, -0.32F, 0.75F, 2.15F, 0.64F)
                            .uv(0, 43).cuboid(-0.42F, 1.75F, -0.28F, 0.84F, 1.9F, 0.56F),
                    ModelTransform.of(x, 0.0F, z, 0.0F, -angle, 0.0F)
            );
        }
        return TexturedModelData.of(data, 64, 64);
    }

    private static void addOrbit(
            ModelPartData parent,
            String name,
            float radius,
            int segments,
            ModelTransform transform
    ) {
        ModelPartData ring = parent.addChild(name, ModelPartBuilder.create(), transform);
        float segmentLength = MathHelper.TAU * radius / segments * 1.05F;
        for (int segment = 0; segment < segments; segment++) {
            float angle = MathHelper.TAU * segment / segments;
            ring.addChild(
                    "arc_" + segment,
                    ModelPartBuilder.create().uv(32, 0)
                            .cuboid(-segmentLength / 2.0F, -0.18F, -0.18F,
                                    segmentLength, 0.36F, 0.36F),
                    ModelTransform.of(
                            MathHelper.cos(angle) * radius,
                            0.0F,
                            MathHelper.sin(angle) * radius,
                            0.0F,
                            -angle - MathHelper.PI / 2.0F,
                            0.0F
                    )
            );
        }
    }

    private static void addStrut(
            ModelPartData parent,
            String name,
            float fromX,
            float fromY,
            float fromZ,
            float toX,
            float toY,
            float toZ,
            float thickness
    ) {
        float dx = toX - fromX;
        float dy = toY - fromY;
        float dz = toZ - fromZ;
        float length = MathHelper.sqrt(dx * dx + dy * dy + dz * dz);
        float horizontal = MathHelper.sqrt(dx * dx + dy * dy);
        float yaw = -(float) MathHelper.atan2(dz, horizontal);
        float roll = (float) MathHelper.atan2(dy, dx);
        parent.addChild(
                name,
                ModelPartBuilder.create().uv(32, 4)
                        .cuboid(-length / 2.0F, -thickness / 2.0F, -thickness / 2.0F,
                                length, thickness, thickness),
                ModelTransform.of(
                        (fromX + toX) / 2.0F,
                        (fromY + toY) / 2.0F,
                        (fromZ + toZ) / 2.0F,
                        0.0F,
                        yaw,
                        roll
                )
        );
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
        float breath = MathHelper.sin(state.age * 0.11F);
        float pulse = 1.0F + breath * 0.035F;
        matrices.push();
        matrices.translate(
                0.5D,
                1.28D + MathHelper.sin(state.age * 0.075F) * 0.09D,
                0.5D
        );
        matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(state.age * 0.72F));
        matrices.scale(-pulse, -pulse, pulse);

        for (int orbit = 0; orbit < orbits.length; orbit++) {
            submit(queue, orbits[orbit], state, matrices, ORBIT_COLORS[orbit]);
        }
        submit(queue, cage, state, matrices, 0xEAF5C95F);
        submit(queue, crystal, state, matrices,
                withAlpha(MOOD_COLORS[Math.clamp(state.mood, 0, MOOD_COLORS.length - 1)], 0xD8));

        matrices.push();
        float heartbeat = 1.04F + Math.max(0.0F, MathHelper.sin(state.age * 0.24F)) * 0.12F;
        matrices.scale(heartbeat, heartbeat, heartbeat);
        submit(queue, heart, state, matrices,
                MOOD_COLORS[Math.clamp(state.mood, 0, MOOD_COLORS.length - 1)]);
        matrices.pop();

        for (int glyph = 0; glyph < glyphs.length; glyph++) {
            int alpha = glyph == state.mood ? 0xFF : 0x82;
            submit(queue, glyphs[glyph], state, matrices, withAlpha(MOOD_COLORS[glyph], alpha));
        }
        matrices.pop();
    }

    @Override
    public boolean rendersOutsideBoundingBox() {
        return true;
    }

    @Override
    public int getRenderDistance() {
        return 64;
    }

    private static void submit(
            OrderedRenderCommandQueue queue,
            Model<State> model,
            State state,
            MatrixStack matrices,
            int color
    ) {
        queue.submitModel(
                model,
                state,
                matrices,
                model.getLayer(TEXTURE),
                LightmapTextureManager.MAX_LIGHT_COORDINATE,
                OverlayTexture.DEFAULT_UV,
                color,
                null
        );
    }

    private static int withAlpha(int color, int alpha) {
        return alpha << 24 | color & 0x00FFFFFF;
    }

    public static final class State extends BlockEntityRenderState {
        private float age;
        private int mood;
    }

    private abstract static class EmissiveModel extends Model<State> {
        private EmissiveModel(ModelPart root) {
            super(root, RenderLayer::getEntityTranslucentEmissive);
        }
    }

    private static final class CrystalModel extends EmissiveModel {
        private CrystalModel(ModelPart root) {
            super(root);
        }

        @Override
        public void setAngles(State state) {
            root.pitch = MathHelper.sin(state.age * 0.035F) * 0.16F;
            root.roll = MathHelper.cos(state.age * 0.045F) * 0.12F;
        }
    }

    private static final class HeartModel extends EmissiveModel {
        private HeartModel(ModelPart root) {
            super(root);
        }

        @Override
        public void setAngles(State state) {
            root.yaw = state.age * -0.045F;
            root.pitch = MathHelper.sin(state.age * 0.055F) * 0.18F;
        }
    }

    private static final class CageModel extends EmissiveModel {
        private CageModel(ModelPart root) {
            super(root);
        }

        @Override
        public void setAngles(State state) {
            root.yaw = state.age * 0.028F;
            root.roll = MathHelper.sin(state.age * 0.03F) * 0.08F;
        }
    }

    private static final class OrbitModel extends EmissiveModel {
        private final int index;
        private final float basePitch;
        private final float baseRoll;

        private OrbitModel(ModelPart root, int index) {
            super(root);
            this.index = index;
            basePitch = root.pitch;
            baseRoll = root.roll;
        }

        @Override
        public void setAngles(State state) {
            float direction = (index & 1) == 0 ? 1.0F : -1.0F;
            root.yaw = state.age * (0.025F + index * 0.009F) * direction;
            root.pitch = basePitch + MathHelper.sin(state.age * 0.022F + index) * 0.08F;
            root.roll = baseRoll + MathHelper.cos(state.age * 0.018F + index) * 0.06F;
        }
    }

    private static final class MoodGlyphModel extends EmissiveModel {
        private final int index;
        private final float baseY;
        private final float baseYaw;

        private MoodGlyphModel(ModelPart root, int index) {
            super(root);
            this.index = index;
            baseY = root.originY;
            baseYaw = root.yaw;
        }

        @Override
        public void setAngles(State state) {
            float emphasis = state.mood == index ? 1.22F : 0.88F;
            root.originY = baseY + MathHelper.sin(state.age * 0.105F + index * 1.31F) * 1.25F;
            root.yaw = baseYaw + MathHelper.sin(state.age * 0.025F + index) * 0.14F;
            root.roll = MathHelper.sin(state.age * 0.07F + index * 0.9F) * 0.16F;
            root.xScale = emphasis;
            root.yScale = emphasis;
            root.zScale = emphasis;
        }
    }
}
