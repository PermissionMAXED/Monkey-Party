package de.aetherklang.insel;

import java.util.Arrays;
import java.util.Optional;
import net.minecraft.util.math.BlockPos;

/**
 * Stable regional integration anchors in the outer Klangmeer.
 */
public enum KlangmeerRegion {
    BASSGEWOELBE(
            "bassgewoelbe",
            "Bassgewölbe",
            new BlockPos(-900, 129, 0),
            InselArchetyp.BASSGEWOELBE
    ),
    ARPEGGIENMEER(
            "arpeggienmeer",
            "Arpeggienmeer",
            new BlockPos(900, 129, 0),
            InselArchetyp.ARPEGGIEN_GARTEN
    ),
    KAKOPHONIE_RIFF(
            "kakophonie_riff",
            "Kakophonie-Riff",
            new BlockPos(0, 129, 900),
            InselArchetyp.KAKOPHONIE_RIFF
    ),
    GENERALPAUSE_OEDE(
            "generalpause_oede",
            "Generalpause-Öde",
            new BlockPos(0, 129, 1600),
            InselArchetyp.GENERALPAUSE_SCHOLLE
    ),
    FERMATENRING(
            "fermatenring",
            "Fermatenring",
            new BlockPos(0, 129, -1800),
            InselArchetyp.FERMATE_SANKTUARIUM
    );

    private static final long ENTRY_RADIUS_SQUARED = 420L * 420L;
    private static final long FERMATENRING_RADIUS_SQUARED = 720L * 720L;
    private static final long INNER_BELT_MIN_SQUARED = 560L * 560L;
    private static final long INNER_BELT_MAX_SQUARED = 1100L * 1100L;
    private static final long OUTER_BELT_MIN_SQUARED = 1300L * 1300L;
    private static final long OUTER_BELT_MAX_SQUARED = 2100L * 2100L;

    private final String id;
    private final String anzeigename;
    private final BlockPos anker;
    private final InselArchetyp archetyp;

    KlangmeerRegion(String id, String anzeigename, BlockPos anker, InselArchetyp archetyp) {
        this.id = id;
        this.anzeigename = anzeigename;
        this.anker = anker;
        this.archetyp = archetyp;
    }

    public String id() {
        return id;
    }

    public String anzeigename() {
        return anzeigename;
    }

    public BlockPos anker() {
        return anker;
    }

    public InselArchetyp archetyp() {
        return archetyp;
    }

    public BlockPos marker() {
        return anker.down(18);
    }

    public static Optional<KlangmeerRegion> at(BlockPos position) {
        KlangmeerRegion nearest = null;
        long nearestDistance = Long.MAX_VALUE;
        for (KlangmeerRegion region : values()) {
            long deltaX = position.getX() - region.anker.getX();
            long deltaZ = position.getZ() - region.anker.getZ();
            long distance = deltaX * deltaX + deltaZ * deltaZ;
            long radius = region == FERMATENRING
                    ? FERMATENRING_RADIUS_SQUARED
                    : ENTRY_RADIUS_SQUARED;
            if (distance <= radius && distance < nearestDistance) {
                nearest = region;
                nearestDistance = distance;
            }
        }
        return Optional.ofNullable(nearest);
    }

    public static boolean allowsMotivSpawn(BlockPos position) {
        if (at(position).isPresent()) {
            return true;
        }
        long deltaX = position.getX();
        long deltaZ = position.getZ();
        long distance = deltaX * deltaX + deltaZ * deltaZ;
        return (distance >= INNER_BELT_MIN_SQUARED && distance <= INNER_BELT_MAX_SQUARED)
                || (distance >= OUTER_BELT_MIN_SQUARED && distance <= OUTER_BELT_MAX_SQUARED);
    }

    public static Optional<KlangmeerRegion> byId(String id) {
        return Arrays.stream(values()).filter(region -> region.id.equals(id)).findFirst();
    }
}
