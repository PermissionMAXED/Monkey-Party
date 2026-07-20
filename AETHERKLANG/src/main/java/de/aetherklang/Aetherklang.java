package de.aetherklang;

import de.aetherklang.command.ModCommands;
import de.aetherklang.network.ModNetworking;
import de.aetherklang.registry.ModAttachments;
import de.aetherklang.registry.ModBlockEntities;
import de.aetherklang.registry.ModBlocks;
import de.aetherklang.registry.ModEntities;
import de.aetherklang.registry.ModItemGroups;
import de.aetherklang.registry.ModItems;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModPayloads;
import de.aetherklang.registry.ModSounds;
import net.fabricmc.api.ModInitializer;
import net.minecraft.util.Identifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class Aetherklang implements ModInitializer {
    public static final String MOD_ID = "aetherklang";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    public static Identifier id(String path) {
        return Identifier.of(MOD_ID, path);
    }

    @Override
    public void onInitialize() {
        ModBlocks.register();
        ModItems.register();
        ModItemGroups.register();
        ModBlockEntities.register();
        ModEntities.register();
        ModParticles.register();
        ModSounds.register();
        ModAttachments.register();
        ModPayloads.register();
        ModNetworking.register();
        ModCommands.register();

        LOGGER.info("Aetherklang registriert: Die Welt hat eine Stimme.");
    }
}
