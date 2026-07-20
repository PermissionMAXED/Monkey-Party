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
    TAKT_RONDELL;

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
        };
    }
}
