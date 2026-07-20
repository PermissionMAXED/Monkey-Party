package de.aetherklang.block;

import com.mojang.serialization.MapCodec;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModSounds;
import java.util.Map;
import java.util.WeakHashMap;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.block.ShapeContext;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityCollisionHandler;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.shape.VoxelShape;
import net.minecraft.util.shape.VoxelShapes;
import net.minecraft.world.BlockView;
import net.minecraft.world.World;

/**
 * Resonant Tonarium flora that answers passing entities with a short chime.
 */
public final class KlangblumeBlock extends Block {
    public static final MapCodec<KlangblumeBlock> CODEC = createCodec(KlangblumeBlock::new);

    private static final VoxelShape OUTLINE = createCuboidShape(2.0D, 0.0D, 2.0D, 14.0D, 14.0D, 14.0D);
    private static final int CHIME_COOLDOWN_TICKS = 30;
    private static final Map<Entity, Long> LAST_CHIME_TICKS = new WeakHashMap<>();

    public KlangblumeBlock(Settings settings) {
        super(settings);
    }

    @Override
    protected MapCodec<? extends KlangblumeBlock> getCodec() {
        return CODEC;
    }

    @Override
    protected VoxelShape getOutlineShape(
            BlockState state,
            BlockView world,
            BlockPos pos,
            ShapeContext context
    ) {
        return OUTLINE;
    }

    @Override
    protected VoxelShape getCollisionShape(
            BlockState state,
            BlockView world,
            BlockPos pos,
            ShapeContext context
    ) {
        return VoxelShapes.empty();
    }

    @Override
    protected void onEntityCollision(
            BlockState state,
            World world,
            BlockPos pos,
            Entity entity,
            EntityCollisionHandler handler
    ) {
        if (!(world instanceof ServerWorld serverWorld) || entity.isSpectator()) {
            return;
        }

        long time = world.getTime();
        Long lastChime = LAST_CHIME_TICKS.get(entity);
        if (lastChime != null && time - lastChime < CHIME_COOLDOWN_TICKS) {
            return;
        }
        LAST_CHIME_TICKS.put(entity, time);

        float pitch = 0.9F + Math.floorMod(pos.asLong(), 7L) * 0.06F;
        serverWorld.spawnParticles(
                ModParticles.NOTE_SPARK,
                pos.getX() + 0.5D,
                pos.getY() + 0.8D,
                pos.getZ() + 0.5D,
                8,
                0.3D,
                0.35D,
                0.3D,
                0.035D
        );
        serverWorld.playSound(
                null,
                pos,
                ModSounds.FERMATE_CHIME,
                SoundCategory.BLOCKS,
                0.55F,
                pitch
        );
    }
}
