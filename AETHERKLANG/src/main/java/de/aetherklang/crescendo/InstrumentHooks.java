package de.aetherklang.crescendo;

import de.aetherklang.Aetherklang;
import de.aetherklang.resonance.ResonanceApi;
import de.aetherklang.resonance.ResonancePlayerData;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import net.minecraft.server.network.ServerPlayerEntity;

/**
 * Common registration point for Crescendo's server-authoritative instruments.
 */
public final class InstrumentHooks {
    private static final String RANG_SERVICE_CLASS = "de.aetherklang.resonance.RangService";
    private static boolean registered;
    private static Method rangLookup;

    private InstrumentHooks() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        rangLookup = findRangLookup();
        Aetherklang.LOGGER.debug("Registered Crescendo instrument mechanics");
    }

    /**
     * Applies the optional rank integration when that work package is present.
     */
    public static boolean canUseFermatenglocke(ServerPlayerEntity player) {
        if (rangLookup == null) {
            return true;
        }
        try {
            Object result = rangLookup.invoke(null, ResonanceApi.getData(player));
            if (!(result instanceof Enum<?> rang)) {
                return true;
            }
            return switch (rang.name()) {
                case "ADEPT", "VIRTUOSE", "MAESTRO" -> true;
                default -> false;
            };
        } catch (IllegalAccessException | InvocationTargetException exception) {
            Aetherklang.LOGGER.warn("Could not evaluate optional Fermatenglocke rank gate", exception);
            return true;
        }
    }

    private static Method findRangLookup() {
        try {
            Class<?> service = Class.forName(RANG_SERVICE_CLASS);
            return service.getMethod("getRang", ResonancePlayerData.class);
        } catch (ClassNotFoundException exception) {
            return null;
        } catch (NoSuchMethodException exception) {
            Aetherklang.LOGGER.warn("RangService is present without the expected getRang integration", exception);
            return null;
        }
    }
}
