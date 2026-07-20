package de.aetherklang.partitur;

import de.aetherklang.klangwerk.KlangwerkReloadDef;
import de.aetherklang.klangwerk.KlangwerkType;
import java.util.Map;
import java.util.Set;
import net.minecraft.util.Identifier;

/**
 * Validated gameplay view of a Klangwerk {@code auftrag} definition.
 */
public record AuftragDef(
        String id,
        String titleKey,
        String descriptionKey,
        AuftragObjective objective,
        String target,
        int amount,
        int rewardRp,
        int rewardNotenschluessel,
        Identifier rewardMaterial,
        int rewardMaterialCount
) {
    private static final Set<String> PARAMETERS = Set.of(
            "title",
            "description",
            "objective",
            "target",
            "amount",
            "reward_rp",
            "reward_notenschluessel",
            "reward_material",
            "reward_material_count"
    );

    public AuftragDef {
        requireId(id);
        requireTranslationKey(titleKey, "title", id);
        requireTranslationKey(descriptionKey, "description", id);
        if (objective == null) {
            throw invalid(id, "objective is required");
        }
        if (target == null || target.isBlank()) {
            throw invalid(id, "target must not be blank");
        }
        if (amount < 1 || amount > 10_000) {
            throw invalid(id, "amount must be between 1 and 10000");
        }
        if (rewardRp < 0 || rewardRp > 1_000) {
            throw invalid(id, "reward_rp must be between 0 and 1000");
        }
        if (rewardNotenschluessel < 0 || rewardNotenschluessel > 64) {
            throw invalid(id, "reward_notenschluessel must be between 0 and 64");
        }
        if (rewardMaterialCount < 0 || rewardMaterialCount > 64) {
            throw invalid(id, "reward_material_count must be between 0 and 64");
        }
        if ((rewardMaterial == null) != (rewardMaterialCount == 0)) {
            throw invalid(id, "reward_material and its positive count must be supplied together");
        }
        if (rewardRp == 0 && rewardNotenschluessel == 0 && rewardMaterialCount == 0) {
            throw invalid(id, "at least one reward is required");
        }
    }

    public static AuftragDef fromReloadDef(KlangwerkReloadDef raw) {
        if (raw.type() != KlangwerkType.AUFTRAG) {
            throw invalid(raw.id(), "type must be 'auftrag'");
        }

        Map<String, String> parameters = raw.parameters();
        for (String parameter : parameters.keySet()) {
            if (!PARAMETERS.contains(parameter)) {
                throw invalid(raw.id(), "unknown parameter '" + parameter + "'");
            }
        }

        int materialCount = integer(parameters, "reward_material_count", 0, raw.id());
        String materialValue = parameters.get("reward_material");
        Identifier material = materialValue == null || materialValue.isBlank()
                ? null
                : Identifier.tryParse(materialValue);
        if (materialValue != null && material == null) {
            throw invalid(raw.id(), "invalid reward_material '" + materialValue + "'");
        }

        return new AuftragDef(
                raw.id(),
                required(parameters, "title", raw.id()),
                required(parameters, "description", raw.id()),
                AuftragObjective.fromString(required(parameters, "objective", raw.id())),
                required(parameters, "target", raw.id()),
                integer(parameters, "amount", -1, raw.id()),
                integer(parameters, "reward_rp", 0, raw.id()),
                integer(parameters, "reward_notenschluessel", 0, raw.id()),
                material,
                materialCount
        );
    }

    public boolean matches(AuftragObjective action, String actionTarget) {
        return objective == action && ("any".equals(target) || target.equals(actionTarget));
    }

    private static String required(Map<String, String> parameters, String key, String id) {
        String value = parameters.get(key);
        if (value == null || value.isBlank()) {
            throw invalid(id, "missing parameter '" + key + "'");
        }
        return value;
    }

    private static int integer(Map<String, String> parameters, String key, int fallback, String id) {
        String value = parameters.get(key);
        if (value == null) {
            return fallback;
        }
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException exception) {
            throw invalid(id, "parameter '" + key + "' must be an integer");
        }
    }

    private static void requireId(String id) {
        if (id == null || id.isBlank() || !id.matches("[a-z0-9_./-]+")) {
            throw invalid(String.valueOf(id), "id must be a lower-case namespaceless path");
        }
    }

    private static void requireTranslationKey(String value, String field, String id) {
        if (value == null || value.isBlank() || value.indexOf(' ') >= 0) {
            throw invalid(id, field + " must be a translation key");
        }
    }

    private static IllegalArgumentException invalid(String id, String message) {
        return new IllegalArgumentException("Invalid Partitur contract '" + id + "': " + message);
    }
}
