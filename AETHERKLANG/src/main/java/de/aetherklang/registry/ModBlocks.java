package de.aetherklang.registry;

import de.aetherklang.Aetherklang;
import net.minecraft.block.AbstractBlock;
import net.minecraft.block.Block;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.RegistryKeys;

public final class ModBlocks {
    public static final String RESONANZKRISTALL_INDIGO_ID = "resonanzkristall_indigo";
    public static final String RESONANZKRISTALL_CYAN_ID = "resonanzkristall_cyan";
    public static final String RESONANZKRISTALL_GOLD_ID = "resonanzkristall_gold";
    public static final String RESONANZKRISTALL_MAGENTA_ID = "resonanzkristall_magenta";
    public static final String STIMMALTAR_ID = "stimmaltar";
    public static final String DISSONANZRISS_ID = "dissonanzriss";
    public static final String GLOCKENSPIEL_PORTAL_ID = "glockenspiel_portal";

    public static final Block RESONANZKRISTALL_INDIGO = register(RESONANZKRISTALL_INDIGO_ID, 1.5F, 6.0F);
    public static final Block RESONANZKRISTALL_CYAN = register(RESONANZKRISTALL_CYAN_ID, 1.5F, 6.0F);
    public static final Block RESONANZKRISTALL_GOLD = register(RESONANZKRISTALL_GOLD_ID, 1.5F, 6.0F);
    public static final Block RESONANZKRISTALL_MAGENTA = register(RESONANZKRISTALL_MAGENTA_ID, 1.5F, 6.0F);
    public static final Block STIMMALTAR = register(STIMMALTAR_ID, 3.5F, 12.0F);
    public static final Block DISSONANZRISS = register(DISSONANZRISS_ID, 0.5F, 1.0F);
    public static final Block GLOCKENSPIEL_PORTAL = register(GLOCKENSPIEL_PORTAL_ID, -1.0F, 3_600_000.0F);

    private ModBlocks() {
    }

    private static Block register(String path, float hardness, float resistance) {
        var id = Aetherklang.id(path);
        RegistryKey<Block> key = RegistryKey.of(RegistryKeys.BLOCK, id);
        AbstractBlock.Settings settings = AbstractBlock.Settings.create()
                .registryKey(key)
                .strength(hardness, resistance)
                .requiresTool();
        return Registry.register(Registries.BLOCK, key, new Block(settings));
    }

    public static void register() {
        Aetherklang.LOGGER.debug("Registered {} Aetherklang blocks", 7);
    }
}
