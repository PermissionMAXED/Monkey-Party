package de.aetherklang.klangwerk;

import static net.minecraft.server.command.CommandManager.literal;

import com.mojang.brigadier.builder.LiteralArgumentBuilder;
import de.aetherklang.Aetherklang;
import de.aetherklang.data.ContentCatalog;
import java.util.Comparator;
import java.util.Map;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.text.Text;

public final class KlangwerkCommands {
    private KlangwerkCommands() {
    }

    public static LiteralArgumentBuilder<ServerCommandSource> command() {
        return literal("klangwerk")
                .then(literal("reload")
                        .requires(source -> source.hasPermissionLevel(2))
                        .executes(context -> reload(context.getSource())))
                .then(literal("dump")
                        .executes(context -> dump(context.getSource())));
    }

    private static int reload(ServerCommandSource source) {
        try {
            int count = KlangwerkLoader.reloadNow(source.getServer().getResourceManager());
            source.sendFeedback(
                    () -> Text.literal("Klangwerk reloaded: " + count + " definitions"),
                    true
            );
            return count;
        } catch (RuntimeException exception) {
            Aetherklang.LOGGER.error("Klangwerk reload failed", exception);
            source.sendError(Text.literal("Klangwerk reload failed: " + rootMessage(exception)));
            return 0;
        }
    }

    private static int dump(ServerCommandSource source) {
        ContentCatalog catalog = ContentCatalog.current();
        int total = catalog.klangwerk().values().stream().mapToInt(Map::size).sum();
        source.sendFeedback(() -> Text.literal("Klangwerk catalog: " + total + " definitions"), false);

        for (KlangwerkType type : KlangwerkType.values()) {
            String ids = catalog.klangwerk(type).keySet().stream()
                    .sorted(Comparator.naturalOrder())
                    .collect(java.util.stream.Collectors.joining(", "));
            String line = type.asString() + " (" + catalog.klangwerk(type).size() + ")"
                    + (ids.isEmpty() ? "" : ": " + ids);
            source.sendFeedback(() -> Text.literal(line), false);
        }
        return total;
    }

    private static String rootMessage(Throwable throwable) {
        Throwable current = throwable;
        while (current.getCause() != null) {
            current = current.getCause();
        }
        String message = current.getMessage();
        return message == null || message.isBlank() ? current.getClass().getSimpleName() : message;
    }
}
