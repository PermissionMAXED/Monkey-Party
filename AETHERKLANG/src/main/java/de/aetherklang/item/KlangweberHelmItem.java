package de.aetherklang.item;

import net.minecraft.item.Item;

/**
 * Marks nearby sources of resonance through the client-side Klangweber aura.
 */
public final class KlangweberHelmItem extends Item {
    public static final int MARKER_HORIZONTAL_RANGE = 12;
    public static final int MARKER_VERTICAL_RANGE = 6;

    public KlangweberHelmItem(Settings settings) {
        super(settings);
    }
}
