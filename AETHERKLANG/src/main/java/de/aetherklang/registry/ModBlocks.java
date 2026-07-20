package de.aetherklang.registry;

import de.aetherklang.Aetherklang;
import de.aetherklang.block.DissonanzrissBlock;
import de.aetherklang.block.GlockenspielPortalBlock;
import de.aetherklang.block.KlangblumeBlock;
import de.aetherklang.block.KlanglaterneBlock;
import de.aetherklang.block.ResonanceCrystalBlock;
import de.aetherklang.block.ResonanzarchivBlock;
import de.aetherklang.block.StimmaltarBlock;
import de.aetherklang.block.TaktbrueckeBlock;
import java.util.function.Function;
import net.minecraft.block.AbstractBlock;
import net.minecraft.block.Block;
import net.minecraft.block.piston.PistonBehavior;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.RegistryKeys;
import net.minecraft.sound.BlockSoundGroup;
import net.minecraft.util.DyeColor;

public final class ModBlocks {
    public static final String RESONANZKRISTALL_INDIGO_ID = "resonanzkristall_indigo";
    public static final String RESONANZKRISTALL_CYAN_ID = "resonanzkristall_cyan";
    public static final String RESONANZKRISTALL_GOLD_ID = "resonanzkristall_gold";
    public static final String RESONANZKRISTALL_MAGENTA_ID = "resonanzkristall_magenta";
    public static final String STIMMALTAR_ID = "stimmaltar";
    public static final String DISSONANZRISS_ID = "dissonanzriss";
    public static final String GLOCKENSPIEL_PORTAL_ID = "glockenspiel_portal";
    public static final String KLANGLATERNE_ID = "klanglaterne";
    public static final String TAKTBRUECKE_ID = "taktbruecke";
    public static final String RESONANZARCHIV_ID = "resonanzarchiv";
    public static final String KLANGBLUME_ID = "klangblume";

    public static final ResonanceCrystalBlock RESONANZKRISTALL_INDIGO =
            registerCrystal(RESONANZKRISTALL_INDIGO_ID, DyeColor.PURPLE, 9);
    public static final ResonanceCrystalBlock RESONANZKRISTALL_CYAN =
            registerCrystal(RESONANZKRISTALL_CYAN_ID, DyeColor.CYAN, 11);
    public static final ResonanceCrystalBlock RESONANZKRISTALL_GOLD =
            registerCrystal(RESONANZKRISTALL_GOLD_ID, DyeColor.YELLOW, 12);
    public static final ResonanceCrystalBlock RESONANZKRISTALL_MAGENTA =
            registerCrystal(RESONANZKRISTALL_MAGENTA_ID, DyeColor.MAGENTA, 10);
    public static final StimmaltarBlock STIMMALTAR = register(
            STIMMALTAR_ID,
            StimmaltarBlock::new,
            settings -> settings
                    .mapColor(DyeColor.PURPLE)
                    .strength(3.5F, 12.0F)
                    .sounds(BlockSoundGroup.DEEPSLATE)
                    .luminance(state -> 7)
                    .emissiveLighting((state, world, pos) -> true)
                    .requiresTool()
    );
    public static final DissonanzrissBlock DISSONANZRISS = register(
            DISSONANZRISS_ID,
            DissonanzrissBlock::new,
            settings -> settings
                    .mapColor(DyeColor.MAGENTA)
                    .strength(0.5F, 1.0F)
                    .sounds(BlockSoundGroup.SCULK)
                    .luminance(state -> 4)
                    .emissiveLighting((state, world, pos) -> true)
                    .noCollision()
                    .nonOpaque()
                    .pistonBehavior(PistonBehavior.DESTROY)
    );
    public static final GlockenspielPortalBlock GLOCKENSPIEL_PORTAL = register(
            GLOCKENSPIEL_PORTAL_ID,
            GlockenspielPortalBlock::new,
            settings -> settings
                    .mapColor(DyeColor.CYAN)
                    .strength(-1.0F, 3_600_000.0F)
                    .sounds(BlockSoundGroup.GLASS)
                    .luminance(state -> 12)
                    .emissiveLighting((state, world, pos) -> true)
                    .noCollision()
                    .nonOpaque()
                    .dropsNothing()
                    .pistonBehavior(PistonBehavior.BLOCK)
    );
    public static final KlanglaterneBlock KLANGLATERNE = register(
            KLANGLATERNE_ID,
            KlanglaterneBlock::new,
            settings -> settings
                    .mapColor(DyeColor.YELLOW)
                    .strength(1.0F)
                    .sounds(BlockSoundGroup.LANTERN)
                    .luminance(state -> 15)
    );
    public static final TaktbrueckeBlock TAKTBRUECKE = register(
            TAKTBRUECKE_ID,
            TaktbrueckeBlock::new,
            settings -> settings
                    .mapColor(DyeColor.BROWN)
                    .strength(2.0F, 3.0F)
                    .sounds(BlockSoundGroup.BAMBOO_WOOD)
    );
    public static final ResonanzarchivBlock RESONANZARCHIV = register(
            RESONANZARCHIV_ID,
            ResonanzarchivBlock::new,
            settings -> settings
                    .mapColor(DyeColor.PURPLE)
                    .strength(3.0F, 9.0F)
                    .sounds(BlockSoundGroup.CHISELED_BOOKSHELF)
                    .requiresTool()
    );
    public static final KlangblumeBlock KLANGBLUME = register(
            KLANGBLUME_ID,
            KlangblumeBlock::new,
            settings -> settings
                    .mapColor(DyeColor.CYAN)
                    .strength(0.2F)
                    .sounds(BlockSoundGroup.FLOWERING_AZALEA)
                    .luminance(state -> 4)
                    .nonOpaque()
    );

    private ModBlocks() {
    }

    private static ResonanceCrystalBlock registerCrystal(String path, DyeColor color, int luminance) {
        return register(
                path,
                ResonanceCrystalBlock::new,
                settings -> settings
                        .mapColor(color)
                        .strength(1.5F, 6.0F)
                        .sounds(BlockSoundGroup.AMETHYST_BLOCK)
                        .luminance(state -> luminance)
                        .emissiveLighting((state, world, pos) -> true)
                        .nonOpaque()
                        .requiresTool()
        );
    }

    private static <T extends Block> T register(
            String path,
            Function<AbstractBlock.Settings, T> factory,
            Function<AbstractBlock.Settings, AbstractBlock.Settings> settingsFactory
    ) {
        var id = Aetherklang.id(path);
        RegistryKey<Block> key = RegistryKey.of(RegistryKeys.BLOCK, id);
        AbstractBlock.Settings settings = settingsFactory.apply(AbstractBlock.Settings.create().registryKey(key));
        return Registry.register(Registries.BLOCK, key, factory.apply(settings));
    }

    public static void register() {
        Aetherklang.LOGGER.debug("Registered {} Aetherklang blocks", 11);
    }
}
