package de.aetherklang.partitur;

import de.aetherklang.Aetherklang;
import de.aetherklang.klangwerk.KlangwerkReloadDef;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import net.minecraft.registry.Registries;

/**
 * Validated gameplay view of the reloadable Klangwerk contract catalog.
 */
public final class PartiturCatalog {
    public static final int CONTRACTS_PER_ROTATION = 3;
    public static final int MINIMUM_DEFINITIONS = 8;

    private static Map<String, AuftragDef> definitions = Map.of();

    private PartiturCatalog() {
    }

    /**
     * Validates and atomically installs the latest {@code klangwerk/auftrag} snapshot.
     */
    public static void install(Map<String, KlangwerkReloadDef> rawDefinitions) {
        LinkedHashMap<String, AuftragDef> loaded = new LinkedHashMap<>();
        rawDefinitions.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> {
                    AuftragDef definition = AuftragDef.fromReloadDef(entry.getValue());
                    if (!entry.getKey().equals(definition.id())) {
                        throw new IllegalArgumentException(
                                "Partitur catalog key '" + entry.getKey()
                                        + "' does not match contract id '" + definition.id() + "'"
                        );
                    }
                    loaded.put(definition.id(), definition);
                });
        if (loaded.size() < MINIMUM_DEFINITIONS) {
            throw new IllegalStateException(
                    "Partitur requires at least " + MINIMUM_DEFINITIONS + " contracts, found " + loaded.size()
            );
        }
        loaded.values().forEach(PartiturCatalog::validateRewardMaterial);
        definitions = Map.copyOf(loaded);
        Aetherklang.LOGGER.info(
                "Partitur catalog loaded: {} contracts, {} per rotation",
                definitions.size(),
                CONTRACTS_PER_ROTATION
        );
    }

    public static Map<String, AuftragDef> definitions() {
        return definitions;
    }

    public static AuftragDef get(String id) {
        return definitions.get(id);
    }

    public static List<AuftragDef> rotation(long rotation) {
        if (definitions.size() < CONTRACTS_PER_ROTATION) {
            throw new IllegalStateException("Partitur catalog is not initialized");
        }
        return definitions.values().stream()
                .sorted(Comparator
                        .comparingLong((AuftragDef definition) -> rotationScore(definition.id(), rotation))
                        .thenComparing(AuftragDef::id))
                .limit(CONTRACTS_PER_ROTATION)
                .toList();
    }

    private static void validateRewardMaterial(AuftragDef definition) {
        if (definition.rewardMaterial() != null && !Registries.ITEM.containsId(definition.rewardMaterial())) {
            throw new IllegalArgumentException(
                    "Unknown reward material '" + definition.rewardMaterial()
                            + "' in Partitur contract '" + definition.id() + "'"
            );
        }
    }

    private static long rotationScore(String id, long rotation) {
        long value = ((long) id.hashCode() << 32) ^ rotation;
        value ^= value >>> 30;
        value *= 0xBF58476D1CE4E5B9L;
        value ^= value >>> 27;
        value *= 0x94D049BB133111EBL;
        return value ^ (value >>> 31);
    }
}
