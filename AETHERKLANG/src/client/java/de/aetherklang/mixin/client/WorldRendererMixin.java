package de.aetherklang.mixin.client;

import de.aetherklang.client.fx.geo.GeoBeamRenderer;
import net.minecraft.client.render.WorldRenderer;
import net.minecraft.client.render.command.OrderedRenderCommandQueue;
import net.minecraft.client.render.state.WorldRenderState;
import net.minecraft.client.util.math.MatrixStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Bridges geometry beams into Minecraft 1.21.9's render-command extraction.
 */
@Mixin(WorldRenderer.class)
public abstract class WorldRendererMixin {
    @Inject(method = "pushEntityRenders", at = @At("TAIL"))
    private void aetherklang$submitGeometryBeams(
            MatrixStack matrices,
            WorldRenderState state,
            OrderedRenderCommandQueue queue,
            CallbackInfo ci
    ) {
        GeoBeamRenderer.submit(matrices, state.cameraRenderState.pos, queue);
    }
}
