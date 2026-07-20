package de.aetherklang.block;

import com.mojang.serialization.MapCodec;
import net.minecraft.block.Block;

/**
 * Crescendo contract stub for a beat-controlled bridge segment.
 */
public final class TaktbrueckeBlock extends Block {
    public static final MapCodec<TaktbrueckeBlock> CODEC = createCodec(TaktbrueckeBlock::new);

    public TaktbrueckeBlock(Settings settings) {
        super(settings);
    }

    @Override
    protected MapCodec<? extends TaktbrueckeBlock> getCodec() {
        return CODEC;
    }
}
