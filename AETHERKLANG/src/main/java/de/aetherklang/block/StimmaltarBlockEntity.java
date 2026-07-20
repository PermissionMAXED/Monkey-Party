package de.aetherklang.block;

import de.aetherklang.registry.ModBlockEntities;
import de.aetherklang.resonance.Stimmung;
import net.minecraft.block.BlockState;
import net.minecraft.block.entity.BlockEntity;
import net.minecraft.storage.ReadView;
import net.minecraft.storage.WriteView;
import net.minecraft.util.math.BlockPos;

/**
 * Persists the mood selected on a Stimmaltar.
 */
public final class StimmaltarBlockEntity extends BlockEntity {
    private static final String MOOD_KEY = "selected_stimmung";

    private Stimmung selectedMood = Stimmung.STILLE;

    public StimmaltarBlockEntity(BlockPos pos, BlockState state) {
        super(ModBlockEntities.STIMMALTAR, pos, state);
    }

    public Stimmung getSelectedMood() {
        return selectedMood;
    }

    public Stimmung cycleMood(boolean backwards) {
        Stimmung[] moods = Stimmung.values();
        int step = backwards ? moods.length - 1 : 1;
        selectedMood = moods[(selectedMood.ordinal() + step) % moods.length];
        markDirty();
        return selectedMood;
    }

    @Override
    protected void readData(ReadView view) {
        super.readData(view);
        selectedMood = Stimmung.fromId(view.getString(MOOD_KEY, Stimmung.STILLE.asString()));
    }

    @Override
    protected void writeData(WriteView view) {
        super.writeData(view);
        view.putString(MOOD_KEY, selectedMood.asString());
    }
}
