package de.aetherklang.client;

import de.aetherklang.Aetherklang;
import de.aetherklang.registry.ModItems;
import de.aetherklang.registry.ModPayloads;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.entity.EquipmentSlot;
import org.lwjgl.glfw.GLFW;

public final class ModKeybinds {
    private static final KeyBinding.Category CATEGORY =
            KeyBinding.Category.create(Aetherklang.id("controls"));

    public static final KeyBinding OPEN_KODEX = register("open_kodex", GLFW.GLFW_KEY_K);
    public static final KeyBinding DASH = register("dash", GLFW.GLFW_KEY_R);
    public static final KeyBinding CYCLE_MOOD = register("cycle_mood", GLFW.GLFW_KEY_M);
    private static boolean handlersRegistered;

    private ModKeybinds() {
    }

    private static KeyBinding register(String path, int defaultKey) {
        return KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.aetherklang." + path,
                InputUtil.Type.KEYSYM,
                defaultKey,
                CATEGORY
        ));
    }

    public static void register() {
        if (handlersRegistered) {
            return;
        }
        handlersRegistered = true;
        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            while (DASH.wasPressed()) {
                dash(client);
            }
            while (CYCLE_MOOD.wasPressed()) {
                cycleMood(client);
            }
        });
    }

    private static void dash(MinecraftClient client) {
        if (client.player == null
                || client.getNetworkHandler() == null
                || !client.player.getEquippedStack(EquipmentSlot.FEET).isOf(ModItems.ECHOSTIEFEL)) {
            return;
        }
        if (ClientPlayNetworking.canSend(ModPayloads.DashPayload.ID)) {
            ClientPlayNetworking.send(new ModPayloads.DashPayload(1.0F));
        }
    }

    private static void cycleMood(MinecraftClient client) {
        if (client.player == null || client.getNetworkHandler() == null) {
            return;
        }
        if (ClientPlayNetworking.canSend(ModPayloads.MoodCyclePayload.ID)) {
            ClientPlayNetworking.send(new ModPayloads.MoodCyclePayload(1));
        }
    }
}
