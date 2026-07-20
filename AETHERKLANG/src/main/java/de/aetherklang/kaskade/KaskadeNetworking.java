package de.aetherklang.kaskade;

import de.aetherklang.registry.ModPayloads;
import java.util.HashSet;
import java.util.Set;
import net.fabricmc.fabric.api.networking.v1.PlayerLookup;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;

final class KaskadeNetworking {
    private static final double FX_RADIUS = 64.0D;

    private KaskadeNetworking() {
    }

    static void broadcastKaskade(ServerWorld world, BlockPos center, int stage) {
        ModPayloads.KaskadeFxPayload payload = new ModPayloads.KaskadeFxPayload(
                stage,
                center.getX(),
                center.getY(),
                center.getZ()
        );
        for (ServerPlayerEntity player : PlayerLookup.around(world, Vec3d.ofCenter(center), FX_RADIUS)) {
            if (ServerPlayNetworking.canSend(player, ModPayloads.KaskadeFxPayload.ID)) {
                ServerPlayNetworking.send(player, payload);
            }
        }
    }

    static void broadcastWeltakkord(
            ServerWorld world,
            Vec3d center,
            Set<ServerPlayerEntity> participants,
            int power,
            boolean reduced
    ) {
        ModPayloads.WeltakkordFxPayload payload = new ModPayloads.WeltakkordFxPayload(
                center.x,
                center.y,
                center.z,
                power,
                reduced
        );
        Set<ServerPlayerEntity> recipients = new HashSet<>(
                PlayerLookup.around(world, center, FX_RADIUS)
        );
        recipients.addAll(participants);
        for (ServerPlayerEntity player : recipients) {
            if (ServerPlayNetworking.canSend(player, ModPayloads.WeltakkordFxPayload.ID)) {
                ServerPlayNetworking.send(player, payload);
            }
        }
    }
}
