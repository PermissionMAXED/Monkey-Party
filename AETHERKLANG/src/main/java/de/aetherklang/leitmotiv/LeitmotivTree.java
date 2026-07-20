package de.aetherklang.leitmotiv;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Authoritative definition of the 36-node Leitmotiv tree.
 */
public final class LeitmotivTree {
    public static final int NODE_COUNT = 36;
    public static final int NODES_PER_BRANCH = 12;

    private static final List<LeitmotivNode> NODES = List.of(
            node("scharfer_auftakt", LeitmotivBranch.KAMPF, 0, 1, LeitmotivEffect.DAMAGE_MULTIPLIER, 0.05F),
            node("goldener_schlag", LeitmotivBranch.KAMPF, 1, 1, LeitmotivEffect.PERFECT_WINDOW, 0.01F,
                    "scharfer_auftakt"),
            node("druckwelle", LeitmotivBranch.KAMPF, 2, 1, LeitmotivEffect.DAMAGE_MULTIPLIER, 0.05F,
                    "goldener_schlag"),
            node("jagdmotiv", LeitmotivBranch.KAMPF, 3, 1, LeitmotivEffect.RP_GAIN, 1.0F,
                    "druckwelle"),
            node("fortissimo", LeitmotivBranch.KAMPF, 4, 2, LeitmotivEffect.DAMAGE_MULTIPLIER, 0.075F,
                    "jagdmotiv"),
            node("praezision", LeitmotivBranch.KAMPF, 5, 2, LeitmotivEffect.PERFECT_WINDOW, 0.01F,
                    "fortissimo"),
            node("heldenkadenz", LeitmotivBranch.KAMPF, 6, 3, LeitmotivEffect.RP_GAIN, 1.0F,
                    "praezision"),
            node("finale", LeitmotivBranch.KAMPF, 7, 3, LeitmotivEffect.DAMAGE_MULTIPLIER, 0.10F,
                    "heldenkadenz"),
            node("klingenrhythmus", LeitmotivBranch.KAMPF, 8, 4, LeitmotivEffect.DAMAGE_MULTIPLIER, 0.05F,
                    "finale"),
            node("kritischer_nachhall", LeitmotivBranch.KAMPF, 9, 4, LeitmotivEffect.PERFECT_WINDOW, 0.01F,
                    "klingenrhythmus"),
            node("schlagrefrain", LeitmotivBranch.KAMPF, 10, 5, LeitmotivEffect.RP_GAIN, 1.0F,
                    "kritischer_nachhall"),
            node("apotheose", LeitmotivBranch.KAMPF, 11, 6, LeitmotivEffect.DAMAGE_MULTIPLIER, 0.125F,
                    "schlagrefrain"),

            node("sanfter_auftakt", LeitmotivBranch.HARMONIE, 0, 1, LeitmotivEffect.HEALING_MULTIPLIER, 0.10F),
            node("ruhiger_puls", LeitmotivBranch.HARMONIE, 1, 1,
                    LeitmotivEffect.DISSONANCE_DECAY_MULTIPLIER, 0.25F, "sanfter_auftakt"),
            node("offenes_ohr", LeitmotivBranch.HARMONIE, 2, 1, LeitmotivEffect.GOOD_WINDOW, 0.015F,
                    "ruhiger_puls"),
            node("heilender_refrain", LeitmotivBranch.HARMONIE, 3, 1,
                    LeitmotivEffect.HEALING_MULTIPLIER, 0.15F, "offenes_ohr"),
            node("klare_stimme", LeitmotivBranch.HARMONIE, 4, 2,
                    LeitmotivEffect.DISSONANCE_DECAY_MULTIPLIER, 0.35F, "heilender_refrain"),
            node("tiefer_vorrat", LeitmotivBranch.HARMONIE, 5, 2, LeitmotivEffect.RP_CAP, 10.0F,
                    "klare_stimme"),
            node("gemeinsamer_takt", LeitmotivBranch.HARMONIE, 6, 3, LeitmotivEffect.GOOD_WINDOW, 0.015F,
                    "tiefer_vorrat"),
            node("lebenslied", LeitmotivBranch.HARMONIE, 7, 3,
                    LeitmotivEffect.HEALING_MULTIPLIER, 0.25F, "gemeinsamer_takt"),
            node("sanfte_resonanz", LeitmotivBranch.HARMONIE, 8, 4,
                    LeitmotivEffect.HEALING_MULTIPLIER, 0.10F, "lebenslied"),
            node("reine_kadenz", LeitmotivBranch.HARMONIE, 9, 4,
                    LeitmotivEffect.DISSONANCE_DECAY_MULTIPLIER, 0.25F, "sanfte_resonanz"),
            node("tragender_akkord", LeitmotivBranch.HARMONIE, 10, 5,
                    LeitmotivEffect.RP_CAP, 15.0F, "reine_kadenz"),
            node("ewiger_chor", LeitmotivBranch.HARMONIE, 11, 6,
                    LeitmotivEffect.HEALING_MULTIPLIER, 0.30F, "tragender_akkord"),

            node("leichter_schritt", LeitmotivBranch.WELT, 0, 1, LeitmotivEffect.DASH_COST_REDUCTION, 1.0F),
            node("resonanzraum", LeitmotivBranch.WELT, 1, 1, LeitmotivEffect.RP_CAP, 10.0F,
                    "leichter_schritt"),
            node("fundmelodie", LeitmotivBranch.WELT, 2, 1, LeitmotivEffect.RP_GAIN, 1.0F,
                    "resonanzraum"),
            node("weiter_horizont", LeitmotivBranch.WELT, 3, 1, LeitmotivEffect.GOOD_WINDOW, 0.015F,
                    "fundmelodie"),
            node("echopfad", LeitmotivBranch.WELT, 4, 2, LeitmotivEffect.DASH_COST_REDUCTION, 1.0F,
                    "weiter_horizont"),
            node("klangspeicher", LeitmotivBranch.WELT, 5, 2, LeitmotivEffect.RP_CAP, 15.0F,
                    "echopfad"),
            node("weltchor", LeitmotivBranch.WELT, 6, 3, LeitmotivEffect.RP_GAIN, 1.0F,
                    "klangspeicher"),
            node("meisterreise", LeitmotivBranch.WELT, 7, 3, LeitmotivEffect.DASH_COST_REDUCTION, 2.0F,
                    "weltchor"),
            node("luftiger_pfad", LeitmotivBranch.WELT, 8, 4, LeitmotivEffect.DASH_COST_REDUCTION, 1.0F,
                    "meisterreise"),
            node("ferne_harmonie", LeitmotivBranch.WELT, 9, 4, LeitmotivEffect.GOOD_WINDOW, 0.015F,
                    "luftiger_pfad"),
            node("wanderlied", LeitmotivBranch.WELT, 10, 5, LeitmotivEffect.RP_GAIN, 1.0F,
                    "ferne_harmonie"),
            node("grenzenlos", LeitmotivBranch.WELT, 11, 6, LeitmotivEffect.RP_CAP, 20.0F,
                    "wanderlied")
    );

    private static final Map<String, LeitmotivNode> BY_ID = buildIndex();

    private LeitmotivTree() {
    }

    public static List<LeitmotivNode> all() {
        return NODES;
    }

    public static List<LeitmotivNode> branch(LeitmotivBranch branch) {
        return NODES.stream().filter(node -> node.branch() == branch).toList();
    }

    public static Optional<LeitmotivNode> byId(String id) {
        return Optional.ofNullable(BY_ID.get(id));
    }

    private static LeitmotivNode node(
            String id,
            LeitmotivBranch branch,
            int tier,
            int cost,
            LeitmotivEffect effect,
            float amount,
            String... prerequisites
    ) {
        return new LeitmotivNode(id, branch, tier, cost, effect, amount, List.of(prerequisites));
    }

    private static Map<String, LeitmotivNode> buildIndex() {
        if (NODES.size() != NODE_COUNT) {
            throw new IllegalStateException("Expected " + NODE_COUNT + " Leitmotiv nodes, got " + NODES.size());
        }

        Map<String, LeitmotivNode> index = new LinkedHashMap<>();
        for (LeitmotivNode node : NODES) {
            if (index.put(node.id(), node) != null) {
                throw new IllegalStateException("Duplicate Leitmotiv node: " + node.id());
            }
            for (String prerequisite : node.prerequisites()) {
                LeitmotivNode required = index.get(prerequisite);
                if (required == null || required.branch() != node.branch()) {
                    throw new IllegalStateException("Invalid prerequisite " + prerequisite + " for " + node.id());
                }
            }
        }
        for (LeitmotivBranch branch : LeitmotivBranch.values()) {
            if (branch(branch).size() != NODES_PER_BRANCH) {
                throw new IllegalStateException("Expected " + NODES_PER_BRANCH + " nodes in " + branch);
            }
        }
        return Map.copyOf(index);
    }
}
