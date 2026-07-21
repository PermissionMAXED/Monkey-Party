package de.aetherklang.echographie;

import de.aetherklang.Aetherklang;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.SpawnGroup;
import net.minecraft.item.Item;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.RegistryKeys;

/**
 * Registry and lifecycle entry point for the Echographie feature.
 */
public final class Echographie {
    public static final String ECHO_CYLINDER_ID = "echozylinder";
    public static final String ECHO_ID = "echo";

    public static final EntityType<EchoEntity> ECHO = registerEcho();
    public static final Item ECHO_CYLINDER = registerCylinder();

    private Echographie() {
    }

    public static void register() {
        EchoCylinderService.register();
        Aetherklang.LOGGER.debug("Registered Echographie Echo Cylinder and ghost replay");
    }

    private static EntityType<EchoEntity> registerEcho() {
        RegistryKey<EntityType<?>> key =
                RegistryKey.of(RegistryKeys.ENTITY_TYPE, Aetherklang.id(ECHO_ID));
        EntityType<EchoEntity> type = EntityType.Builder
                .create(EchoEntity::new, SpawnGroup.MISC)
                .dimensions(0.6F, 1.8F)
                .maxTrackingRange(12)
                .trackingTickInterval(1)
                .dropsNothing()
                .build(key);
        return Registry.register(Registries.ENTITY_TYPE, key, type);
    }

    private static Item registerCylinder() {
        RegistryKey<Item> key =
                RegistryKey.of(RegistryKeys.ITEM, Aetherklang.id(ECHO_CYLINDER_ID));
        Item.Settings settings = new Item.Settings().maxCount(1).registryKey(key);
        return Registry.register(Registries.ITEM, key, new EchoCylinderItem(settings));
    }
}
