package de.aetherklang.sturmfront;

import de.aetherklang.registry.ModPayloads;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;

/**
 * Broadcasts the authoritative front position without loading weather-path chunks.
 */
final class SturmfrontNetworking {
    private SturmfrontNetworking() {
    }

    static void broadcast(ServerWorld world, SturmfrontSnapshot snapshot) {
        for (ServerPlayerEntity player : world.getPlayers()) {
            send(player, snapshot);
        }
    }

    static void send(ServerPlayerEntity player, SturmfrontSnapshot snapshot) {
        if (!ServerPlayNetworking.canSend(player, ModPayloads.SturmfrontSyncPayload.ID)) {
            return;
        }
        ServerPlayNetworking.send(
                player,
                new ModPayloads.SturmfrontSyncPayload(
                        snapshot.active(),
                        snapshot.centerX(),
                        snapshot.centerZ(),
                        snapshot.radius(),
                        snapshot.directionX(),
                        snapshot.directionZ(),
                        snapshot.intensity(),
                        snapshot.revision()
                )
        );
    }
}
