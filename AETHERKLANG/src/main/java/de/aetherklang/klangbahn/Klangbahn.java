package de.aetherklang.klangbahn;

import de.aetherklang.Aetherklang;
import de.aetherklang.registry.ModItemGroups;
import net.fabricmc.fabric.api.itemgroup.v1.ItemGroupEvents;
import net.minecraft.block.AbstractBlock;
import net.minecraft.block.Block;
import net.minecraft.item.BlockItem;
import net.minecraft.item.Item;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.RegistryKeys;
import net.minecraft.sound.BlockSoundGroup;
import net.minecraft.util.DyeColor;

/**
 * Registration entry point for the rideable beat-pulse light railway.
 */
public final class Klangbahn {
    public static final String BAHNANKER_ID = "bahnanker";

    public static final BahnankerBlock BAHNANKER = registerBahnanker();
    public static final Item BAHNANKER_ITEM = registerBahnankerItem();

    private static boolean registered;

    private Klangbahn() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        registered = true;
        ItemGroupEvents.modifyEntriesEvent(ModItemGroups.MAIN_KEY)
                .register(entries -> entries.add(BAHNANKER_ITEM));
        KlangbahnService.register();
        Aetherklang.LOGGER.info(
                "Klangbahn registered: rideable beat-light routes up to {} blocks",
                KlangbahnService.MAX_ROUTE_RANGE
        );
    }

    private static BahnankerBlock registerBahnanker() {
        var id = Aetherklang.id(BAHNANKER_ID);
        RegistryKey<Block> key = RegistryKey.of(RegistryKeys.BLOCK, id);
        AbstractBlock.Settings settings = AbstractBlock.Settings.create()
                .registryKey(key)
                .mapColor(DyeColor.CYAN)
                .strength(3.0F, 9.0F)
                .sounds(BlockSoundGroup.AMETHYST_BLOCK)
                .luminance(BahnankerBlock::getLightLevel)
                .emissiveLighting((state, world, pos) -> true)
                .requiresTool();
        return Registry.register(Registries.BLOCK, key, new BahnankerBlock(settings));
    }

    private static Item registerBahnankerItem() {
        RegistryKey<Item> key = RegistryKey.of(RegistryKeys.ITEM, Aetherklang.id(BAHNANKER_ID));
        Item.Settings settings = new Item.Settings()
                .useBlockPrefixedTranslationKey()
                .registryKey(key);
        return Registry.register(Registries.ITEM, key, new BlockItem(BAHNANKER, settings));
    }
}
