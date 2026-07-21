package de.aetherklang.komposition;

import de.aetherklang.Aetherklang;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.item.ItemStack;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Hand;

public final class KompositionNetworking {
    private KompositionNetworking() {
    }

    public static void register() {
        PayloadTypeRegistry.playS2C().register(
                KompositionPayloads.OpenEditorPayload.ID,
                KompositionPayloads.OpenEditorPayload.CODEC
        );
        PayloadTypeRegistry.playC2S().register(
                KompositionPayloads.SavePayload.ID,
                KompositionPayloads.SavePayload.CODEC
        );
        ServerPlayNetworking.registerGlobalReceiver(
                KompositionPayloads.SavePayload.ID,
                (payload, context) -> save(context.player(), payload)
        );
        Aetherklang.LOGGER.debug("Registered Zauberpartitur editor payloads");
    }

    public static boolean openEditor(ServerPlayerEntity player, Hand hand) {
        ItemStack stack = player.getStackInHand(hand);
        if (!(stack.getItem() instanceof ZauberpartiturItem item)
                || !ServerPlayNetworking.canSend(player, KompositionPayloads.OpenEditorPayload.ID)) {
            return false;
        }
        ServerPlayNetworking.send(
                player,
                new KompositionPayloads.OpenEditorPayload(hand, item.score(stack))
        );
        return true;
    }

    public static boolean openHeldEditor(ServerPlayerEntity player) {
        return openEditor(player, Hand.MAIN_HAND) || openEditor(player, Hand.OFF_HAND);
    }

    private static void save(ServerPlayerEntity player, KompositionPayloads.SavePayload payload) {
        if (!player.isAlive() || player.isSpectator()) {
            return;
        }
        ItemStack stack = player.getStackInHand(payload.hand());
        if (!(stack.getItem() instanceof ZauberpartiturItem)) {
            return;
        }
        stack.set(KompositionComponents.ZAUBERPARTITUR, payload.score());
        player.sendMessage(Text.translatable("message.aetherklang.zauberpartitur.saved"), true);
    }
}
