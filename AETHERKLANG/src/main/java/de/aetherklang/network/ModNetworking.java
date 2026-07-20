package de.aetherklang.network;

import de.aetherklang.Aetherklang;
import de.aetherklang.registry.ModPayloads;
import de.aetherklang.resonance.ResonanceApi;
import de.aetherklang.resonance.ResonancePlayerData;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.server.network.ServerPlayerEntity;

public final class ModNetworking {
    private ModNetworking() {
    }

    public static void register() {
        ServerPlayNetworking.registerGlobalReceiver(
                ModPayloads.DashPayload.ID,
                (payload, context) -> handleDash(payload, context.player())
        );
        ServerPlayConnectionEvents.JOIN.register(
                (handler, sender, server) -> ResonanceApi.sync(handler.getPlayer())
        );
    }

    /**
     * Callable dash hook retained for the later movement work package.
     */
    public static void handleDash(ModPayloads.DashPayload payload, ServerPlayerEntity player) {
        Aetherklang.LOGGER.debug(
                "Dash stub received from {} with strength {}",
                player.getName().getString(),
                payload.strength()
        );
    }

    public static void sendResonanceSync(ServerPlayerEntity player, ResonancePlayerData data) {
        if (ServerPlayNetworking.canSend(player, ModPayloads.ResonanceSyncPayload.ID)) {
            ServerPlayNetworking.send(player, ModPayloads.ResonanceSyncPayload.from(data));
        }
    }

    public static void sendBeatFx(ServerPlayerEntity player, int beat) {
        if (ServerPlayNetworking.canSend(player, ModPayloads.BeatFxPayload.ID)) {
            ServerPlayNetworking.send(player, new ModPayloads.BeatFxPayload(beat));
        }
    }
}
