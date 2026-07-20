package de.aetherklang.client.fx;

import de.aetherklang.client.fx.geo.GeoBeamRenderer;
import de.aetherklang.resonance.Stimmung;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.util.math.Vec3d;

/**
 * Draws a luminous, three-strand resonance beam with a moving musical helix.
 */
public final class ResonanceBeamFx {
    private static final String BEAM_KEY = "resonance-focus";

    private ResonanceBeamFx() {
    }

    public static void draw(
            ClientWorld world,
            Vec3d from,
            Vec3d to,
            Stimmung mood,
            long animationTick
    ) {
        Vec3d delta = to.subtract(from);
        double length = Math.min(delta.length(), 18.0D);
        if (length < 0.2D) {
            return;
        }

        GeoBeamRenderer.beam(
                BEAM_KEY,
                from,
                from.add(delta.normalize().multiply(length)),
                0.20D,
                0.055D,
                3.5D,
                animationTick * 0.34D,
                FxPalette.primary(mood),
                FxPalette.secondary(mood),
                FxPalette.MAGENTA
        );
    }
}
