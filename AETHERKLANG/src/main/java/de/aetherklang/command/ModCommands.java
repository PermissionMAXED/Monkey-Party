package de.aetherklang.command;

import static net.minecraft.server.command.CommandManager.argument;
import static net.minecraft.server.command.CommandManager.literal;

import com.mojang.brigadier.arguments.IntegerArgumentType;
import com.mojang.brigadier.builder.LiteralArgumentBuilder;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import de.aetherklang.klangwerk.KlangwerkCommands;
import de.aetherklang.resonance.BeatEngine;
import de.aetherklang.resonance.BeatTiming;
import de.aetherklang.resonance.ResonanceApi;
import de.aetherklang.resonance.ResonancePlayerData;
import de.aetherklang.resonance.Stimmung;
import java.util.List;
import java.util.Locale;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;

public final class ModCommands {
    private ModCommands() {
    }

    public static void register() {
        CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) ->
                dispatcher.register(literal("aetherklang")
                        .executes(context -> reply(context.getSource(), "command.aetherklang.root"))
                        .then(literal("rp")
                                .then(literal("get")
                                        .executes(context -> getRp(context.getSource())))
                                .then(literal("set")
                                        .requires(source -> source.hasPermissionLevel(2))
                                        .then(argument(
                                                "amount",
                                                IntegerArgumentType.integer(0, ResonancePlayerData.MAX_RP_WITH_BONUS)
                                        ).executes(context -> setRp(
                                                context.getSource(),
                                                IntegerArgumentType.getInteger(context, "amount")
                                        ))))
                                .then(literal("add")
                                        .requires(source -> source.hasPermissionLevel(2))
                                        .then(argument(
                                                "amount",
                                                IntegerArgumentType.integer(
                                                        -ResonancePlayerData.MAX_RP_WITH_BONUS,
                                                        ResonancePlayerData.MAX_RP_WITH_BONUS
                                                )
                                        ).executes(context -> addRp(
                                                context.getSource(),
                                                IntegerArgumentType.getInteger(context, "amount")
                                        )))))
                        .then(moodCommand())
                        .then(literal("beat")
                                .then(literal("info")
                                        .executes(context -> beatInfo(context.getSource()))))
                        .then(literal("codex")
                                .then(literal("unlock")
                                        .requires(source -> source.hasPermissionLevel(2))
                                        .then(argument(
                                                "page",
                                                IntegerArgumentType.integer(
                                                        0,
                                                        ResonancePlayerData.MAX_CODEX_PAGE
                                                )
                                        ).executes(context -> unlockCodexPage(
                                                context.getSource(),
                                                IntegerArgumentType.getInteger(context, "page")
                                        ))))
                                .then(literal("list")
                                        .executes(context -> listCodexPages(context.getSource()))))
                        .then(KlangwerkCommands.command())
                )
        );
    }

    private static LiteralArgumentBuilder<ServerCommandSource> moodCommand() {
        var mood = literal("mood");
        for (Stimmung stimmung : Stimmung.values()) {
            mood.then(literal(stimmung.asString())
                    .executes(context -> setMood(context.getSource(), stimmung)));
        }
        return mood;
    }

    private static int getRp(ServerCommandSource source) throws CommandSyntaxException {
        int rp = ResonanceApi.getRp(player(source));
        return reply(source, "command.aetherklang.rp.get", rp);
    }

    private static int setRp(ServerCommandSource source, int amount) throws CommandSyntaxException {
        ResonanceApi.setRp(player(source), amount);
        return reply(source, "command.aetherklang.rp.set", amount);
    }

    private static int addRp(ServerCommandSource source, int amount) throws CommandSyntaxException {
        int rp = ResonanceApi.addRp(player(source), amount);
        return reply(source, "command.aetherklang.rp.add", amount, rp);
    }

    private static int setMood(ServerCommandSource source, Stimmung mood) throws CommandSyntaxException {
        ResonanceApi.setMood(player(source), mood);
        return reply(source, "command.aetherklang.mood.set", Text.translatable(mood.getTranslationKey()));
    }

    private static int beatInfo(ServerCommandSource source) throws CommandSyntaxException {
        ServerPlayerEntity player = player(source);
        float phase = ResonanceApi.getData(player).getBeatPhase();
        BeatTiming timing = BeatEngine.getTiming(player);
        return reply(
                source,
                "command.aetherklang.beat.info",
                String.format(Locale.ROOT, "%.3f", phase),
                Text.translatable("command.aetherklang.beat." + timing.name().toLowerCase(Locale.ROOT))
        );
    }

    private static int unlockCodexPage(ServerCommandSource source, int page) throws CommandSyntaxException {
        ServerPlayerEntity player = player(source);
        boolean unlocked = ResonanceApi.getData(player).unlockCodexPage(page);
        ResonanceApi.sync(player);
        String key = unlocked
                ? "command.aetherklang.codex.unlock"
                : "command.aetherklang.codex.already_unlocked";
        return reply(source, key, page);
    }

    private static int listCodexPages(ServerCommandSource source) throws CommandSyntaxException {
        List<Integer> pages = ResonanceApi.getData(player(source)).getUnlockedCodexPageIds();
        if (pages.isEmpty()) {
            return reply(source, "command.aetherklang.codex.list_empty");
        }
        return reply(
                source,
                "command.aetherklang.codex.list",
                String.join(", ", pages.stream().map(String::valueOf).toList())
        );
    }

    private static ServerPlayerEntity player(ServerCommandSource source) throws CommandSyntaxException {
        return source.getPlayerOrThrow();
    }

    private static int reply(ServerCommandSource source, String translationKey, Object... args) {
        source.sendFeedback(() -> Text.translatable(translationKey, args), false);
        return 1;
    }
}
