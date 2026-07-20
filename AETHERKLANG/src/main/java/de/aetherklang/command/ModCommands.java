package de.aetherklang.command;

import static net.minecraft.server.command.CommandManager.literal;

import de.aetherklang.Aetherklang;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.minecraft.text.Text;

public final class ModCommands {
    private ModCommands() {
    }

    public static void register() {
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) ->
                dispatcher.register(literal("aetherklang")
                        .executes(context -> reply(context.getSource(), "Aetherklang klingt."))
                        .then(literal("rp")
                                .executes(context -> reply(context.getSource(), "RP-System bereit (WP1-Stub).")))
                        .then(literal("mood")
                                .executes(context -> reply(context.getSource(), "Stimmungen bereit (WP1-Stub).")))
                        .then(literal("beat")
                                .executes(context -> reply(context.getSource(), "Takt-System bereit (WP1-Stub).")))
                        .then(literal("codex")
                                .executes(context -> reply(context.getSource(), "Kodex der Resonanz bereit (WP1-Stub).")))
                )
        );
    }

    private static int reply(net.minecraft.server.command.ServerCommandSource source, String message) {
        source.sendFeedback(() -> Text.literal(message), false);
        Aetherklang.LOGGER.info("Command smoke test: {}", message);
        return 1;
    }
}
