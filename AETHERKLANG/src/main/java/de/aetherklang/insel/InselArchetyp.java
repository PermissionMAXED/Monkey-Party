package de.aetherklang.insel;

import de.aetherklang.registry.ModBlocks;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;

/**
 * Material and landmark families used by the procedural Klangmeer composer.
 */
public enum InselArchetyp {
    BASSGEWOELBE,
    ARPEGGIEN_GARTEN,
    KAKOPHONIE_RIFF,
    KRISTALLKRANZ,
    RESONANZHAIN,
    GENERALPAUSE_SCHOLLE,
    ECHO_TERRASSEN,
    TAKT_RONDELL,
    CRESCENDO_SPITZE,
    OSTINATO_STEPPE,
    LEGATO_HAIN,
    STACCATO_KLIPPEN,
    FERMATE_SANKTUARIUM,
    POLYRHYTHMUS_RIFF,
    NOCTURNE_ATOLL,
    KADENZ_BASTION;

    BlockState surface(int tone) {
        return switch (this) {
            case BASSGEWOELBE -> tone < 2
                    ? ModBlocks.BASSSCHIEFER_POLIERT.getDefaultState()
                    : ModBlocks.BASSSCHIEFER.getDefaultState();
            case ARPEGGIEN_GARTEN -> tone == 0
                    ? Blocks.CALCITE.getDefaultState()
                    : Blocks.MOSS_BLOCK.getDefaultState();
            case KAKOPHONIE_RIFF -> tone < 2
                    ? Blocks.MAGMA_BLOCK.getDefaultState()
                    : Blocks.POLISHED_BLACKSTONE.getDefaultState();
            case KRISTALLKRANZ -> tone < 2
                    ? Blocks.AMETHYST_BLOCK.getDefaultState()
                    : Blocks.CALCITE.getDefaultState();
            case RESONANZHAIN -> tone == 0
                    ? ModBlocks.RESONANZHOLZ_PLANKEN.getDefaultState()
                    : Blocks.MOSS_BLOCK.getDefaultState();
            case GENERALPAUSE_SCHOLLE -> tone == 0
                    ? Blocks.WHITE_CONCRETE.getDefaultState()
                    : Blocks.SMOOTH_BASALT.getDefaultState();
            case ECHO_TERRASSEN -> tone < 2
                    ? Blocks.PURPUR_BLOCK.getDefaultState()
                    : Blocks.END_STONE_BRICKS.getDefaultState();
            case TAKT_RONDELL -> tone < 2
                    ? Blocks.GOLD_BLOCK.getDefaultState()
                    : Blocks.POLISHED_BLACKSTONE_BRICKS.getDefaultState();
            case CRESCENDO_SPITZE -> tone < 2
                    ? Blocks.QUARTZ_BRICKS.getDefaultState()
                    : Blocks.GOLD_BLOCK.getDefaultState();
            case OSTINATO_STEPPE -> tone == 0
                    ? Blocks.POLISHED_DEEPSLATE.getDefaultState()
                    : Blocks.NOTE_BLOCK.getDefaultState();
            case LEGATO_HAIN -> tone < 2
                    ? Blocks.MOSS_BLOCK.getDefaultState()
                    : Blocks.CLAY.getDefaultState();
            case STACCATO_KLIPPEN -> tone < 2
                    ? Blocks.COBBLED_DEEPSLATE.getDefaultState()
                    : Blocks.POLISHED_ANDESITE.getDefaultState();
            case FERMATE_SANKTUARIUM -> tone == 0
                    ? Blocks.SMOOTH_QUARTZ.getDefaultState()
                    : Blocks.PURPUR_BLOCK.getDefaultState();
            case POLYRHYTHMUS_RIFF -> tone < 2
                    ? Blocks.PRISMARINE.getDefaultState()
                    : Blocks.DARK_PRISMARINE.getDefaultState();
            case NOCTURNE_ATOLL -> tone < 2
                    ? Blocks.SCULK.getDefaultState()
                    : Blocks.BLUE_TERRACOTTA.getDefaultState();
            case KADENZ_BASTION -> tone == 0
                    ? Blocks.CUT_COPPER.getDefaultState()
                    : Blocks.POLISHED_BLACKSTONE_BRICKS.getDefaultState();
        };
    }

    BlockState body(int layer, int tone) {
        return switch (this) {
            case BASSGEWOELBE -> layer % 3 == 0
                    ? ModBlocks.BASSSCHIEFER_ZIEGEL.getDefaultState()
                    : Blocks.DEEPSLATE.getDefaultState();
            case ARPEGGIEN_GARTEN, RESONANZHAIN -> tone == 0
                    ? Blocks.ROOTED_DIRT.getDefaultState()
                    : Blocks.END_STONE.getDefaultState();
            case KAKOPHONIE_RIFF -> tone == 0
                    ? Blocks.CRYING_OBSIDIAN.getDefaultState()
                    : Blocks.BLACKSTONE.getDefaultState();
            case KRISTALLKRANZ -> tone == 0
                    ? Blocks.BUDDING_AMETHYST.getDefaultState()
                    : Blocks.OBSIDIAN.getDefaultState();
            case GENERALPAUSE_SCHOLLE -> tone == 0
                    ? Blocks.CALCITE.getDefaultState()
                    : Blocks.BASALT.getDefaultState();
            case ECHO_TERRASSEN -> layer % 3 == 0
                    ? Blocks.PURPUR_PILLAR.getDefaultState()
                    : Blocks.END_STONE.getDefaultState();
            case TAKT_RONDELL -> tone == 0
                    ? Blocks.GILDED_BLACKSTONE.getDefaultState()
                    : Blocks.OBSIDIAN.getDefaultState();
            case CRESCENDO_SPITZE -> layer % 3 == 0
                    ? Blocks.CALCITE.getDefaultState()
                    : Blocks.QUARTZ_BLOCK.getDefaultState();
            case OSTINATO_STEPPE -> tone == 0
                    ? Blocks.DEEPSLATE.getDefaultState()
                    : Blocks.BLACKSTONE.getDefaultState();
            case LEGATO_HAIN -> tone == 0
                    ? Blocks.ROOTED_DIRT.getDefaultState()
                    : Blocks.END_STONE.getDefaultState();
            case STACCATO_KLIPPEN -> layer % 3 == 0
                    ? Blocks.TUFF.getDefaultState()
                    : Blocks.STONE.getDefaultState();
            case FERMATE_SANKTUARIUM -> tone == 0
                    ? Blocks.CALCITE.getDefaultState()
                    : Blocks.END_STONE_BRICKS.getDefaultState();
            case POLYRHYTHMUS_RIFF -> layer % 3 == 0
                    ? Blocks.PRISMARINE_BRICKS.getDefaultState()
                    : Blocks.PRISMARINE.getDefaultState();
            case NOCTURNE_ATOLL -> tone == 0
                    ? Blocks.DEEPSLATE.getDefaultState()
                    : Blocks.OBSIDIAN.getDefaultState();
            case KADENZ_BASTION -> layer % 3 == 0
                    ? Blocks.TUFF_BRICKS.getDefaultState()
                    : Blocks.POLISHED_BLACKSTONE.getDefaultState();
        };
    }
}
