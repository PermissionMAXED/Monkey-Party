package de.aetherklang.block;

import com.mojang.serialization.MapCodec;
import net.minecraft.block.Block;

/**
 * Crescendo contract stub for the luminous Tonarium lantern.
 */
public final class KlanglaterneBlock extends Block {
    public static final MapCodec<KlanglaterneBlock> CODEC = createCodec(KlanglaterneBlock::new);

    public KlanglaterneBlock(Settings settings) {
        super(settings);
    }

    @Override
    protected MapCodec<? extends KlanglaterneBlock> getCodec() {
        return CODEC;
    }
}
