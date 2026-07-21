package de.aetherklang.kanon;

import java.util.List;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.server.network.ServerPlayerEntity;

final class KanonNetworking {
    private KanonNetworking() {
    }

    static void send(
            ServerPlayerEntity player,
            List<KanonNote> phrase,
            KanonEngine.Phase phase,
            int progress,
            int revealed,
            int ticksUntilNote,
            boolean duel,
            String counterpart
    ) {
        if (!ServerPlayNetworking.canSend(player, KanonPayloads.KanonSyncPayload.ID)) {
            return;
        }
        ServerPlayNetworking.send(
                player,
                new KanonPayloads.KanonSyncPayload(
                        phrase.stream().map(KanonNote::networkCode).toList(),
                        phase.networkId(),
                        progress,
                        revealed,
                        ticksUntilNote,
                        duel,
                        counterpart
                )
        );
    }

    static void clear(ServerPlayerEntity player) {
        if (ServerPlayNetworking.canSend(player, KanonPayloads.KanonSyncPayload.ID)) {
            ServerPlayNetworking.send(
                    player,
                    new KanonPayloads.KanonSyncPayload(List.of(), 0, 0, 0, 0, false, "")
            );
        }
    }
}
