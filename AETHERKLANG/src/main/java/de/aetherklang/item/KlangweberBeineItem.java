package de.aetherklang.item;

import net.minecraft.item.Item;

/**
 * Makes the GOOD timing window slightly more forgiving.
 */
public final class KlangweberBeineItem extends Item {
    public static final float GOOD_WINDOW_BONUS = 0.03F;

    public KlangweberBeineItem(Settings settings) {
        super(settings);
    }
}
