package de.aetherklang.partitur;

import static net.minecraft.server.command.CommandManager.literal;

import com.mojang.brigadier.builder.LiteralArgumentBuilder;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import net.minecraft.server.command.ServerCommandSource;

/**
 * Player command counterpart to the Notenpult interaction.
 */
public final class PartiturCommands {
    private PartiturCommands() {
    }

    public static LiteralArgumentBuilder<ServerCommandSource> command() {
        return literal("partitur")
                .executes(context -> open(context.getSource()))
                .then(literal("open").executes(context -> open(context.getSource())));
    }

    private static int open(ServerCommandSource source) throws CommandSyntaxException {
        PartiturService.open(source.getPlayerOrThrow());
        return 1;
    }
}
