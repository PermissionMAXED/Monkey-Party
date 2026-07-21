package de.aetherklang.klangbahn;

import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.Vec3d;

/**
 * A collision-free light arc between a Klangbahn station and its destination.
 */
public record KlangbahnRoute(Vec3d start, Vec3d end, double length, double archHeight) {
    private static final double MIN_ARCH = 2.5D;
    private static final double MAX_ARCH = 14.0D;

    public KlangbahnRoute {
        if (length <= 0.0D) {
            throw new IllegalArgumentException("A Klangbahn route needs a positive length");
        }
    }

    public static KlangbahnRoute between(BlockPos start, BlockPos end) {
        Vec3d startPoint = Vec3d.ofBottomCenter(start).add(0.0D, 1.0D, 0.0D);
        Vec3d endPoint = Vec3d.ofBottomCenter(end).add(0.0D, 1.0D, 0.0D);
        double directLength = startPoint.distanceTo(endPoint);
        double arch = MathHelper.clamp(directLength * 0.12D, MIN_ARCH, MAX_ARCH);
        double estimatedLength = directLength + arch * 0.72D;
        return new KlangbahnRoute(startPoint, endPoint, estimatedLength, arch);
    }

    public Vec3d sample(double progress) {
        double t = MathHelper.clamp(progress, 0.0D, 1.0D);
        Vec3d linear = start.lerp(end, t);
        double lift = Math.sin(Math.PI * t) * archHeight;
        double sway = Math.sin(Math.PI * 2.0D * t) * Math.min(1.25D, length * 0.012D);

        Vec3d direction = end.subtract(start);
        Vec3d lateral = new Vec3d(-direction.z, 0.0D, direction.x);
        if (lateral.lengthSquared() > 0.0001D) {
            lateral = lateral.normalize().multiply(sway);
        }
        return linear.add(lateral).add(0.0D, lift, 0.0D);
    }

    public float yaw(double progress) {
        Vec3d from = sample(progress);
        Vec3d to = sample(Math.min(1.0D, progress + 0.01D));
        Vec3d direction = to.subtract(from);
        return (float) (MathHelper.atan2(direction.z, direction.x) * 180.0D / Math.PI) - 90.0F;
    }
}
