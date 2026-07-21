package de.aetherklang.resonanzfeld;

import static net.minecraft.server.command.CommandManager.literal;

import java.util.List;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.text.Text;

final class ResonanzfeldCommands {
    private ResonanzfeldCommands() {
    }

    static void register() {
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) ->
                dispatcher.register(literal("aetherklang")
                        .then(literal("resonanzfeld")
                                .requires(source -> source.hasPermissionLevel(2))
                                .then(literal("status")
                                        .executes(context -> status(context.getSource())))
                                .then(literal("siege")
                                        .executes(context -> siege(context.getSource())))))
        );
    }

    private static int status(ServerCommandSource source) {
        List<ResonanzfeldSnapshot> fields = ResonanzfeldEngine.snapshots(source.getWorld());
        if (fields.isEmpty()) {
            source.sendFeedback(
                    () -> Text.translatable("command.aetherklang.resonanzfeld.status.none"),
                    false
            );
            return 0;
        }

        ResonanzfeldSnapshot nearest = ResonanzfeldEngine.nearestField(
                source.getWorld(),
                source.getPosition()
        ).orElseThrow();
        long remainingTicks = Math.max(0L, nearest.nextSiegeTick() - source.getWorld().getTime());
        long remainingSeconds = (remainingTicks + 19L) / 20L;
        source.sendFeedback(
                () -> Text.translatable(
                        "command.aetherklang.resonanzfeld.status",
                        fields.size(),
                        Text.translatable(nearest.mood().getTranslationKey()),
                        nearest.resonators(),
                        Math.round(nearest.radius()),
                        remainingSeconds
                ),
                false
        );
        return fields.size();
    }

    private static int siege(ServerCommandSource source) {
        boolean started = ResonanzfeldEngine.forceSiege(source.getWorld(), source.getPosition());
        source.sendFeedback(
                () -> Text.translatable(started
                        ? "command.aetherklang.resonanzfeld.siege.started"
                        : "command.aetherklang.resonanzfeld.siege.unavailable"),
                true
        );
        return started ? 1 : 0;
    }
}
