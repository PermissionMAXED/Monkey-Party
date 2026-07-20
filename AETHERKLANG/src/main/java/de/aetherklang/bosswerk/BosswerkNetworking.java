package de.aetherklang.bosswerk;

import de.aetherklang.registry.ModPayloads;
import java.util.HashSet;
import java.util.Set;
import net.fabricmc.fabric.api.networking.v1.PlayerLookup;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;

final class BosswerkNetworking {
    private static final double FX_RADIUS = 64.0D;
    static final int PHASE_TRANSITION_OPERATION = BossOperation.values().length;

    private BosswerkNetworking() {
    }

    static void sendAttack(BosswerkBossEntity boss, int phase, BossOperation operation) {
        send(boss, phase, operation.networkId());
    }

    static void sendPhaseTransition(BosswerkBossEntity boss, int phase) {
        send(boss, phase, PHASE_TRANSITION_OPERATION);
    }

    private static void send(BosswerkBossEntity boss, int phase, int operation) {
        if (!(boss.getEntityWorld() instanceof ServerWorld world)) {
            return;
        }
        Set<ServerPlayerEntity> recipients = new HashSet<>(
                PlayerLookup.around(world, boss.getEntityPos(), FX_RADIUS)
        );
        for (ServerPlayerEntity player : recipients) {
            if (ServerPlayNetworking.canSend(player, ModPayloads.BossFxPayload.ID)) {
                ServerPlayNetworking.send(player, new ModPayloads.BossFxPayload(phase, operation));
            }
        }
    }
}
