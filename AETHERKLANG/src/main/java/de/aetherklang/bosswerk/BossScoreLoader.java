package de.aetherklang.bosswerk;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import de.aetherklang.Aetherklang;
import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import net.fabricmc.loader.api.FabricLoader;

final class BossScoreLoader {
    private static final Path SCORE_PATH = Path.of("data", Aetherklang.MOD_ID, "klangwerk", "boss");

    private BossScoreLoader() {
    }

    static Map<String, BossScore> load() {
        Map<String, BossScore> scores = new LinkedHashMap<>();
        var container = FabricLoader.getInstance()
                .getModContainer(Aetherklang.MOD_ID)
                .orElseThrow(() -> new IllegalStateException("Missing Aetherklang mod container"));

        int roots = 0;
        for (Path root : container.getRootPaths()) {
            Path scoreRoot = root.resolve(SCORE_PATH);
            if (!Files.isDirectory(scoreRoot)) {
                continue;
            }
            roots++;
            loadRoot(scoreRoot, scores);
        }
        if (roots == 0) {
            throw new IllegalStateException("No Bosswerk score root found at " + SCORE_PATH);
        }
        return Map.copyOf(scores);
    }

    private static void loadRoot(Path root, Map<String, BossScore> scores) {
        try (Stream<Path> files = Files.walk(root)) {
            files.filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith(".json"))
                    .sorted()
                    .forEach(path -> {
                        BossScore score = parse(path);
                        if (scores.putIfAbsent(score.id(), score) != null) {
                            throw new IllegalArgumentException("Duplicate Bosswerk score id '" + score.id() + "'");
                        }
                    });
        } catch (IOException exception) {
            throw new IllegalStateException("Could not scan Bosswerk scores at " + root, exception);
        }
    }

    private static BossScore parse(Path path) {
        try (Reader reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
            JsonObject root = JsonParser.parseReader(reader).getAsJsonObject();
            String id = requiredString(root, "id");
            require("boss".equals(requiredString(root, "type")), id, "must declare type 'boss'");
            JsonObject parameters = requiredObject(root, "parameters");
            double health = requiredParameter(parameters, "health", id);
            require(health > 0.0D, id, "health must be positive");

            List<BossScore.Phase> phases = new ArrayList<>();
            for (Map.Entry<String, JsonElement> parameter : parameters.entrySet()) {
                if (!parameter.getKey().startsWith("phase_")) {
                    continue;
                }
                float minHealth = parsePhaseThreshold(parameter.getKey(), id);
                String[] phaseParts = parameter.getValue().getAsString().split(";", 2);
                require(phaseParts.length == 2, id, parameter.getKey() + " must be '<beat interval>;<attacks>'");
                int beatInterval = parseInt(phaseParts[0], id, parameter.getKey() + " beat interval");
                require(minHealth >= 0.0F && minHealth <= 1.0F, id, "min_hp_percent must be between 0 and 1");
                require(beatInterval > 0, id, "beat_interval must be positive");

                String[] attackScripts = phaseParts[1].split("\\|");
                List<BossScore.Attack> attacks = new ArrayList<>(attackScripts.length);
                for (String attackScript : attackScripts) {
                    String[] attackParts = attackScript.split(",");
                    require(
                            attackParts.length == 4,
                            id,
                            "attacks must be '<op>,<telegraph beats>,<power>,<radius>'"
                    );
                    BossOperation operation = BossOperation.parse(attackParts[0].trim());
                    int telegraphBeats = parseInt(attackParts[1], id, operation + " telegraph beats");
                    float power = parseFloat(attackParts[2], id, operation + " power");
                    float radius = parseFloat(attackParts[3], id, operation + " radius");
                    require(telegraphBeats >= 1 && telegraphBeats <= 4, id, "telegraph_beats must be 1..4");
                    require(power >= 0.0F, id, "attack power must not be negative");
                    require(radius > 0.0F && radius <= 48.0F, id, "attack radius must be in (0, 48]");
                    attacks.add(new BossScore.Attack(operation, telegraphBeats, power, radius));
                }
                require(!attacks.isEmpty(), id, "each phase needs at least one attack");
                phases.add(new BossScore.Phase(minHealth, beatInterval, attacks));
            }

            require(!phases.isEmpty(), id, "score needs at least one phase");
            phases.sort(Comparator.comparing(BossScore.Phase::minHealthPercent).reversed());
            require(phases.getLast().minHealthPercent() == 0.0F, id, "final phase must start at 0 HP%");
            for (int index = 1; index < phases.size(); index++) {
                require(
                        phases.get(index - 1).minHealthPercent() > phases.get(index).minHealthPercent(),
                        id,
                        "phase HP thresholds must be unique"
                );
            }
            return new BossScore(id, health, phases);
        } catch (IOException exception) {
            throw new IllegalStateException("Could not read Bosswerk score " + path, exception);
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException("Invalid Bosswerk score " + path + ": " + exception.getMessage(), exception);
        }
    }

    private static String requiredString(JsonObject object, String field) {
        JsonElement value = object.get(field);
        if (value == null || !value.isJsonPrimitive()) {
            throw new IllegalArgumentException("missing string '" + field + "'");
        }
        return value.getAsString();
    }

    private static JsonObject requiredObject(JsonObject object, String field) {
        JsonElement value = object.get(field);
        if (value == null || !value.isJsonObject()) {
            throw new IllegalArgumentException("missing object '" + field + "'");
        }
        return value.getAsJsonObject();
    }

    private static double requiredParameter(JsonObject parameters, String field, String id) {
        JsonElement value = parameters.get(field);
        if (value == null || !value.isJsonPrimitive()) {
            throw new IllegalArgumentException("Boss '" + id + "' is missing parameter '" + field + "'");
        }
        return parseFloat(value.getAsString(), id, field);
    }

    private static float parsePhaseThreshold(String key, String id) {
        return parseInt(key.substring("phase_".length()), id, key + " threshold") / 100.0F;
    }

    private static int parseInt(String value, String id, String field) {
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("Boss '" + id + "' has invalid " + field, exception);
        }
    }

    private static float parseFloat(String value, String id, String field) {
        try {
            return Float.parseFloat(value.trim());
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("Boss '" + id + "' has invalid " + field, exception);
        }
    }

    private static void require(boolean condition, String id, String message) {
        if (!condition) {
            throw new IllegalArgumentException("Boss '" + id + "' " + message);
        }
    }
}
