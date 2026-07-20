package de.aetherklang.insel;

import java.util.Objects;
import net.minecraft.util.math.BlockPos;

/**
 * Complete, deterministic input for one floating island.
 */
public record InselParameter(
        BlockPos mitte,
        int radiusX,
        int radiusZ,
        int tiefe,
        InselArchetyp archetyp,
        long formSeed
) {
    public InselParameter {
        Objects.requireNonNull(mitte, "mitte");
        Objects.requireNonNull(archetyp, "archetyp");
        if (radiusX < 5 || radiusZ < 5) {
            throw new IllegalArgumentException("Inselradien muessen mindestens 5 Bloecke betragen");
        }
        if (tiefe < 4) {
            throw new IllegalArgumentException("Inseltiefe muss mindestens 4 Bloecke betragen");
        }
    }
}
