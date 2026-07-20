package de.aetherklang.registry;

import de.aetherklang.Aetherklang;
import de.aetherklang.item.BasshammerItem;
import de.aetherklang.item.EchostiefelItem;
import de.aetherklang.item.HallharfeItem;
import de.aetherklang.item.KodexItem;
import de.aetherklang.item.ResonanzklingeItem;
import de.aetherklang.item.StimmgabelItem;
import java.util.List;
import java.util.function.Function;
import net.minecraft.block.Block;
import net.minecraft.item.BlockItem;
import net.minecraft.item.Item;
import net.minecraft.item.SpawnEggItem;
import net.minecraft.item.ToolMaterial;
import net.minecraft.item.equipment.ArmorMaterials;
import net.minecraft.item.equipment.EquipmentType;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.RegistryKeys;

public final class ModItems {
    public static final String STIMMGABEL_ID = "stimmgabel";
    public static final String RESONANZKLINGE_ID = "resonanzklinge";
    public static final String HALLHARFE_ID = "hallharfe";
    public static final String BASSHAMMER_ID = "basshammer";
    public static final String ECHOSTIEFEL_ID = "echostiefel";
    public static final String KODEX_ID = "kodex";
    public static final String DISSONANZGEIST_SPAWN_EGG_ID = "dissonanzgeist_spawn_egg";
    public static final String HALLWAECHTER_SPAWN_EGG_ID = "hallwaechter_spawn_egg";
    public static final String ECHONOTE_SPAWN_EGG_ID = "echonote_spawn_egg";
    public static final String CHORAL_SPAWN_EGG_ID = "choral_spawn_egg";

    public static final Item STIMMGABEL =
            register(STIMMGABEL_ID, StimmgabelItem::new, new Item.Settings().maxCount(1));
    public static final Item RESONANZKLINGE = register(
            RESONANZKLINGE_ID,
            ResonanzklingeItem::new,
            new Item.Settings().sword(ToolMaterial.DIAMOND, 3.0F, -2.4F).maxDamage(512)
    );
    public static final Item HALLHARFE =
            register(HALLHARFE_ID, HallharfeItem::new, new Item.Settings().maxCount(1).maxDamage(384));
    public static final Item BASSHAMMER = register(
            BASSHAMMER_ID,
            BasshammerItem::new,
            new Item.Settings().axe(ToolMaterial.DIAMOND, 6.0F, -3.2F).maxDamage(768)
    );
    public static final Item ECHOSTIEFEL = register(
            ECHOSTIEFEL_ID,
            EchostiefelItem::new,
            new Item.Settings().armor(ArmorMaterials.IRON, EquipmentType.BOOTS).maxDamage(429)
    );
    public static final Item KODEX = register(KODEX_ID, KodexItem::new, new Item.Settings().maxCount(1));
    public static final Item DISSONANZGEIST_SPAWN_EGG = register(
            DISSONANZGEIST_SPAWN_EGG_ID,
            SpawnEggItem::new,
            new Item.Settings().spawnEgg(ModEntities.DISSONANZGEIST)
    );
    public static final Item HALLWAECHTER_SPAWN_EGG = register(
            HALLWAECHTER_SPAWN_EGG_ID,
            SpawnEggItem::new,
            new Item.Settings().spawnEgg(ModEntities.HALLWAECHTER)
    );
    public static final Item ECHONOTE_SPAWN_EGG = register(
            ECHONOTE_SPAWN_EGG_ID,
            SpawnEggItem::new,
            new Item.Settings().spawnEgg(ModEntities.ECHONOTE)
    );
    public static final Item CHORAL_SPAWN_EGG = register(
            CHORAL_SPAWN_EGG_ID,
            SpawnEggItem::new,
            new Item.Settings().spawnEgg(ModEntities.CHORAL)
    );

    public static final Item RESONANZKRISTALL_INDIGO =
            registerBlockItem(ModBlocks.RESONANZKRISTALL_INDIGO_ID, ModBlocks.RESONANZKRISTALL_INDIGO);
    public static final Item RESONANZKRISTALL_CYAN =
            registerBlockItem(ModBlocks.RESONANZKRISTALL_CYAN_ID, ModBlocks.RESONANZKRISTALL_CYAN);
    public static final Item RESONANZKRISTALL_GOLD =
            registerBlockItem(ModBlocks.RESONANZKRISTALL_GOLD_ID, ModBlocks.RESONANZKRISTALL_GOLD);
    public static final Item RESONANZKRISTALL_MAGENTA =
            registerBlockItem(ModBlocks.RESONANZKRISTALL_MAGENTA_ID, ModBlocks.RESONANZKRISTALL_MAGENTA);
    public static final Item STIMMALTAR = registerBlockItem(ModBlocks.STIMMALTAR_ID, ModBlocks.STIMMALTAR);
    public static final Item DISSONANZRISS = registerBlockItem(ModBlocks.DISSONANZRISS_ID, ModBlocks.DISSONANZRISS);
    public static final Item GLOCKENSPIEL_PORTAL =
            registerBlockItem(ModBlocks.GLOCKENSPIEL_PORTAL_ID, ModBlocks.GLOCKENSPIEL_PORTAL);

    public static final List<Item> ALL_ITEMS = List.of(
            STIMMGABEL,
            RESONANZKLINGE,
            HALLHARFE,
            BASSHAMMER,
            ECHOSTIEFEL,
            KODEX,
            DISSONANZGEIST_SPAWN_EGG,
            HALLWAECHTER_SPAWN_EGG,
            ECHONOTE_SPAWN_EGG,
            CHORAL_SPAWN_EGG,
            RESONANZKRISTALL_INDIGO,
            RESONANZKRISTALL_CYAN,
            RESONANZKRISTALL_GOLD,
            RESONANZKRISTALL_MAGENTA,
            STIMMALTAR,
            DISSONANZRISS,
            GLOCKENSPIEL_PORTAL
    );

    private ModItems() {
    }

    private static Item register(String path, Function<Item.Settings, Item> factory, Item.Settings settings) {
        RegistryKey<Item> key = RegistryKey.of(RegistryKeys.ITEM, Aetherklang.id(path));
        return Registry.register(Registries.ITEM, key, factory.apply(settings.registryKey(key)));
    }

    private static Item registerBlockItem(String path, Block block) {
        RegistryKey<Item> key = RegistryKey.of(RegistryKeys.ITEM, Aetherklang.id(path));
        Item.Settings settings = new Item.Settings().useBlockPrefixedTranslationKey().registryKey(key);
        return Registry.register(Registries.ITEM, key, new BlockItem(block, settings));
    }

    public static void register() {
        Aetherklang.LOGGER.debug("Registered {} Aetherklang items", ALL_ITEMS.size());
    }
}
