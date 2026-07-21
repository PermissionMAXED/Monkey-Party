package de.aetherklang.client.render.holo;

import de.aetherklang.block.KristallresonatorBlock;
import de.aetherklang.block.KristallresonatorBlockEntity;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.render.LightmapTextureManager;
import net.minecraft.client.render.block.entity.BlockEntityRenderer;
import net.minecraft.client.render.block.entity.BlockEntityRendererFactory;
import net.minecraft.client.render.block.entity.state.BlockEntityRenderState;
import net.minecraft.client.render.command.ModelCommandRenderer;
import net.minecraft.client.render.command.OrderedRenderCommandQueue;
import net.minecraft.client.render.state.CameraRenderState;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.text.Text;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.Vec3d;

/**
 * A full-bright, camera-facing status display above the crystal resonator.
 */
public final class KristallresonatorBlockEntityRenderer implements BlockEntityRenderer<
        KristallresonatorBlockEntity,
        KristallresonatorBlockEntityRenderer.State> {
    private static final float TEXT_SCALE = 0.0125F;
    private static final int TITLE_COLOR = 0xFFF5C95F;
    private static final int ACTIVE_COLOR = 0xFF5FF5E0;
    private static final int INACTIVE_COLOR = 0xFFE03A8C;
    private static final int MODE_COLOR = 0xFFA78BFA;
    private static final int BACKGROUND_COLOR = 0x68081020;
    private static final int OUTLINE_COLOR = 0xD0180828;

    private final TextRenderer textRenderer;

    public KristallresonatorBlockEntityRenderer(BlockEntityRendererFactory.Context context) {
        textRenderer = context.textRenderer();
    }

    @Override
    public State createRenderState() {
        return new State();
    }

    @Override
    public void updateRenderState(
            KristallresonatorBlockEntity resonator,
            State state,
            float tickDelta,
            Vec3d cameraPos,
            ModelCommandRenderer.CrumblingOverlayCommand crumblingOverlay
    ) {
        BlockEntityRenderer.super.updateRenderState(resonator, state, tickDelta, cameraPos, crumblingOverlay);
        state.age = resonator.getWorld() == null ? 0.0F : resonator.getWorld().getTime() + tickDelta;
        state.mode = resonator.getHologramMode();
        state.nearbyCrystals = resonator.getNearbyCrystals();
        state.projectedReward = resonator.getProjectedReward();
        state.rechargeTicks = resonator.getRechargeTicks();
        state.charged = resonator.getCachedState().get(KristallresonatorBlock.CHARGED);
    }

    @Override
    public void render(
            State state,
            MatrixStack matrices,
            OrderedRenderCommandQueue queue,
            CameraRenderState cameraState
    ) {
        Text title = Text.translatable("hologram.aetherklang.kristallresonator.title");
        Text mode = Text.translatable(state.mode.getTranslationKey());
        Text detail = detailText(state);
        int detailColor = state.charged ? ACTIVE_COLOR : INACTIVE_COLOR;

        matrices.push();
        matrices.translate(
                0.5D,
                1.48D + MathHelper.sin(state.age * 0.08F) * 0.035D,
                0.5D
        );
        matrices.multiply(cameraState.orientation);
        matrices.scale(TEXT_SCALE, -TEXT_SCALE, TEXT_SCALE);

        submitCentered(queue, matrices, title, -18.0F, TITLE_COLOR);
        submitCentered(queue, matrices, detail, -5.0F, detailColor);
        submitCentered(queue, matrices, mode, 8.0F, MODE_COLOR);
        matrices.pop();
    }

    @Override
    public boolean rendersOutsideBoundingBox() {
        return true;
    }

    @Override
    public int getRenderDistance() {
        return 48;
    }

    private Text detailText(State state) {
        return switch (state.mode) {
            case STATUS -> state.charged
                    ? Text.translatable("hologram.aetherklang.kristallresonator.status.ready")
                    : Text.translatable(
                            "hologram.aetherklang.kristallresonator.status.recharging",
                            Math.max(1, (state.rechargeTicks + 19) / 20)
                    );
            case CRYSTALS -> Text.translatable(
                    "hologram.aetherklang.kristallresonator.crystals",
                    state.nearbyCrystals
            );
            case YIELD -> Text.translatable(
                    "hologram.aetherklang.kristallresonator.yield",
                    state.projectedReward
            );
        };
    }

    private void submitCentered(
            OrderedRenderCommandQueue queue,
            MatrixStack matrices,
            Text text,
            float y,
            int color
    ) {
        queue.submitText(
                matrices,
                -textRenderer.getWidth(text) / 2.0F,
                y,
                text.asOrderedText(),
                false,
                TextRenderer.TextLayerType.SEE_THROUGH,
                LightmapTextureManager.MAX_LIGHT_COORDINATE,
                color,
                BACKGROUND_COLOR,
                OUTLINE_COLOR
        );
    }

    public static final class State extends BlockEntityRenderState {
        private float age;
        private KristallresonatorBlockEntity.HologramMode mode =
                KristallresonatorBlockEntity.HologramMode.STATUS;
        private int nearbyCrystals;
        private int projectedReward;
        private int rechargeTicks;
        private boolean charged;
    }
}
