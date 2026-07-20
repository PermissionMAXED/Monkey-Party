package de.aetherklang.motiv;

import de.aetherklang.data.ContentCatalog;
import de.aetherklang.data.schema.MobDef;
import java.util.List;
import net.minecraft.util.math.random.Random;

/**
 * Resolves tracked Motiv variant ids against the immutable Sinfonie catalog.
 */
public final class MotivEngine {
    private MotivEngine() {
    }

    public static MotivVariantDef randomVariant(String archetype, Random random) {
        List<MotivVariantDef> variants = variants(archetype);
        return variants.get(random.nextInt(variants.size()));
    }

    public static MotivVariantDef variant(String archetype, String variantId) {
        List<MotivVariantDef> variants = variants(archetype);
        return variants.stream()
                .filter(variant -> variant.id().equals(variantId))
                .findFirst()
                .orElse(variants.getFirst());
    }

    public static List<MotivVariantDef> variants(String archetype) {
        return ContentCatalog.current().mobs().values().stream()
                .filter(definition -> definition.archetype().equals(archetype))
                .map(MobDef::variants)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "No Motiv variants loaded for archetype '" + archetype + "'"
                ));
    }
}
