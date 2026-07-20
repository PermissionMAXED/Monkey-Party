package de.aetherklang.client.fx.sky;

import de.aetherklang.client.fx.FxPalette;
import de.aetherklang.crescendo.AuroraHooks;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModPayloads;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.particle.DustParticleEffect;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.Vec3d;

/**
 * Visualizes an authoritative ensemble sync as intertwined cyan and gold links.
 *
 * <p>Member UUIDs select truthful links when supplied by the server. Older
 * servers only send the frozen size payload, so they retain the deterministic
 * nearest-player fallback.</p>
 */
public final class EnsembleBeamFx {
    private static final double SAMPLE_STEP = 0.38D;

    private static boolean registered;
    private static int ensembleSize = 1;
    private static Set<UUID> ensembleMembers;
    private static int clientTicks;

    private EnsembleBeamFx() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        ClientPlayNetworking.registerGlobalReceiver(
                ModPayloads.EnsembleSyncPayload.ID,
                (payload, context) -> context.client().execute(() ->
                        ensembleSize = MathHelper.clamp(
                                payload.ensembleSize(),
                                1,
                                AuroraHooks.MAX_ENSEMBLE_SIZE
                        )
                )
        );
        ClientPlayNetworking.registerGlobalReceiver(
                ModPayloads.EnsembleMembersPayload.ID,
                (payload, context) -> context.client().execute(() ->
                        ensembleMembers = Set.copyOf(payload.members())
                )
        );
        ClientTickEvents.END_CLIENT_TICK.register(EnsembleBeamFx::tick);
    }

    private static void tick(MinecraftClient client) {
        clientTicks++;
        if (client.player == null || client.world == null) {
            ensembleSize = 1;
            ensembleMembers = null;
            return;
        }
        boolean hasEnsemble = ensembleMembers == null
                ? ensembleSize >= 2
                : ensembleMembers.size() >= 2;
        if (!hasEnsemble || (clientTicks & 1) != 0) {
            return;
        }

        ClientPlayerEntity player = client.player;
        if (ensembleMembers != null && !ensembleMembers.contains(player.getUuid())) {
            return;
        }
        double maxLinkDistance = AuroraHooks.ENSEMBLE_LINK_DISTANCE;
        long linkLimit = ensembleMembers == null
                ? ensembleSize - 1L
                : Math.min(ensembleMembers.size() - 1L, AuroraHooks.MAX_ENSEMBLE_SIZE - 1L);
        List<AbstractClientPlayerEntity> links = client.world.getPlayers().stream()
                .filter(candidate -> candidate != player)
                .filter(AbstractClientPlayerEntity::isAlive)
                .filter(candidate -> ensembleMembers == null || ensembleMembers.contains(candidate.getUuid()))
                .filter(candidate -> candidate.squaredDistanceTo(player) <= maxLinkDistance * maxLinkDistance)
                .sorted(Comparator
                        .comparingDouble((AbstractClientPlayerEntity candidate) -> candidate.squaredDistanceTo(player))
                        .thenComparing(candidate -> candidate.getUuid().toString()))
                .limit(linkLimit)
                .toList();

        for (int link = 0; link < links.size(); link++) {
            drawLink(client.world, player, links.get(link), link);
        }
    }

    private static void drawLink(
            ClientWorld world,
            AbstractClientPlayerEntity fromPlayer,
            AbstractClientPlayerEntity toPlayer,
            int linkIndex
    ) {
        Vec3d from = new Vec3d(
                fromPlayer.getX(),
                fromPlayer.getBodyY(0.63D),
                fromPlayer.getZ()
        );
        Vec3d to = new Vec3d(
                toPlayer.getX(),
                toPlayer.getBodyY(0.63D),
                toPlayer.getZ()
        );
        Vec3d delta = to.subtract(from);
        double length = delta.length();
        if (length < 0.35D || length > AuroraHooks.ENSEMBLE_LINK_DISTANCE) {
            return;
        }

        Vec3d direction = delta.normalize();
        Vec3d side = direction.crossProduct(new Vec3d(0.0D, 1.0D, 0.0D));
        if (side.lengthSquared() < 0.001D) {
            side = direction.crossProduct(new Vec3d(1.0D, 0.0D, 0.0D));
        }
        side = side.normalize();
        Vec3d up = side.crossProduct(direction).normalize();
        int steps = Math.max(3, (int) Math.ceil(length / SAMPLE_STEP));
        double phase = clientTicks * 0.22D + linkIndex * 1.91D;

        for (int step = 0; step <= steps; step++) {
            double progress = step / (double) steps;
            Vec3d center = from.add(delta.multiply(progress));
            double envelope = MathHelper.sin((float) (Math.PI * progress));
            double radius = 0.045D + envelope * 0.14D;

            for (int strand = 0; strand < 2; strand++) {
                double angle = phase + progress * Math.PI * 8.0D + strand * Math.PI;
                Vec3d point = center
                        .add(side.multiply(Math.cos(angle) * radius))
                        .add(up.multiply(Math.sin(angle) * radius));
                int color = strand == 0 ? FxPalette.CYAN : FxPalette.GOLD;
                world.addParticleClient(
                        new DustParticleEffect(color, 0.62F),
                        point.x,
                        point.y,
                        point.z,
                        0.0D,
                        0.0D,
                        0.0D
                );
            }

            if ((step + linkIndex) % 4 == 0) {
                double lift = Math.sin(phase + progress * Math.PI * 5.0D) * radius * 1.7D;
                Vec3d spark = center.add(up.multiply(lift));
                world.addParticleClient(
                        ModParticles.ENSEMBLE_FUNKE,
                        spark.x,
                        spark.y,
                        spark.z,
                        direction.x * 0.006D,
                        0.012D + envelope * 0.008D,
                        direction.z * 0.006D
                );
            }
        }
    }
}
