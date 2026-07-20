package de.aetherklang.data;

import com.google.gson.JsonElement;
import com.google.gson.JsonParser;
import com.mojang.serialization.Codec;
import com.mojang.serialization.JsonOps;
import de.aetherklang.Aetherklang;
import de.aetherklang.data.schema.AkkordDef;
import de.aetherklang.data.schema.BossDef;
import de.aetherklang.data.schema.FxSpec;
import de.aetherklang.data.schema.InstrumentDef;
import de.aetherklang.data.schema.IslandDef;
import de.aetherklang.data.schema.KodexFolioDef;
import de.aetherklang.data.schema.LootTierDef;
import de.aetherklang.data.schema.MobDef;
import de.aetherklang.data.schema.RelicDef;
import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Stream;
import net.fabricmc.loader.api.FabricLoader;

public final class ContentLoader {
    private static final Path CONTENT_PATH = Path.of("data", Aetherklang.MOD_ID, "content");

    private final Map<String, InstrumentDef> instruments = new LinkedHashMap<>();
    private final Map<String, MobDef> mobs = new LinkedHashMap<>();
    private final Map<String, IslandDef> islands = new LinkedHashMap<>();
    private final Map<String, AkkordDef> akkorde = new LinkedHashMap<>();
    private final Map<String, KodexFolioDef> kodexFolios = new LinkedHashMap<>();
    private final Map<String, LootTierDef> lootTiers = new LinkedHashMap<>();
    private final Map<String, FxSpec> fxSpecs = new LinkedHashMap<>();
    private final Map<String, BossDef> bosses = new LinkedHashMap<>();
    private final Map<String, RelicDef> relics = new LinkedHashMap<>();

    private ContentLoader() {
    }

    public static ContentCatalog load() {
        ContentLoader loader = new ContentLoader();
        var container = FabricLoader.getInstance()
                .getModContainer(Aetherklang.MOD_ID)
                .orElseThrow(() -> new IllegalStateException("Missing Aetherklang mod container"));

        int roots = 0;
        for (Path root : container.getRootPaths()) {
            Path contentRoot = root.resolve(CONTENT_PATH);
            if (Files.isDirectory(contentRoot)) {
                loader.loadRoot(contentRoot);
                roots++;
            }
        }
        if (roots == 0) {
            throw new IllegalStateException("No Aetherklang content root found at " + CONTENT_PATH);
        }
        return loader.freeze();
    }

    private void loadRoot(Path contentRoot) {
        try (Stream<Path> files = Files.walk(contentRoot)) {
            files.filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith(".json"))
                    .sorted()
                    .forEach(path -> loadFile(contentRoot, path));
        } catch (IOException exception) {
            throw new IllegalStateException("Could not scan content root " + contentRoot, exception);
        }
    }

    private void loadFile(Path contentRoot, Path path) {
        Path relative = contentRoot.relativize(path);
        if (relative.getNameCount() < 2) {
            throw new IllegalArgumentException("Content JSON must be inside a type folder: " + relative);
        }
        String type = relative.getName(0).toString();
        switch (type) {
            case "instruments" -> decodeAndPut(path, InstrumentDef.CODEC, InstrumentDef::id, instruments);
            case "mobs" -> decodeAndPut(path, MobDef.CODEC, MobDef::id, mobs);
            case "islands" -> decodeAndPut(path, IslandDef.CODEC, IslandDef::id, islands);
            case "akkorde" -> decodeAndPut(path, AkkordDef.CODEC, AkkordDef::id, akkorde);
            case "kodex_folios" -> decodeAndPut(path, KodexFolioDef.CODEC, KodexFolioDef::id, kodexFolios);
            case "loot_tiers" -> decodeAndPut(path, LootTierDef.CODEC, LootTierDef::id, lootTiers);
            case "fx" -> decodeAndPut(path, FxSpec.CODEC, FxSpec::id, fxSpecs);
            case "bosses" -> decodeAndPut(path, BossDef.CODEC, BossDef::id, bosses);
            case "relics" -> decodeAndPut(path, RelicDef.CODEC, RelicDef::id, relics);
            default -> throw new IllegalArgumentException("Unknown Aetherklang content type '" + type + "' in " + path);
        }
    }

    private static <T> void decodeAndPut(
            Path path,
            Codec<T> codec,
            Function<T, String> idGetter,
            Map<String, T> destination
    ) {
        T value;
        try (Reader reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
            JsonElement json = JsonParser.parseReader(reader);
            value = codec.parse(JsonOps.INSTANCE, json).getOrThrow(
                    message -> new IllegalArgumentException("Invalid content JSON " + path + ": " + message)
            );
        } catch (IOException exception) {
            throw new IllegalStateException("Could not read content JSON " + path, exception);
        }

        String id = idGetter.apply(value);
        if (destination.putIfAbsent(id, value) != null) {
            throw new IllegalArgumentException("Duplicate content id '" + id + "' in " + path);
        }
    }

    private ContentCatalog freeze() {
        return new ContentCatalog(
                instruments,
                mobs,
                islands,
                akkorde,
                kodexFolios,
                lootTiers,
                fxSpecs,
                bosses,
                relics,
                Map.of()
        );
    }
}
