package de.aetherklang.registry;

import de.aetherklang.Aetherklang;
import net.fabricmc.fabric.api.itemgroup.v1.FabricItemGroup;
import net.minecraft.item.ItemGroup;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.RegistryKeys;
import net.minecraft.text.Text;

public final class ModItemGroups {
    public static final String MAIN_ID = "main";
    public static final RegistryKey<ItemGroup> MAIN_KEY =
            RegistryKey.of(RegistryKeys.ITEM_GROUP, Aetherklang.id(MAIN_ID));
    public static final ItemGroup MAIN = Registry.register(
            Registries.ITEM_GROUP,
            MAIN_KEY,
            FabricItemGroup.builder()
                    .displayName(Text.translatable("itemGroup.aetherklang.main"))
                    .icon(() -> new ItemStack(ModItems.STIMMGABEL))
                    .entries((context, entries) -> ModItems.ALL_ITEMS.forEach(entries::add))
                    .build()
    );

    private ModItemGroups() {
    }

    public static void register() {
        Aetherklang.LOGGER.debug("Registered creative tab {}", MAIN_KEY.getValue());
    }
}
