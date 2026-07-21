package de.aetherklang.resonanzfeld;

import de.aetherklang.resonance.Stimmung;
import net.minecraft.util.math.Vec3d;

/**
 * Read-only view of a currently loaded resonator territory.
 */
public record ResonanzfeldSnapshot(
        long id,
        Vec3d center,
        double radius,
        Stimmung mood,
        int resonators,
        long nextSiegeTick
) {
    private static final double VERTICAL_REACH = 24.0D;

    public boolean contains(Vec3d position) {
        double deltaX = position.x - center.x;
        double deltaZ = position.z - center.z;
        return Math.abs(position.y - center.y) <= VERTICAL_REACH
                && deltaX * deltaX + deltaZ * deltaZ <= radius * radius;
    }
}
