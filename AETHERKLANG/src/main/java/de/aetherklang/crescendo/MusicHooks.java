package de.aetherklang.crescendo;

import de.aetherklang.Aetherklang;
import java.lang.reflect.InvocationTargetException;
import net.fabricmc.api.EnvType;
import net.fabricmc.loader.api.FabricLoader;

/**
 * Environment-safe integration point for adaptive Crescendo music.
 */
public final class MusicHooks {
    private static final String CLIENT_SEQUENCER = "de.aetherklang.client.music.AdaptiveMusicSequencer";
    private static boolean registered;

    private MusicHooks() {
    }

    public static void register() {
        if (registered || FabricLoader.getInstance().getEnvironmentType() != EnvType.CLIENT) {
            return;
        }
        registered = true;

        try {
            Class.forName(CLIENT_SEQUENCER).getMethod("register").invoke(null);
        } catch (ClassNotFoundException | NoSuchMethodException | IllegalAccessException exception) {
            Aetherklang.LOGGER.error("Could not load the adaptive client music sequencer", exception);
        } catch (InvocationTargetException exception) {
            Aetherklang.LOGGER.error("Could not initialize the adaptive client music sequencer", exception.getCause());
        }
    }
}
