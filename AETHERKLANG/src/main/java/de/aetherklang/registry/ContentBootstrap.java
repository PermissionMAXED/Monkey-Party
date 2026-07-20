package de.aetherklang.registry;

import de.aetherklang.Aetherklang;
import de.aetherklang.data.ContentCatalog;
import de.aetherklang.data.ContentLoader;
import de.aetherklang.data.SchemaValidation;

public final class ContentBootstrap {
    private static boolean registered;

    private ContentBootstrap() {
    }

    public static void register() {
        if (registered) {
            return;
        }

        ContentCatalog catalog = ContentLoader.load();
        SchemaValidation.validate(catalog);
        ContentCatalog.install(catalog);
        ContentRegistrar.register(catalog);
        registered = true;
        Aetherklang.LOGGER.info(
                "Sinfonie content catalog loaded: {} definitions ({} instruments, {} mobs, {} islands, {} akkorde, {} bosses)",
                catalog.size(),
                catalog.instruments().size(),
                catalog.mobs().size(),
                catalog.islands().size(),
                catalog.akkorde().size(),
                catalog.bosses().size()
        );
    }
}
