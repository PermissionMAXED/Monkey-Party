package de.aetherklang.registry;

import de.aetherklang.Aetherklang;
import de.aetherklang.block.DissonanzrissBlock;
import de.aetherklang.block.DissonanzankerBlock;
import de.aetherklang.block.GlockenspielPortalBlock;
import de.aetherklang.block.KristallresonatorBlock;
import de.aetherklang.block.KlangblumeBlock;
import de.aetherklang.block.KlanglaterneBlock;
import de.aetherklang.block.MetronomBlock;
import de.aetherklang.block.ResonanceCrystalBlock;
import de.aetherklang.block.ResonanzarchivBlock;
import de.aetherklang.block.StimmaltarBlock;
import de.aetherklang.block.StimmpfeilerBlock;
import de.aetherklang.block.TaktbrueckeBlock;
import de.aetherklang.partitur.NotenpultBlock;
import de.aetherklang.schmiede.KlangambossBlock;
import java.util.function.Function;
import net.minecraft.block.AbstractBlock;
import net.minecraft.block.Block;
import net.minecraft.block.SlabBlock;
import net.minecraft.block.StairsBlock;
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
    public static final String NOTENPULT_ID = "notenpult";
    public static final String KLANGAMBOSS_ID = "klangamboss";
    public static final String STIMMPFEILER_ID = "stimmpfeiler";
    public static final String METRONOMBLOCK_ID = "metronomblock";
    public static final String DISSONANZANKER_ID = "dissonanzanker";
    public static final String KRISTALLRESONATOR_ID = "kristallresonator";
    public static final String BASSSCHIEFER_ID = "bassschiefer";
    public static final String BASSSCHIEFER_POLIERT_ID = "bassschiefer_poliert";
    public static final String BASSSCHIEFER_ZIEGEL_ID = "bassschiefer_ziegel";
    public static final String BASSSCHIEFER_TREPPE_ID = "bassschiefer_treppe";
    public static final String BASSSCHIEFER_STUFE_ID = "bassschiefer_stufe";
    public static final String ARPEGGIENQUARZIT_ID = "arpeggienquarzit";
    public static final String ARPEGGIENQUARZIT_POLIERT_ID = "arpeggienquarzit_poliert";
    public static final String ARPEGGIENQUARZIT_ZIEGEL_ID = "arpeggienquarzit_ziegel";
    public static final String RIFFBASALT_ID = "riffbasalt";
    public static final String RIFFBASALT_POLIERT_ID = "riffbasalt_poliert";
    public static final String RIFFBASALT_ZIEGEL_ID = "riffbasalt_ziegel";
    public static final String RESONANZHOLZ_ID = "resonanzholz";
    public static final String RESONANZHOLZ_PLANKEN_ID = "resonanzholz_planken";
    public static final String RESONANZHOLZ_TREPPE_ID = "resonanzholz_treppe";
    public static final String RESONANZHOLZ_STUFE_ID = "resonanzholz_stufe";

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
                    .luminance(KlanglaterneBlock::getLightLevel)
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
    public static final NotenpultBlock NOTENPULT = register(
            NOTENPULT_ID,
            NotenpultBlock::new,
            settings -> settings
                    .mapColor(DyeColor.PURPLE)
                    .strength(2.5F, 8.0F)
                    .sounds(BlockSoundGroup.CHISELED_BOOKSHELF)
                    .luminance(state -> 3)
                    .requiresTool()
    );
    public static final KlangambossBlock KLANGAMBOSS = register(
            KLANGAMBOSS_ID,
            KlangambossBlock::new,
            settings -> settings
                    .mapColor(DyeColor.BLACK)
                    .strength(5.0F, 8.0F)
                    .sounds(BlockSoundGroup.ANVIL)
                    .requiresTool()
    );
    public static final StimmpfeilerBlock STIMMPFEILER = register(
            STIMMPFEILER_ID,
            StimmpfeilerBlock::new,
            settings -> settings
                    .mapColor(DyeColor.PURPLE)
                    .strength(3.0F, 8.0F)
                    .sounds(BlockSoundGroup.AMETHYST_BLOCK)
                    .luminance(state -> state.get(StimmpfeilerBlock.ATTUNED) ? 9 : 2)
                    .requiresTool()
    );
    public static final MetronomBlock METRONOMBLOCK = register(
            METRONOMBLOCK_ID,
            MetronomBlock::new,
            settings -> settings
                    .mapColor(DyeColor.BROWN)
                    .strength(2.0F, 4.0F)
                    .sounds(BlockSoundGroup.WOOD)
                    .luminance(MetronomBlock::getLightLevel)
    );
    public static final DissonanzankerBlock DISSONANZANKER = register(
            DISSONANZANKER_ID,
            DissonanzankerBlock::new,
            settings -> settings
                    .mapColor(DyeColor.MAGENTA)
                    .strength(4.0F, 12.0F)
                    .sounds(BlockSoundGroup.SCULK)
                    .luminance(DissonanzankerBlock::getLightLevel)
                    .requiresTool()
    );
    public static final KristallresonatorBlock KRISTALLRESONATOR = register(
            KRISTALLRESONATOR_ID,
            KristallresonatorBlock::new,
            settings -> settings
                    .mapColor(DyeColor.CYAN)
                    .strength(2.5F, 8.0F)
                    .sounds(BlockSoundGroup.AMETHYST_BLOCK)
                    .luminance(KristallresonatorBlock::getLightLevel)
                    .requiresTool()
    );
    public static final Block BASSSCHIEFER = registerStone(BASSSCHIEFER_ID, BlockSoundGroup.DEEPSLATE, 3.0F);
    public static final Block BASSSCHIEFER_POLIERT =
            registerStone(BASSSCHIEFER_POLIERT_ID, BlockSoundGroup.POLISHED_DEEPSLATE, 3.2F);
    public static final Block BASSSCHIEFER_ZIEGEL =
            registerStone(BASSSCHIEFER_ZIEGEL_ID, BlockSoundGroup.DEEPSLATE_BRICKS, 3.2F);
    public static final StairsBlock BASSSCHIEFER_TREPPE = register(
            BASSSCHIEFER_TREPPE_ID,
            settings -> new StairsBlock(BASSSCHIEFER_ZIEGEL.getDefaultState(), settings),
            settings -> settings
                    .mapColor(DyeColor.BLACK)
                    .strength(3.2F, 8.0F)
                    .sounds(BlockSoundGroup.DEEPSLATE_BRICKS)
                    .requiresTool()
    );
    public static final SlabBlock BASSSCHIEFER_STUFE = register(
            BASSSCHIEFER_STUFE_ID,
            SlabBlock::new,
            settings -> settings
                    .mapColor(DyeColor.BLACK)
                    .strength(3.2F, 8.0F)
                    .sounds(BlockSoundGroup.DEEPSLATE_BRICKS)
                    .requiresTool()
    );
    public static final Block ARPEGGIENQUARZIT = registerStone(
            ARPEGGIENQUARZIT_ID,
            BlockSoundGroup.CALCITE,
            2.4F,
            DyeColor.WHITE
    );
    public static final Block ARPEGGIENQUARZIT_POLIERT = registerStone(
            ARPEGGIENQUARZIT_POLIERT_ID,
            BlockSoundGroup.CALCITE,
            2.6F,
            DyeColor.WHITE
    );
    public static final Block ARPEGGIENQUARZIT_ZIEGEL = registerStone(
            ARPEGGIENQUARZIT_ZIEGEL_ID,
            BlockSoundGroup.DEEPSLATE_BRICKS,
            2.8F,
            DyeColor.LIGHT_BLUE
    );
    public static final Block RIFFBASALT =
            registerStone(RIFFBASALT_ID, BlockSoundGroup.BASALT, 3.2F, DyeColor.GRAY);
    public static final Block RIFFBASALT_POLIERT =
            registerStone(RIFFBASALT_POLIERT_ID, BlockSoundGroup.BASALT, 3.4F, DyeColor.GRAY);
    public static final Block RIFFBASALT_ZIEGEL =
            registerStone(RIFFBASALT_ZIEGEL_ID, BlockSoundGroup.DEEPSLATE_BRICKS, 3.6F, DyeColor.BLACK);
    public static final Block RESONANZHOLZ = registerWood(RESONANZHOLZ_ID);
    public static final Block RESONANZHOLZ_PLANKEN = registerWood(RESONANZHOLZ_PLANKEN_ID);
    public static final StairsBlock RESONANZHOLZ_TREPPE = register(
            RESONANZHOLZ_TREPPE_ID,
            settings -> new StairsBlock(RESONANZHOLZ_PLANKEN.getDefaultState(), settings),
            settings -> settings
                    .mapColor(DyeColor.PURPLE)
                    .strength(2.0F, 3.0F)
                    .sounds(BlockSoundGroup.WOOD)
    );
    public static final SlabBlock RESONANZHOLZ_STUFE = register(
            RESONANZHOLZ_STUFE_ID,
            SlabBlock::new,
            settings -> settings
                    .mapColor(DyeColor.PURPLE)
                    .strength(2.0F, 3.0F)
                    .sounds(BlockSoundGroup.WOOD)
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

    private static Block registerStone(String path, BlockSoundGroup sounds, float strength) {
        return registerStone(path, sounds, strength, DyeColor.BLACK);
    }

    private static Block registerStone(String path, BlockSoundGroup sounds, float strength, DyeColor color) {
        return register(
                path,
                Block::new,
                settings -> settings
                        .mapColor(color)
                        .strength(strength, 8.0F)
                        .sounds(sounds)
                        .requiresTool()
        );
    }

    private static Block registerWood(String path) {
        return register(
                path,
                Block::new,
                settings -> settings
                        .mapColor(DyeColor.BROWN)
                        .strength(2.0F, 3.0F)
                        .sounds(BlockSoundGroup.WOOD)
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
        Aetherklang.LOGGER.debug("Registered {} Aetherklang blocks", 32);
    }
}
