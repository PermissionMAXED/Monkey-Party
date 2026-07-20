package de.aetherklang.client.kodex;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import de.aetherklang.Aetherklang;
import java.io.Reader;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.client.MinecraftClient;

public final class KodexContent {
    private static final String CONTENT_PATH = "kodex/pages.json";

    private KodexContent() {
    }

    public static List<KodexEntry> load() {
        var resource = MinecraftClient.getInstance()
                .getResourceManager()
                .getResource(Aetherklang.id(CONTENT_PATH));
        if (resource.isEmpty()) {
            Aetherklang.LOGGER.warn("Kodex content {} is missing", CONTENT_PATH);
            return fallback();
        }

        try (Reader reader = resource.get().getReader()) {
            JsonArray pages = JsonParser.parseReader(reader).getAsJsonObject().getAsJsonArray("pages");
            List<KodexEntry> entries = new ArrayList<>(pages.size());
            for (JsonElement element : pages) {
                entries.add(parseEntry(element.getAsJsonObject()));
            }
            Aetherklang.LOGGER.debug("Loaded {} Kodex pages", entries.size());
            return List.copyOf(entries);
        } catch (RuntimeException | java.io.IOException exception) {
            Aetherklang.LOGGER.error("Could not load Kodex content", exception);
            return fallback();
        }
    }

    private static KodexEntry parseEntry(JsonObject object) {
        JsonArray body = object.getAsJsonArray("body");
        List<String> bodyKeys = new ArrayList<>(body.size());
        body.forEach(element -> bodyKeys.add(element.getAsString()));
        return new KodexEntry(
                object.get("id").getAsString(),
                KodexCategory.byId(object.get("category").getAsString()),
                object.get("title").getAsString(),
                object.get("subtitle").getAsString(),
                List.copyOf(bodyKeys),
                object.has("always_unlocked") && object.get("always_unlocked").getAsBoolean()
        );
    }

    private static List<KodexEntry> fallback() {
        return List.of(new KodexEntry(
                "welcome",
                KodexCategory.LORE,
                "kodex.aetherklang.page.welcome.title",
                "kodex.aetherklang.page.welcome.subtitle",
                List.of("kodex.aetherklang.page.welcome.body.1"),
                true
        ));
    }
}
