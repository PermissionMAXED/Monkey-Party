package de.aetherklang.partitur;

import de.aetherklang.Aetherklang;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.server.network.ServerPlayerEntity;

public final class PartiturNetworking {
    private PartiturNetworking() {
    }

    public static void register() {
        PayloadTypeRegistry.playC2S().register(
                PartiturPayloads.ClaimPayload.ID,
                PartiturPayloads.ClaimPayload.CODEC
        );
        PayloadTypeRegistry.playS2C().register(
                PartiturPayloads.SyncPayload.ID,
                PartiturPayloads.SyncPayload.CODEC
        );
        ServerPlayNetworking.registerGlobalReceiver(
                PartiturPayloads.ClaimPayload.ID,
                (payload, context) -> PartiturService.claim(context.player(), payload.contractId())
        );
        Aetherklang.LOGGER.debug("Registered Partitur claim and sync payloads");
    }

    public static void send(ServerPlayerEntity player, boolean openScreen) {
        if (ServerPlayNetworking.canSend(player, PartiturPayloads.SyncPayload.ID)) {
            ServerPlayNetworking.send(player, PartiturService.snapshot(player, openScreen));
        }
    }
}
