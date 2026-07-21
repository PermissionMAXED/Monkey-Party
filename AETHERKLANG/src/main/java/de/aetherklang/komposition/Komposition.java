package de.aetherklang.komposition;

import net.fabricmc.api.ModInitializer;

/**
 * Isolated common entrypoint for Zauberpartitur networking.
 */
public final class Komposition implements ModInitializer {
    @Override
    public void onInitialize() {
        KompositionNetworking.register();
    }
}
