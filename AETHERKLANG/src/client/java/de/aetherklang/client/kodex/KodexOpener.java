package de.aetherklang.client.kodex;

import de.aetherklang.client.ModKeybinds;
import de.aetherklang.registry.ModItems;
import de.aetherklang.registry.ModPayloads;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.fabricmc.fabric.api.event.player.UseItemCallback;
import net.minecraft.client.MinecraftClient;
import net.minecraft.util.ActionResult;

public final class KodexOpener {
    private KodexOpener() {
    }

    public static void register() {
        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            while (ModKeybinds.OPEN_KODEX.wasPressed()) {
                open(client);
            }
        });

        UseItemCallback.EVENT.register((player, world, hand) -> {
            if (!world.isClient() || !player.getStackInHand(hand).isOf(ModItems.KODEX)) {
                return ActionResult.PASS;
            }
            open(MinecraftClient.getInstance());
            return ActionResult.SUCCESS;
        });
    }

    private static void open(MinecraftClient client) {
        client.setScreen(new KodexScreen());
        if (client.getNetworkHandler() != null
                && ClientPlayNetworking.canSend(ModPayloads.KodexOpenPayload.ID)) {
            ClientPlayNetworking.send(new ModPayloads.KodexOpenPayload(true));
        }
    }
}
