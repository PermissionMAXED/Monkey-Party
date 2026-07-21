package de.aetherklang.sturmfront;

/**
 * Immutable network view of the roaming Klangmeer weather front.
 */
public record SturmfrontSnapshot(
        boolean active,
        double centerX,
        double centerZ,
        float radius,
        float directionX,
        float directionZ,
        float intensity,
        long revision
) {
    public static SturmfrontSnapshot inactive() {
        return new SturmfrontSnapshot(false, 0.0D, 0.0D, 0.0F, 0.0F, 0.0F, 0.0F, 0L);
    }
}
