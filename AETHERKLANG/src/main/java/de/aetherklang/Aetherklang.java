package de.aetherklang;

import de.aetherklang.bosswerk.Bosswerk;
import de.aetherklang.bosswerk.ChoralRepriseService;
import de.aetherklang.command.ModCommands;
import de.aetherklang.crescendo.CrescendoServerHooks;
import de.aetherklang.dirigent.DirigentService;
import de.aetherklang.echographie.Echographie;
import de.aetherklang.kaskade.KaskadeHooks;
import de.aetherklang.kanon.KanonEngine;
import de.aetherklang.klangbahn.Klangbahn;
import de.aetherklang.klangwerk.KlangwerkLoader;
import de.aetherklang.leitmotiv.LeitmotivService;
import de.aetherklang.network.ModNetworking;
import de.aetherklang.partitur.PartiturNetworking;
import de.aetherklang.partitur.PartiturService;
import de.aetherklang.registry.ContentBootstrap;
import de.aetherklang.registry.ModAttachments;
import de.aetherklang.registry.ModBlockEntities;
import de.aetherklang.registry.ModBlocks;
import de.aetherklang.registry.ModCriteria;
import de.aetherklang.registry.ModEntities;
import de.aetherklang.registry.ModItemGroups;
import de.aetherklang.registry.ModItems;
import de.aetherklang.registry.ModParticles;
import de.aetherklang.registry.ModPayloads;
import de.aetherklang.registry.ModSounds;
import de.aetherklang.resonanzfeld.Resonanzfeld;
import de.aetherklang.resonance.BeatEngine;
import de.aetherklang.sturmfront.SturmfrontEngine;
import de.aetherklang.world.KammertonWorld;
import de.aetherklang.schmiede.SchmiedeComponents;
import de.aetherklang.schmiede.SchmiedeRezepte;
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
        SchmiedeComponents.register();
        ModBlocks.register();
        ModItems.register();
        Echographie.register();
        ModItemGroups.register();
        Klangbahn.register();
        ModBlockEntities.register();
        ModEntities.register();
        ContentBootstrap.register();
        KlangwerkLoader.register();
        SchmiedeRezepte.register();
        ModParticles.register();
        ModSounds.register();
        Bosswerk.register();
        ChoralRepriseService.register();
        ModAttachments.register();
        LeitmotivService.register();
        ModCriteria.register();
        ModPayloads.register();
        PartiturNetworking.register();
        ModNetworking.register();
        DirigentService.register();
        ModCommands.register();
        BeatEngine.register();
        KanonEngine.register();
        KammertonWorld.register();
        CrescendoServerHooks.register();
        KaskadeHooks.register();
        Resonanzfeld.register();
        SturmfrontEngine.register();
        PartiturService.register();

        LOGGER.info("Aetherklang registriert: Die Welt hat eine Stimme.");
    }
}
