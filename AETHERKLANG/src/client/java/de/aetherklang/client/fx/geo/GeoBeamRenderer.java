package de.aetherklang.client.fx.geo;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.minecraft.client.render.RenderLayer;
import net.minecraft.client.render.VertexConsumer;
import net.minecraft.client.render.command.OrderedRenderCommandQueue;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.util.math.Vec3d;

/**
 * Collects short-lived beam descriptions and submits their braided geometry
 * through Minecraft's ordered world-render command queue.
 */
public final class GeoBeamRenderer {
    public static final int MAX_BEAMS = 6;

    private static final int BEAM_LIFETIME_TICKS = 3;
    private static final double MAX_BEAM_LENGTH = 32.0D;
    private static final int MIN_SEGMENTS = 4;
    private static final int MAX_SEGMENTS = 64;
    private static final Map<String, Beam> BEAMS = new LinkedHashMap<>();

    private static boolean registered;
    private static long clientTick;

    private GeoBeamRenderer() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            clientTick++;
            if (client.world == null) {
                BEAMS.clear();
                return;
            }
            BEAMS.values().removeIf(beam -> beam.expiresAtTick() < clientTick);
        });
    }

    /**
     * Adds or refreshes a beam. New beams evict the oldest beam when the
     * six-beam geometry budget is full.
     */
    public static void beam(
            String key,
            Vec3d from,
            Vec3d to,
            double radius,
            double width,
            double turns,
            double phase,
            int... colors
    ) {
        Vec3d delta = to.subtract(from);
        double length = Math.min(delta.length(), MAX_BEAM_LENGTH);
        if (key == null
                || key.isBlank()
                || length < 0.05D
                || colors.length == 0
                || !isFinite(from)
                || !isFinite(to)) {
            return;
        }

        Vec3d end = from.add(delta.normalize().multiply(length));
        Beam beam = new Beam(
                from,
                end,
                Math.max(0.0D, radius),
                Math.max(0.002D, width),
                turns,
                phase,
                Arrays.copyOf(colors, colors.length),
                clientTick + BEAM_LIFETIME_TICKS
        );

        BEAMS.remove(key);
        if (BEAMS.size() >= MAX_BEAMS) {
            BEAMS.remove(BEAMS.keySet().iterator().next());
        }
        BEAMS.put(key, beam);
    }

    /**
     * Called from the world-render extraction mixin. The immutable snapshot is
     * camera-relative so large world coordinates retain vertex precision.
     */
    public static void submit(
            MatrixStack matrices,
            Vec3d cameraPos,
            OrderedRenderCommandQueue queue
    ) {
        if (BEAMS.isEmpty()) {
            return;
        }

        List<Beam> snapshot = BEAMS.values().stream()
                .map(beam -> beam.relativeTo(cameraPos))
                .toList();
        queue.submitCustom(
                matrices,
                RenderLayer.getDebugStructureQuads(),
                (entry, vertices) -> snapshot.forEach(beam -> renderBeam(entry, vertices, beam))
        );
    }

    private static void renderBeam(
            MatrixStack.Entry matrices,
            VertexConsumer vertices,
            Beam beam
    ) {
        Vec3d delta = beam.to().subtract(beam.from());
        double length = delta.length();
        Vec3d direction = delta.normalize();
        Vec3d side = perpendicular(direction);
        Vec3d up = side.crossProduct(direction).normalize();
        int segments = Math.clamp((int) Math.ceil(length * 2.0D), MIN_SEGMENTS, MAX_SEGMENTS);

        drawCore(matrices, vertices, beam, direction);
        for (int strand = 0; strand < beam.colors().length; strand++) {
            double strandPhase = beam.phase() + strand * Math.PI * 2.0D / beam.colors().length;
            Vec3d previous = strandPoint(beam, direction, side, up, strandPhase, 0.0D);
            double previousWidth = endpointScale(0.0D) * beam.width();

            for (int segment = 1; segment <= segments; segment++) {
                double progress = segment / (double) segments;
                Vec3d current = strandPoint(beam, direction, side, up, strandPhase, progress);
                double currentWidth = endpointScale(progress) * beam.width();
                drawRibbonSegment(
                        matrices,
                        vertices,
                        previous,
                        current,
                        previousWidth,
                        currentWidth,
                        beam.colors()[strand]
                );
                previous = current;
                previousWidth = currentWidth;
            }
        }
    }

    private static void drawCore(
            MatrixStack.Entry matrices,
            VertexConsumer vertices,
            Beam beam,
            Vec3d direction
    ) {
        Vec3d side = cameraFacingSide(beam.from(), beam.to(), direction);
        Vec3d startOffset = side.multiply(beam.width() * 0.34D);
        Vec3d endOffset = side.multiply(beam.width() * 0.34D);
        addQuad(
                matrices,
                vertices,
                beam.from().subtract(startOffset),
                beam.to().subtract(endOffset),
                beam.to().add(endOffset),
                beam.from().add(startOffset),
                beam.colors()[0],
                150
        );
    }

    private static void drawRibbonSegment(
            MatrixStack.Entry matrices,
            VertexConsumer vertices,
            Vec3d from,
            Vec3d to,
            double fromWidth,
            double toWidth,
            int color
    ) {
        Vec3d direction = to.subtract(from).normalize();
        Vec3d side = cameraFacingSide(from, to, direction);
        Vec3d outerFrom = side.multiply(fromWidth * 2.4D);
        Vec3d outerTo = side.multiply(toWidth * 2.4D);
        addQuad(
                matrices,
                vertices,
                from.subtract(outerFrom),
                to.subtract(outerTo),
                to.add(outerTo),
                from.add(outerFrom),
                color,
                54
        );

        Vec3d innerFrom = side.multiply(fromWidth);
        Vec3d innerTo = side.multiply(toWidth);
        addQuad(
                matrices,
                vertices,
                from.subtract(innerFrom),
                to.subtract(innerTo),
                to.add(innerTo),
                from.add(innerFrom),
                color,
                224
        );
    }

    private static Vec3d strandPoint(
            Beam beam,
            Vec3d direction,
            Vec3d side,
            Vec3d up,
            double strandPhase,
            double progress
    ) {
        double envelope = endpointScale(progress);
        double angle = strandPhase + progress * beam.turns() * Math.PI * 2.0D;
        Vec3d center = beam.from().add(direction.multiply(beam.length() * progress));
        return center
                .add(side.multiply(Math.cos(angle) * beam.radius() * envelope))
                .add(up.multiply(Math.sin(angle) * beam.radius() * envelope));
    }

    private static Vec3d cameraFacingSide(Vec3d from, Vec3d to, Vec3d direction) {
        Vec3d midpoint = from.add(to).multiply(0.5D);
        Vec3d side = direction.crossProduct(midpoint.negate());
        if (side.lengthSquared() < 1.0E-6D) {
            return perpendicular(direction);
        }
        return side.normalize();
    }

    private static Vec3d perpendicular(Vec3d direction) {
        Vec3d side = direction.crossProduct(new Vec3d(0.0D, 1.0D, 0.0D));
        if (side.lengthSquared() < 1.0E-6D) {
            side = direction.crossProduct(new Vec3d(1.0D, 0.0D, 0.0D));
        }
        return side.normalize();
    }

    private static double endpointScale(double progress) {
        return 0.35D + Math.sin(Math.PI * progress) * 0.65D;
    }

    private static void addQuad(
            MatrixStack.Entry matrices,
            VertexConsumer vertices,
            Vec3d first,
            Vec3d second,
            Vec3d third,
            Vec3d fourth,
            int color,
            int alpha
    ) {
        int argb = alpha << 24 | color & 0xFFFFFF;
        vertex(matrices, vertices, first, argb);
        vertex(matrices, vertices, second, argb);
        vertex(matrices, vertices, third, argb);
        vertex(matrices, vertices, fourth, argb);
    }

    private static void vertex(
            MatrixStack.Entry matrices,
            VertexConsumer vertices,
            Vec3d position,
            int color
    ) {
        vertices.vertex(
                matrices,
                (float) position.x,
                (float) position.y,
                (float) position.z
        ).color(color);
    }

    private static boolean isFinite(Vec3d position) {
        return Double.isFinite(position.x)
                && Double.isFinite(position.y)
                && Double.isFinite(position.z);
    }

    private record Beam(
            Vec3d from,
            Vec3d to,
            double radius,
            double width,
            double turns,
            double phase,
            int[] colors,
            long expiresAtTick
    ) {
        private double length() {
            return to.subtract(from).length();
        }

        private Beam relativeTo(Vec3d position) {
            return new Beam(
                    from.subtract(position),
                    to.subtract(position),
                    radius,
                    width,
                    turns,
                    phase,
                    colors,
                    expiresAtTick
            );
        }
    }
}
