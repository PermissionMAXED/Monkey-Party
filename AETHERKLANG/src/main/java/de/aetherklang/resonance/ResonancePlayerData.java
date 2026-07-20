package de.aetherklang.resonance;

import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;
import java.util.BitSet;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Persistent resonance data attached to each player.
 */
public class ResonancePlayerData {
    public static final int MAX_RP = 100;
    public static final int MAX_RP_WITH_BONUS = 200;
    public static final int MAX_CODEX_PAGE = 255;

    public static final Codec<ResonancePlayerData> CODEC = RecordCodecBuilder.create(instance ->
            instance.group(
                    Stimmung.CODEC.optionalFieldOf("mood", Stimmung.STILLE)
                            .forGetter(ResonancePlayerData::getMood),
                    Codec.intRange(0, MAX_RP_WITH_BONUS).optionalFieldOf("rp", 0)
                            .forGetter(ResonancePlayerData::getRp),
                    Codec.floatRange(0.0F, 1.0F).optionalFieldOf("beat_phase", 0.0F)
                            .forGetter(ResonancePlayerData::getBeatPhase),
                    Codec.floatRange(0.0F, 1.0F).optionalFieldOf("dissonanz", 0.0F)
                            .forGetter(ResonancePlayerData::getDissonanz),
                    Codec.intRange(0, MAX_CODEX_PAGE).listOf()
                            .optionalFieldOf("unlocked_codex_pages", List.of())
                            .forGetter(ResonancePlayerData::getUnlockedCodexPageIds),
                    Codec.intRange(0, Integer.MAX_VALUE).optionalFieldOf("rang", 0)
                            .forGetter(ResonancePlayerData::getRang),
                    Codec.LONG.optionalFieldOf("gesamt_rp", 0L)
                            .forGetter(ResonancePlayerData::getGesamtRp),
                    Codec.STRING.listOf().optionalFieldOf("leitmotiv_unlocked", List.of())
                            .forGetter(ResonancePlayerData::getUnlockedLeitmotivNodeIds),
                    Codec.STRING.listOf().optionalFieldOf("leitmotiv_rewards", List.of())
                            .forGetter(ResonancePlayerData::getClaimedLeitmotivRewardIds)
            ).apply(instance, ResonancePlayerData::fromSerialized)
    );

    private Stimmung mood;
    private int rp;
    private float beatPhase;
    private float dissonanz;
    private final BitSet unlockedCodexPages;
    private int rang;
    private long gesamtRp;
    private final Set<String> unlockedLeitmotivNodes;
    private final Set<String> claimedLeitmotivRewards;

    public ResonancePlayerData() {
        this(Stimmung.STILLE, 0, 0.0F, 0.0F, new BitSet(), 0, 0L, Set.of(), Set.of());
    }

    public ResonancePlayerData(
            Stimmung mood,
            int rp,
            float beatPhase,
            float dissonanz,
            BitSet unlockedCodexPages
    ) {
        this(mood, rp, beatPhase, dissonanz, unlockedCodexPages, 0, 0L, Set.of(), Set.of());
    }

    public ResonancePlayerData(
            Stimmung mood,
            int rp,
            float beatPhase,
            float dissonanz,
            BitSet unlockedCodexPages,
            int rang,
            long gesamtRp
    ) {
        this(mood, rp, beatPhase, dissonanz, unlockedCodexPages, rang, gesamtRp, Set.of(), Set.of());
    }

    public ResonancePlayerData(
            Stimmung mood,
            int rp,
            float beatPhase,
            float dissonanz,
            BitSet unlockedCodexPages,
            int rang,
            long gesamtRp,
            Set<String> unlockedLeitmotivNodes,
            Set<String> claimedLeitmotivRewards
    ) {
        this.mood = mood == null ? Stimmung.STILLE : mood;
        this.rp = clampRp(rp);
        this.beatPhase = clampUnit(beatPhase);
        this.dissonanz = clampUnit(dissonanz);
        this.unlockedCodexPages = unlockedCodexPages == null
                ? new BitSet()
                : (BitSet) unlockedCodexPages.clone();
        this.rang = Math.max(0, rang);
        this.gesamtRp = Math.max(0L, gesamtRp);
        this.unlockedLeitmotivNodes = sanitizeIds(unlockedLeitmotivNodes);
        this.claimedLeitmotivRewards = sanitizeIds(claimedLeitmotivRewards);
    }

    private static ResonancePlayerData fromSerialized(
            Stimmung mood,
            int rp,
            float beatPhase,
            float dissonanz,
            List<Integer> unlockedCodexPages,
            int rang,
            long gesamtRp,
            List<String> unlockedLeitmotivNodes,
            List<String> claimedLeitmotivRewards
    ) {
        BitSet pages = new BitSet();
        unlockedCodexPages.forEach(pages::set);
        return new ResonancePlayerData(
                mood,
                rp,
                beatPhase,
                dissonanz,
                pages,
                rang,
                gesamtRp,
                Set.copyOf(unlockedLeitmotivNodes),
                Set.copyOf(claimedLeitmotivRewards)
        );
    }

    public Stimmung getMood() {
        return mood;
    }

    public void setMood(Stimmung mood) {
        this.mood = mood == null ? Stimmung.STILLE : mood;
    }

    public int getRp() {
        return rp;
    }

    public void setRp(int rp) {
        this.rp = clampRp(rp);
    }

    public float getBeatPhase() {
        return beatPhase;
    }

    public void setBeatPhase(float beatPhase) {
        this.beatPhase = clampUnit(beatPhase);
    }

    public float getDissonanz() {
        return dissonanz;
    }

    public void setDissonanz(float dissonanz) {
        this.dissonanz = clampUnit(dissonanz);
    }

    public BitSet getUnlockedCodexPages() {
        return (BitSet) unlockedCodexPages.clone();
    }

    public List<Integer> getUnlockedCodexPageIds() {
        return unlockedCodexPages.stream().boxed().toList();
    }

    public boolean isCodexPageUnlocked(int page) {
        return page >= 0 && unlockedCodexPages.get(page);
    }

    public boolean unlockCodexPage(int page) {
        if (page < 0 || page > MAX_CODEX_PAGE) {
            return false;
        }

        boolean wasUnlocked = unlockedCodexPages.get(page);
        unlockedCodexPages.set(page);
        return !wasUnlocked;
    }

    public int getRang() {
        return rang;
    }

    public void setRang(int rang) {
        this.rang = Math.max(0, rang);
    }

    public long getGesamtRp() {
        return gesamtRp;
    }

    public void setGesamtRp(long gesamtRp) {
        this.gesamtRp = Math.max(0L, gesamtRp);
    }

    public boolean isLeitmotivNodeUnlocked(String nodeId) {
        return nodeId != null && unlockedLeitmotivNodes.contains(nodeId);
    }

    public boolean unlockLeitmotivNode(String nodeId) {
        return nodeId != null && !nodeId.isBlank() && unlockedLeitmotivNodes.add(nodeId);
    }

    public List<String> getUnlockedLeitmotivNodeIds() {
        return unlockedLeitmotivNodes.stream().sorted().toList();
    }

    public boolean claimLeitmotivReward(String rewardId) {
        return rewardId != null && !rewardId.isBlank() && claimedLeitmotivRewards.add(rewardId);
    }

    public List<String> getClaimedLeitmotivRewardIds() {
        return claimedLeitmotivRewards.stream().sorted().toList();
    }

    private static int clampRp(int value) {
        return Math.clamp(value, 0, MAX_RP_WITH_BONUS);
    }

    private static float clampUnit(float value) {
        if (!Float.isFinite(value)) {
            return 0.0F;
        }
        return Math.clamp(value, 0.0F, 1.0F);
    }

    private static Set<String> sanitizeIds(Set<String> ids) {
        Set<String> sanitized = new HashSet<>();
        if (ids != null) {
            ids.stream()
                    .filter(id -> id != null && !id.isBlank())
                    .forEach(sanitized::add);
        }
        return sanitized;
    }
}
