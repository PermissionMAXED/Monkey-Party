package de.aetherklang.registry;

import de.aetherklang.Aetherklang;
import de.aetherklang.data.ContentCatalog;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.item.Item;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.RegistryKeys;
import net.minecraft.util.Identifier;

public final class ContentRegistrar {
    private static final List<Item> DATA_ITEMS = new ArrayList<>();

    private ContentRegistrar() {
    }

    public static void register(ContentCatalog catalog) {
        catalog.instruments().keySet().forEach(ContentRegistrar::registerGenericItemIfAbsent);
        catalog.relics().keySet().forEach(ContentRegistrar::registerGenericItemIfAbsent);
        catalog.mobs().keySet().forEach(id -> requireRegistryEntry("mob", Registries.ENTITY_TYPE.containsId(id(id)), id));
        catalog.bosses().keySet().forEach(id -> requireRegistryEntry("boss", Registries.ENTITY_TYPE.containsId(id(id)), id));
        Aetherklang.LOGGER.debug(
                "Bound {} catalog definitions; {} generic data items registered",
                catalog.instruments().size() + catalog.relics().size() + catalog.mobs().size() + catalog.bosses().size(),
                DATA_ITEMS.size()
        );
    }

    public static List<Item> dataItems() {
        return List.copyOf(DATA_ITEMS);
    }

    private static void registerGenericItemIfAbsent(String path) {
        Identifier id = id(path);
        if (Registries.ITEM.containsId(id)) {
            return;
        }
        RegistryKey<Item> key = RegistryKey.of(RegistryKeys.ITEM, id);
        Item item = new Item(new Item.Settings().registryKey(key));
        DATA_ITEMS.add(Registry.register(Registries.ITEM, key, item));
    }

    private static Identifier id(String path) {
        return Aetherklang.id(path);
    }

    private static void requireRegistryEntry(String type, boolean present, String path) {
        if (!present) {
            throw new IllegalStateException("Catalog " + type + " '" + path + "' has no registered entity type");
        }
    }
}
