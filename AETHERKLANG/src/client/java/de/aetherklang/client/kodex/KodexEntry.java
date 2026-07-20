package de.aetherklang.client.kodex;

import java.util.List;
import net.minecraft.text.Text;

public record KodexEntry(
        String id,
        KodexCategory category,
        String titleKey,
        String subtitleKey,
        List<String> bodyKeys,
        boolean alwaysUnlocked,
        KodexStatus status
) {
    public Text title() {
        return Text.translatable(titleKey);
    }

    public Text subtitle() {
        return Text.translatable(subtitleKey);
    }
}
