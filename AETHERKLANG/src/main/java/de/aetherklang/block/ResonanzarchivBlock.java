package de.aetherklang.block;

import com.mojang.serialization.MapCodec;
import net.minecraft.block.Block;

/**
 * Crescendo contract stub for the Tonarium resonance archive.
 */
public final class ResonanzarchivBlock extends Block {
    public static final MapCodec<ResonanzarchivBlock> CODEC = createCodec(ResonanzarchivBlock::new);

    public ResonanzarchivBlock(Settings settings) {
        super(settings);
    }

    @Override
    protected MapCodec<? extends ResonanzarchivBlock> getCodec() {
        return CODEC;
    }
}
