package de.aetherklang.partitur;

import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Persistent per-player state for the current Partitur rotation.
 */
public final class PartiturPlayerData {
    public static final Codec<PartiturPlayerData> CODEC = RecordCodecBuilder.create(instance -> instance.group(
            Codec.LONG.optionalFieldOf("rotation", -1L).forGetter(PartiturPlayerData::rotation),
            Codec.STRING.listOf().optionalFieldOf("active", List.of()).forGetter(PartiturPlayerData::activeIds),
            Codec.unboundedMap(Codec.STRING, Codec.intRange(0, Integer.MAX_VALUE))
                    .optionalFieldOf("progress", Map.of())
                    .forGetter(PartiturPlayerData::progress),
            Codec.STRING.listOf().optionalFieldOf("claimed", List.of())
                    .forGetter(data -> data.claimed.stream().sorted().toList())
    ).apply(instance, PartiturPlayerData::new));

    private long rotation;
    private final List<String> activeIds;
    private final Map<String, Integer> progress;
    private final Set<String> claimed;

    public PartiturPlayerData() {
        this(-1L, List.of(), Map.of(), List.of());
    }

    private PartiturPlayerData(
            long rotation,
            List<String> activeIds,
            Map<String, Integer> progress,
            List<String> claimed
    ) {
        this.rotation = rotation;
        this.activeIds = new ArrayList<>(activeIds);
        this.progress = new LinkedHashMap<>();
        progress.forEach((id, value) -> this.progress.put(id, Math.max(0, value)));
        this.claimed = new HashSet<>(claimed);
    }

    public boolean ensureRotation(long currentRotation, List<AuftragDef> contracts) {
        List<String> expected = contracts.stream().map(AuftragDef::id).toList();
        if (rotation == currentRotation && activeIds.equals(expected)) {
            return false;
        }

        rotation = currentRotation;
        activeIds.clear();
        activeIds.addAll(expected);
        progress.clear();
        expected.forEach(id -> progress.put(id, 0));
        claimed.clear();
        return true;
    }

    public boolean advance(AuftragDef definition, int amount) {
        if (amount <= 0 || claimed.contains(definition.id()) || !activeIds.contains(definition.id())) {
            return false;
        }
        int previous = progress(definition.id());
        int updated = Math.min(definition.amount(), previous + amount);
        if (previous == updated) {
            return false;
        }
        progress.put(definition.id(), updated);
        return true;
    }

    public boolean claim(AuftragDef definition) {
        if (!activeIds.contains(definition.id())
                || progress(definition.id()) < definition.amount()
                || claimed.contains(definition.id())) {
            return false;
        }
        claimed.add(definition.id());
        return true;
    }

    public long rotation() {
        return rotation;
    }

    public List<String> activeIds() {
        return List.copyOf(activeIds);
    }

    public Map<String, Integer> progress() {
        return Map.copyOf(progress);
    }

    public int progress(String id) {
        return progress.getOrDefault(id, 0);
    }

    public boolean isClaimed(String id) {
        return claimed.contains(id);
    }
}
