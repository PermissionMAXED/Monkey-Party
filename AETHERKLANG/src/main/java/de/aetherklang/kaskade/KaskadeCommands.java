package de.aetherklang.kaskade;

import static net.minecraft.server.command.CommandManager.literal;

import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.text.Text;

final class KaskadeCommands {
    private KaskadeCommands() {
    }

    static void register() {
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) ->
                dispatcher.register(literal("aetherklang")
                        .then(literal("kaskade")
                                .requires(source -> source.hasPermissionLevel(2))
                                .then(literal("start")
                                        .executes(context -> start(context.getSource())))
                                .then(literal("status")
                                        .executes(context -> status(context.getSource())))))
        );
    }

    private static int start(ServerCommandSource source) {
        boolean started = KaskadeEventEngine.trigger(source.getWorld(), source.getPosition());
        source.sendFeedback(
                () -> Text.translatable(started
                        ? "command.aetherklang.kaskade.started"
                        : "command.aetherklang.kaskade.unavailable"),
                true
        );
        return started ? 1 : 0;
    }

    private static int status(ServerCommandSource source) {
        boolean active = KaskadeEventEngine.hasActiveEvent(source.getWorld());
        source.sendFeedback(
                () -> Text.translatable(active
                        ? "command.aetherklang.kaskade.status.active"
                        : "command.aetherklang.kaskade.status.quiet"),
                false
        );
        return active ? 1 : 0;
    }
}
