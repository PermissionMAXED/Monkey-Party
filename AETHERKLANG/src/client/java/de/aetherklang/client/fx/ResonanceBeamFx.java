package de.aetherklang.client.fx;

import de.aetherklang.registry.ModParticles;
import de.aetherklang.resonance.Stimmung;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.particle.DustParticleEffect;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.Vec3d;

/**
 * Draws a luminous, three-strand resonance beam with a moving musical helix.
 */
public final class ResonanceBeamFx {
    private static final double STEP = 0.27D;
    private static final int[] BRAND_STRANDS = {
            FxPalette.CYAN,
            FxPalette.GOLD,
            FxPalette.MAGENTA
    };

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

        Vec3d direction = delta.normalize();
        Vec3d side = direction.crossProduct(new Vec3d(0.0D, 1.0D, 0.0D));
        if (side.lengthSquared() < 0.001D) {
            side = direction.crossProduct(new Vec3d(1.0D, 0.0D, 0.0D));
        }
        side = side.normalize();
        Vec3d up = side.crossProduct(direction).normalize();

        int steps = Math.max(2, (int) Math.ceil(length / STEP));
        double phase = animationTick * 0.34D;
        for (int step = 0; step <= steps; step++) {
            double progress = step / (double) steps;
            Vec3d center = from.add(direction.multiply(length * progress));
            double envelope = MathHelper.sin((float) (Math.PI * progress));
            double radius = 0.08D + envelope * 0.2D;

            for (int strand = 0; strand < BRAND_STRANDS.length; strand++) {
                double angle = phase + progress * Math.PI * 7.0D + strand * Math.PI * 2.0D / 3.0D;
                Vec3d offset = side.multiply(Math.cos(angle) * radius)
                        .add(up.multiply(Math.sin(angle) * radius));
                int color = strand == 0
                        ? FxPalette.primary(mood)
                        : strand == 1 ? FxPalette.secondary(mood) : BRAND_STRANDS[strand];
                Vec3d point = center.add(offset);
                world.addParticleClient(
                        new DustParticleEffect(color, strand == 2 ? 0.52F : 0.68F),
                        point.x,
                        point.y,
                        point.z,
                        0.0D,
                        0.0D,
                        0.0D
                );
            }

            if ((step & 1) == 0) {
                double pulse = Math.sin(phase * 1.7D + progress * Math.PI * 12.0D);
                Vec3d mote = center.add(up.multiply(pulse * radius * 1.8D));
                world.addParticleClient(
                        ModParticles.BEAM_MOTE,
                        mote.x,
                        mote.y,
                        mote.z,
                        direction.x * 0.008D,
                        direction.y * 0.008D,
                        direction.z * 0.008D
                );
            }
        }
    }
}
