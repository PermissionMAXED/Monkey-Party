package de.aetherklang.leitmotiv.client;

import de.aetherklang.client.ModKeybinds;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.Screen;

public final class LeitmotivOpener {
    private LeitmotivOpener() {
    }

    public static void register() {
        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            while (ModKeybinds.OPEN_LEITMOTIV.wasPressed()) {
                open(client, null);
            }
        });
    }

    public static void open(MinecraftClient client, Screen parent) {
        if (client.player != null) {
            client.setScreen(new LeitmotivScreen(parent));
        }
    }
}
