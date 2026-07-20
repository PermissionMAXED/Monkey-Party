package de.aetherklang.motiv;

import de.aetherklang.data.ContentCatalog;
import de.aetherklang.klangwerk.KlangwerkReloadDef;
import de.aetherklang.klangwerk.KlangwerkType;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import net.minecraft.particle.SimpleParticleType;
import net.minecraft.registry.Registries;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.random.Random;

/**
 * Resolves weighted elite affixes from the reloadable Klangwerk catalog.
 */
public final class MotivAffixEngine {
    private static final int NATURAL_ELITE_CHANCE = 4;

    private MotivAffixEngine() {
    }

    public static String roll(Random random, boolean guaranteed) {
        List<KlangwerkReloadDef> affixes = eliteAffixes();
        if (affixes.isEmpty() || (!guaranteed && random.nextInt(NATURAL_ELITE_CHANCE) != 0)) {
            return "";
        }

        int totalWeight = affixes.stream().mapToInt(MotivAffixEngine::weight).sum();
        int choice = random.nextInt(totalWeight);
        for (KlangwerkReloadDef affix : affixes) {
            choice -= weight(affix);
            if (choice < 0) {
                return affix.id();
            }
        }
        return affixes.getLast().id();
    }

    public static Optional<KlangwerkReloadDef> get(String id) {
        if (id == null || id.isEmpty()) {
            return Optional.empty();
        }
        return Optional.ofNullable(ContentCatalog.current().klangwerk(KlangwerkType.AFFIX).get(id));
    }

    public static double modifier(KlangwerkReloadDef affix) {
        return parseDouble(affix.parameters().get("modifier"), 0.0D);
    }

    public static String attribute(KlangwerkReloadDef affix) {
        return affix.parameters().getOrDefault("attribute", "");
    }

    public static Optional<SimpleParticleType> particle(KlangwerkReloadDef affix) {
        Identifier id = Identifier.tryParse(affix.parameters().getOrDefault("particle", ""));
        if (id == null) {
            return Optional.empty();
        }
        return Registries.PARTICLE_TYPE.getOptionalValue(id)
                .filter(SimpleParticleType.class::isInstance)
                .map(SimpleParticleType.class::cast);
    }

    private static List<KlangwerkReloadDef> eliteAffixes() {
        return ContentCatalog.current().klangwerk(KlangwerkType.AFFIX).values().stream()
                .filter(affix -> Boolean.parseBoolean(affix.parameters().getOrDefault("elite", "false")))
                .filter(affix -> weight(affix) > 0)
                .sorted(Comparator.comparing(KlangwerkReloadDef::id))
                .toList();
    }

    private static int weight(KlangwerkReloadDef affix) {
        try {
            return Math.max(1, Integer.parseInt(affix.parameters().getOrDefault("weight", "1")));
        } catch (NumberFormatException ignored) {
            return 1;
        }
    }

    private static double parseDouble(String value, double fallback) {
        if (value == null) {
            return fallback;
        }
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }
}
