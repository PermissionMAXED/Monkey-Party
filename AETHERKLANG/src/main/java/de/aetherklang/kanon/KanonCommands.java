package de.aetherklang.kanon;

import static net.minecraft.server.command.CommandManager.literal;

import com.mojang.brigadier.builder.LiteralArgumentBuilder;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;

public final class KanonCommands {
    private KanonCommands() {
    }

    public static LiteralArgumentBuilder<ServerCommandSource> command() {
        return literal("kanon")
                .executes(context -> status(context.getSource()))
                .then(literal("start").executes(context -> start(context.getSource())))
                .then(literal("status").executes(context -> status(context.getSource())))
                .then(literal("stop").executes(context -> stop(context.getSource())));
    }

    private static int start(ServerCommandSource source) throws CommandSyntaxException {
        ServerPlayerEntity player = source.getPlayerOrThrow();
        if (!KanonEngine.startCommandChallenge(player)) {
            source.sendError(Text.translatable("command.aetherklang.kanon.already_active"));
            return 0;
        }
        source.sendFeedback(() -> Text.translatable("command.aetherklang.kanon.started"), false);
        return 1;
    }

    private static int status(ServerCommandSource source) throws CommandSyntaxException {
        ServerPlayerEntity player = source.getPlayerOrThrow();
        source.sendFeedback(() -> KanonEngine.status(player), false);
        return 1;
    }

    private static int stop(ServerCommandSource source) throws CommandSyntaxException {
        ServerPlayerEntity player = source.getPlayerOrThrow();
        if (!KanonEngine.cancel(player)) {
            source.sendError(Text.translatable("command.aetherklang.kanon.not_active"));
            return 0;
        }
        return 1;
    }
}
