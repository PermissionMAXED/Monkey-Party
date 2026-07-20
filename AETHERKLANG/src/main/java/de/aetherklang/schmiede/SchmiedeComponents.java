package de.aetherklang.schmiede;

import de.aetherklang.Aetherklang;
import net.minecraft.component.ComponentType;
import net.minecraft.item.ItemStack;
import net.minecraft.network.codec.PacketCodecs;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;

/**
 * Persistent, network-synchronized item components written by the Klangamboss.
 */
public final class SchmiedeComponents {
    public static final ComponentType<Klangstufe> KLANGSTUFE = Registry.register(
            Registries.DATA_COMPONENT_TYPE,
            Aetherklang.id("klangstufe"),
            ComponentType.<Klangstufe>builder()
                    .codec(Klangstufe.CODEC)
                    .packetCodec(PacketCodecs.STRING.xmap(Klangstufe::fromId, Klangstufe::id))
                    .build()
    );

    public static final ComponentType<ReliktTyp> RELIKT = Registry.register(
            Registries.DATA_COMPONENT_TYPE,
            Aetherklang.id("instrument_relikt"),
            ComponentType.<ReliktTyp>builder()
                    .codec(ReliktTyp.CODEC)
                    .packetCodec(PacketCodecs.STRING.xmap(ReliktTyp::fromId, ReliktTyp::id))
                    .build()
    );

    private SchmiedeComponents() {
    }

    public static Klangstufe getTier(ItemStack stack) {
        return stack.getOrDefault(KLANGSTUFE, Klangstufe.BASIS);
    }

    public static void register() {
        Aetherklang.LOGGER.debug("Registered Klangschmiede item components");
    }
}
