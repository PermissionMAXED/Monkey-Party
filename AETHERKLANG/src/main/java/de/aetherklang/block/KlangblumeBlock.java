package de.aetherklang.block;

import com.mojang.serialization.MapCodec;
import net.minecraft.block.Block;

/**
 * Crescendo contract stub for resonant Tonarium flora.
 */
public final class KlangblumeBlock extends Block {
    public static final MapCodec<KlangblumeBlock> CODEC = createCodec(KlangblumeBlock::new);

    public KlangblumeBlock(Settings settings) {
        super(settings);
    }

    @Override
    protected MapCodec<? extends KlangblumeBlock> getCodec() {
        return CODEC;
    }
}
