package de.aetherklang.komposition;

import de.aetherklang.Aetherklang;
import net.minecraft.component.ComponentType;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;

/**
 * Persistent and network-synchronized data written on composed scrolls.
 */
public final class KompositionComponents {
    public static final ComponentType<Zauberpartitur> ZAUBERPARTITUR = Registry.register(
            Registries.DATA_COMPONENT_TYPE,
            Aetherklang.id("zauberpartitur"),
            ComponentType.<Zauberpartitur>builder()
                    .codec(Zauberpartitur.CODEC)
                    .packetCodec(Zauberpartitur.PACKET_CODEC)
                    .build()
    );

    private KompositionComponents() {
    }
}
