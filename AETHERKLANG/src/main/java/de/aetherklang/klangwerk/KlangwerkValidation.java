package de.aetherklang.klangwerk;

import de.aetherklang.Aetherklang;
import java.util.Map;
import net.minecraft.util.Identifier;

public final class KlangwerkValidation {
    private KlangwerkValidation() {
    }

    public static void validate(
            KlangwerkReloadDef definition,
            KlangwerkType pathType,
            String fileId,
            Identifier resourceId
    ) {
        require(
                definition.type() == pathType,
                resourceId + " declares type '" + definition.type().asString()
                        + "' but is stored in '" + pathType.asString() + "'"
        );
        require(
                definition.id().equals(fileId),
                resourceId + " declares id '" + definition.id()
                        + "' but its file name is '" + fileId + ".json'"
        );

        Identifier parsed = Identifier.tryParse(Aetherklang.MOD_ID + ":" + definition.id());
        require(
                parsed != null && !definition.id().contains(":") && !definition.id().contains("/"),
                resourceId + " has invalid namespaceless id '" + definition.id() + "'"
        );

        for (Map.Entry<String, String> parameter : definition.parameters().entrySet()) {
            require(
                    parameter.getKey() != null && !parameter.getKey().isBlank(),
                    resourceId + " has a blank parameter key"
            );
            require(
                    parameter.getValue() != null && !parameter.getValue().isBlank(),
                    resourceId + " has a blank value for parameter '" + parameter.getKey() + "'"
            );
        }
    }

    private static void require(boolean condition, String message) {
        if (!condition) {
            throw new IllegalArgumentException("Invalid Klangwerk JSON " + message);
        }
    }
}
