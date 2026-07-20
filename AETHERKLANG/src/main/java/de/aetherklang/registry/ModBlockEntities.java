package de.aetherklang.registry;

import de.aetherklang.Aetherklang;
import de.aetherklang.block.StimmaltarBlockEntity;
import net.fabricmc.fabric.api.object.builder.v1.block.entity.FabricBlockEntityTypeBuilder;
import net.minecraft.block.entity.BlockEntityType;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;

public final class ModBlockEntities {
    public static final String STIMMALTAR_ID = ModBlocks.STIMMALTAR_ID;
    public static final BlockEntityType<StimmaltarBlockEntity> STIMMALTAR = Registry.register(
            Registries.BLOCK_ENTITY_TYPE,
            Aetherklang.id(STIMMALTAR_ID),
            FabricBlockEntityTypeBuilder.create(StimmaltarBlockEntity::new, ModBlocks.STIMMALTAR).build()
    );

    private ModBlockEntities() {
    }

    public static void register() {
        Aetherklang.LOGGER.debug("Registered block entity aetherklang:{}", STIMMALTAR_ID);
    }
}
