package de.aetherklang.sturmfront;

import static net.minecraft.server.command.CommandManager.argument;
import static net.minecraft.server.command.CommandManager.literal;

import com.mojang.brigadier.arguments.IntegerArgumentType;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.text.Text;

/**
 * Operator controls for repeatable Sturmfront staging and smoke tests.
 */
final class SturmfrontCommands {
    private SturmfrontCommands() {
    }

    static void register() {
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) ->
                dispatcher.register(literal("aetherklang")
                        .then(literal("sturmfront")
                                .requires(source -> source.hasPermissionLevel(2))
                                .then(literal("summon")
                                        .executes(context -> summon(context.getSource())))
                                .then(literal("status")
                                        .executes(context -> status(context.getSource())))
                                .then(literal("push")
                                        .then(argument("power", IntegerArgumentType.integer(1, 8))
                                                .executes(context -> push(
                                                        context.getSource(),
                                                        IntegerArgumentType.getInteger(context, "power")
                                                ))))))
        );
    }

    private static int summon(ServerCommandSource source) {
        boolean summoned = SturmfrontEngine.summon(source.getWorld(), source.getPosition());
        source.sendFeedback(
                () -> Text.translatable(summoned
                        ? "command.aetherklang.sturmfront.summoned"
                        : "command.aetherklang.sturmfront.wrong_dimension"),
                true
        );
        return summoned ? 1 : 0;
    }

    private static int status(ServerCommandSource source) {
        SturmfrontSnapshot snapshot = SturmfrontEngine.snapshot(source.getWorld());
        if (!snapshot.active()) {
            source.sendFeedback(
                    () -> Text.translatable("command.aetherklang.sturmfront.inactive"),
                    false
            );
            return 0;
        }
        source.sendFeedback(
                () -> Text.translatable(
                        "command.aetherklang.sturmfront.status",
                        Math.round(snapshot.centerX()),
                        Math.round(snapshot.centerZ()),
                        Math.round(snapshot.radius()),
                        Math.round(snapshot.intensity() * 100.0F)
                ),
                false
        );
        return 1;
    }

    private static int push(ServerCommandSource source, int power) {
        double pushed = SturmfrontEngine.pushForCommand(
                source.getWorld(),
                source.getPosition(),
                power
        );
        source.sendFeedback(
                () -> Text.translatable(
                        pushed > 0.0D
                                ? "command.aetherklang.sturmfront.pushed"
                                : "command.aetherklang.sturmfront.out_of_range",
                        Math.round(pushed)
                ),
                true
        );
        return pushed > 0.0D ? 1 : 0;
    }
}
