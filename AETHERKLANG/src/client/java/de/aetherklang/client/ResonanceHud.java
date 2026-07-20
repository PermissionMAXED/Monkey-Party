package de.aetherklang.client;

import de.aetherklang.Aetherklang;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;

public final class ResonanceHud {
    private ResonanceHud() {
    }

    public static void register() {
        HudElementRegistry.addLast(Aetherklang.id("resonance_hud"), (drawContext, tickCounter) -> {
            // Rendering is intentionally empty until the RP/beat HUD work package.
        });
    }
}
