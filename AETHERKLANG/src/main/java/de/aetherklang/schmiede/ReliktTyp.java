package de.aetherklang.schmiede;

import com.mojang.serialization.Codec;
import java.util.Locale;
import java.util.Optional;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;

/**
 * The six relics accepted by the Klangamboss. An instrument has one socket.
 */
public enum ReliktTyp {
    METRONOM,
    ECHO,
    FERMATE,
    CRESCENDO,
    OSTINATO,
    CADENZ;

    public static final Codec<ReliktTyp> CODEC = Codec.STRING.xmap(
            ReliktTyp::fromId,
            ReliktTyp::id
    );

    public String id() {
        return "relikt_" + name().toLowerCase(Locale.ROOT);
    }

    public String translationKey() {
        return "item.aetherklang." + id();
    }

    public static ReliktTyp fromId(String id) {
        return byId(id).orElseThrow(() -> new IllegalArgumentException("Unknown relic '" + id + "'"));
    }

    public static Optional<ReliktTyp> byId(String id) {
        for (ReliktTyp value : values()) {
            if (value.id().equals(id)) {
                return Optional.of(value);
            }
        }
        return Optional.empty();
    }

    public static Optional<ReliktTyp> fromStack(ItemStack stack) {
        if (stack.isEmpty()) {
            return Optional.empty();
        }
        var id = Registries.ITEM.getId(stack.getItem());
        if (!id.getNamespace().equals("aetherklang")) {
            return Optional.empty();
        }
        return byId(id.getPath());
    }
}
