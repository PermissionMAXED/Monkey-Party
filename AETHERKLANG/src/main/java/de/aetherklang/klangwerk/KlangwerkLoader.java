package de.aetherklang.klangwerk;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.mojang.serialization.JsonOps;
import de.aetherklang.Aetherklang;
import de.aetherklang.data.ContentCatalog;
import de.aetherklang.partitur.PartiturCatalog;
import java.io.IOException;
import java.io.Reader;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import net.fabricmc.fabric.api.resource.ResourceManagerHelper;
import net.fabricmc.fabric.api.resource.SimpleSynchronousResourceReloadListener;
import net.minecraft.resource.Resource;
import net.minecraft.resource.ResourceManager;
import net.minecraft.resource.ResourceType;
import net.minecraft.util.Identifier;

public final class KlangwerkLoader implements SimpleSynchronousResourceReloadListener {
    private static final String ROOT = "klangwerk";
    private static final Set<String> FIELDS = Set.of("id", "type", "parameters");
    private static final KlangwerkLoader INSTANCE = new KlangwerkLoader();

    private static boolean registered;

    private KlangwerkLoader() {
    }

    public static void register() {
        if (registered) {
            return;
        }
        ResourceManagerHelper.get(ResourceType.SERVER_DATA).registerReloadListener(INSTANCE);
        registered = true;
    }

    public static int reloadNow(ResourceManager resourceManager) {
        return INSTANCE.loadAndInstall(resourceManager);
    }

    @Override
    public Identifier getFabricId() {
        return Aetherklang.id(ROOT);
    }

    @Override
    public void reload(ResourceManager resourceManager) {
        loadAndInstall(resourceManager);
    }

    private int loadAndInstall(ResourceManager resourceManager) {
        Map<KlangwerkType, Map<String, KlangwerkReloadDef>> definitions = load(resourceManager);
        ContentCatalog nextCatalog = ContentCatalog.current().withKlangwerk(definitions);
        PartiturCatalog.install(nextCatalog.klangwerk(KlangwerkType.AUFTRAG));
        ContentCatalog.install(nextCatalog);

        int count = definitions.values().stream().mapToInt(Map::size).sum();
        Aetherklang.LOGGER.info("Klangwerk catalog loaded: {} definitions", count);
        return count;
    }

    static Map<KlangwerkType, Map<String, KlangwerkReloadDef>> load(ResourceManager resourceManager) {
        EnumMap<KlangwerkType, Map<String, KlangwerkReloadDef>> definitions =
                new EnumMap<>(KlangwerkType.class);
        for (KlangwerkType type : KlangwerkType.values()) {
            definitions.put(type, new LinkedHashMap<>());
        }

        Map<Identifier, Resource> resources = resourceManager.findResources(
                ROOT,
                id -> id.getNamespace().equals(Aetherklang.MOD_ID) && id.getPath().endsWith(".json")
        );
        resources.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> loadResource(entry.getKey(), entry.getValue(), definitions));

        EnumMap<KlangwerkType, Map<String, KlangwerkReloadDef>> frozen =
                new EnumMap<>(KlangwerkType.class);
        definitions.forEach((type, values) -> frozen.put(type, Map.copyOf(values)));
        return Map.copyOf(frozen);
    }

    private static void loadResource(
            Identifier resourceId,
            Resource resource,
            Map<KlangwerkType, Map<String, KlangwerkReloadDef>> definitions
    ) {
        String[] path = resourceId.getPath().split("/");
        if (path.length != 3 || !path[0].equals(ROOT) || !path[2].endsWith(".json")) {
            throw new IllegalArgumentException(
                    "Klangwerk JSON must use " + ROOT + "/<type>/<id>.json: " + resourceId
            );
        }

        KlangwerkType pathType = KlangwerkType.decode(path[1]).getOrThrow(
                message -> new IllegalArgumentException("Invalid Klangwerk path " + resourceId + ": " + message)
        );
        String fileId = path[2].substring(0, path[2].length() - ".json".length());
        KlangwerkReloadDef definition = decode(resourceId, resource);
        KlangwerkValidation.validate(definition, pathType, fileId, resourceId);

        Map<String, KlangwerkReloadDef> values = definitions.get(pathType);
        if (values.putIfAbsent(definition.id(), definition) != null) {
            throw new IllegalArgumentException(
                    "Duplicate Klangwerk " + pathType.asString() + " id '" + definition.id() + "'"
            );
        }
    }

    private static KlangwerkReloadDef decode(Identifier resourceId, Resource resource) {
        try (Reader reader = resource.getReader()) {
            JsonElement json = JsonParser.parseReader(reader);
            requireKnownFields(resourceId, json);
            return KlangwerkReloadDef.CODEC.parse(JsonOps.INSTANCE, json).getOrThrow(
                    message -> new IllegalArgumentException(
                            "Invalid Klangwerk JSON " + resourceId + ": " + message
                    )
            );
        } catch (IOException exception) {
            throw new IllegalStateException("Could not read Klangwerk JSON " + resourceId, exception);
        } catch (RuntimeException exception) {
            if (exception instanceof IllegalArgumentException
                    && exception.getMessage() != null
                    && exception.getMessage().startsWith("Invalid Klangwerk JSON ")) {
                throw exception;
            }
            throw new IllegalArgumentException(
                    "Invalid Klangwerk JSON " + resourceId + ": " + exception.getMessage(),
                    exception
            );
        }
    }

    private static void requireKnownFields(Identifier resourceId, JsonElement json) {
        if (!json.isJsonObject()) {
            throw new IllegalArgumentException("Invalid Klangwerk JSON " + resourceId + ": expected an object");
        }
        JsonObject object = json.getAsJsonObject();
        for (String field : object.keySet()) {
            if (!FIELDS.contains(field)) {
                throw new IllegalArgumentException(
                        "Invalid Klangwerk JSON " + resourceId + ": unknown field '" + field + "'"
                );
            }
        }
    }
}
