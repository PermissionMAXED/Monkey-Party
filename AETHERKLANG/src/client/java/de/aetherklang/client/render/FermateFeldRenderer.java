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
import net.minecraft.util.math.Box;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.RotationAxis;

/**
 * Renders the active Fermata field as a luminous triangulated geodesic dome.
 */
public final class FermateFeldRenderer
        extends EntityRenderer<FermateFeldEntity, FermateFeldRenderer.State> {
    public static final EntityModelLayer MODEL_LAYER =
            new EntityModelLayer(Aetherklang.id("fermate_feld"), "main");
    private static final Identifier TEXTURE =
            Identifier.ofVanilla("textures/block/white_stained_glass.png");
    private static final float MODEL_RADIUS = 16.0F;
    private static final int LATTICE_COLOR = 0x985FF5E0;
    private static final int ECHO_COLOR = 0x42E03A8C;
    private static final int NODE_COLOR = 0xE8F5C95F;
    private final DomeModel lattice;
    private final DomeModel nodes;
    private final FermataSigilModel sigil;

    public FermateFeldRenderer(EntityRendererFactory.Context context) {
        super(context);
        ModelPart root = context.getPart(MODEL_LAYER);
        lattice = new DomeModel(root.getChild("lattice"));
        nodes = new DomeModel(root.getChild("nodes"));
        sigil = new FermataSigilModel(root.getChild("sigil"));
        shadowRadius = 0.0F;
    }

    public static TexturedModelData getTexturedModelData() {
        ModelData data = new ModelData();
        ModelPartData root = data.getRoot();
        ModelPartData lattice = root.addChild(
                "lattice",
                ModelPartBuilder.create(),
                ModelTransform.NONE
        );
        ModelPartData nodes = root.addChild(
                "nodes",
                ModelPartBuilder.create(),
                ModelTransform.NONE
        );
        DomeVertex apex = new DomeVertex(0.0F, 24.0F - MODEL_RADIUS, 0.0F, 0.0F);
        addNode(nodes, "apex", apex, 1.05F);

        DomeVertex[][] rings = new DomeVertex[4][];
        int strut = 0;
        int node = 0;
        for (int ringIndex = 0; ringIndex < rings.length; ringIndex++) {
            int count = (ringIndex + 1) * 5;
            float polarAngle = MathHelper.PI * (ringIndex + 1) / 8.0F;
            float radius = MathHelper.sin(polarAngle) * MODEL_RADIUS;
            float y = 24.0F - MathHelper.cos(polarAngle) * MODEL_RADIUS;
            float phase = (ringIndex & 1) == 0 ? 0.0F : MathHelper.PI / count;
            DomeVertex[] ring = new DomeVertex[count];
            rings[ringIndex] = ring;
            for (int point = 0; point < count; point++) {
                float angle = MathHelper.TAU * point / count + phase;
                ring[point] = new DomeVertex(
                        MathHelper.cos(angle) * radius,
                        y,
                        MathHelper.sin(angle) * radius,
                        angle
                );
                addNode(nodes, "node_" + node++, ring[point], ringIndex == rings.length - 1 ? 0.78F : 0.9F);
            }
            for (int point = 0; point < count; point++) {
                addStrut(
                        lattice,
                        "ring_" + strut++,
                        ring[point],
                        ring[(point + 1) % count],
                        ringIndex == rings.length - 1 ? 0.48F : 0.38F
                );
            }
        }

        for (DomeVertex vertex : rings[0]) {
            addStrut(lattice, "spoke_" + strut++, apex, vertex, 0.42F);
        }
        for (int ringIndex = 1; ringIndex < rings.length; ringIndex++) {
            DomeVertex[] inner = rings[ringIndex - 1];
            DomeVertex[] outer = rings[ringIndex];
            for (DomeVertex outerVertex : outer) {
                int nearest = nearestIndex(inner, outerVertex.angle());
                int neighbor = neighboringIndex(inner, nearest, outerVertex.angle());
                addStrut(lattice, "diagonal_" + strut++, outerVertex, inner[nearest], 0.36F);
                addStrut(lattice, "diagonal_" + strut++, outerVertex, inner[neighbor], 0.36F);
            }
        }

        ModelPartData sigil = root.addChild(
                "sigil",
                ModelPartBuilder.create()
                        .uv(0, 8).cuboid(-1.05F, 0.6F, -0.65F, 2.1F, 2.1F, 1.3F),
                ModelTransform.origin(0.0F, 8.3F, 0.0F)
        );
        DomeVertex[] arc = new DomeVertex[9];
        for (int point = 0; point < arc.length; point++) {
            float angle = MathHelper.PI + MathHelper.PI * point / (arc.length - 1);
            arc[point] = new DomeVertex(
                    MathHelper.cos(angle) * 4.2F,
                    MathHelper.sin(angle) * 3.1F - 0.5F,
                    0.0F,
                    angle
            );
            if (point > 0) {
                addStrut(sigil, "fermata_arc_" + point, arc[point - 1], arc[point], 0.58F);
            }
        }
        addStrut(
                sigil,
                "fermata_bar",
                new DomeVertex(-4.2F, -0.5F, 0.0F, 0.0F),
                new DomeVertex(4.2F, -0.5F, 0.0F, 0.0F),
                0.42F
        );
        return TexturedModelData.of(data, 32, 32);
    }

    private static int nearestIndex(DomeVertex[] ring, float angle) {
        int nearest = 0;
        float nearestDistance = Float.MAX_VALUE;
        for (int index = 0; index < ring.length; index++) {
            float distance = angularDistance(angle, ring[index].angle());
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearest = index;
            }
        }
        return nearest;
    }

    private static int neighboringIndex(DomeVertex[] ring, int nearest, float angle) {
        int previous = Math.floorMod(nearest - 1, ring.length);
        int next = (nearest + 1) % ring.length;
        return angularDistance(angle, ring[previous].angle())
                < angularDistance(angle, ring[next].angle()) ? previous : next;
    }

    private static float angularDistance(float first, float second) {
        return Math.abs(MathHelper.wrapDegrees((first - second) * MathHelper.DEGREES_PER_RADIAN));
    }

    private static void addNode(
            ModelPartData parent,
            String name,
            DomeVertex vertex,
            float size
    ) {
        parent.addChild(
                name,
                ModelPartBuilder.create().uv(0, 0)
                        .cuboid(-size / 2.0F, -size / 2.0F, -size / 2.0F, size, size, size),
                ModelTransform.of(
                        vertex.x(),
                        vertex.y(),
                        vertex.z(),
                        MathHelper.PI / 4.0F,
                        MathHelper.PI / 4.0F,
                        0.0F
                )
        );
    }

    private static void addStrut(
            ModelPartData parent,
            String name,
            DomeVertex from,
            DomeVertex to,
            float thickness
    ) {
        float dx = to.x() - from.x();
        float dy = to.y() - from.y();
        float dz = to.z() - from.z();
        float length = MathHelper.sqrt(dx * dx + dy * dy + dz * dz);
        float horizontal = MathHelper.sqrt(dx * dx + dy * dy);
        float yaw = -(float) MathHelper.atan2(dz, horizontal);
        float roll = (float) MathHelper.atan2(dy, dx);
        parent.addChild(
                name,
                ModelPartBuilder.create().uv(4, 0)
                        .cuboid(-length / 2.0F, -thickness / 2.0F, -thickness / 2.0F,
                                length, thickness, thickness),
                ModelTransform.of(
                        (from.x() + to.x()) / 2.0F,
                        (from.y() + to.y()) / 2.0F,
                        (from.z() + to.z()) / 2.0F,
                        0.0F,
                        yaw,
                        roll
                )
        );
    }

    @Override
    protected int getBlockLight(FermateFeldEntity entity, BlockPos pos) {
        return 15;
    }

    @Override
    protected Box getBoundingBox(FermateFeldEntity entity) {
        if (!entity.isActive()) {
            return super.getBoundingBox(entity);
        }
        return new Box(
                entity.getX() - 6.5D,
                entity.getY() - 0.5D,
                entity.getZ() - 6.5D,
                entity.getX() + 6.5D,
                entity.getY() + 7.5D,
                entity.getZ() + 6.5D
        );
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
        float pulse = state.active ? 1.0F + MathHelper.sin(state.age * 0.1F) * 0.022F : 1.0F;
        float scale = (state.active ? 6.0F : 0.34F) * pulse;
        matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(state.age * (state.active ? 0.18F : 4.5F)));
        matrices.scale(-scale, -scale, scale);
        matrices.translate(0.0F, -1.5F, 0.0F);

        submit(queue, lattice, state, matrices, state.active ? LATTICE_COLOR : 0xE85FF5E0);
        if (state.active) {
            matrices.push();
            matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(1.8F));
            matrices.scale(1.012F, 1.012F, 1.012F);
            submit(queue, lattice, state, matrices, ECHO_COLOR);
            matrices.pop();
        }
        submit(queue, nodes, state, matrices, state.active ? NODE_COLOR : 0xFFF5C95F);
        submit(queue, sigil, state, matrices, state.active ? 0xFFF5C95F : 0xF05FF5E0);
        matrices.pop();
        super.render(state, matrices, queue, cameraState);
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

    public static final class State extends EntityRenderState {
        private boolean active;
    }

    private static final class DomeModel extends Model<State> {
        private DomeModel(ModelPart root) {
            super(root, RenderLayer::getEntityTranslucentEmissive);
        }

        @Override
        public void setAngles(State state) {
            float shimmer = 1.0F + MathHelper.sin(state.age * 0.13F) * 0.012F;
            root.xScale = shimmer;
            root.yScale = shimmer;
            root.zScale = shimmer;
        }
    }

    private static final class FermataSigilModel extends Model<State> {
        private FermataSigilModel(ModelPart root) {
            super(root, RenderLayer::getEntityTranslucentEmissive);
        }

        @Override
        public void setAngles(State state) {
            root.yaw = state.age * -0.032F;
            root.pitch = MathHelper.sin(state.age * 0.045F) * 0.16F;
            root.roll = MathHelper.cos(state.age * 0.038F) * 0.12F;
            float pulse = 1.0F + Math.max(0.0F, MathHelper.sin(state.age * 0.17F)) * 0.18F;
            root.xScale = pulse;
            root.yScale = pulse;
            root.zScale = pulse;
        }
    }

    private record DomeVertex(float x, float y, float z, float angle) {
    }
}
