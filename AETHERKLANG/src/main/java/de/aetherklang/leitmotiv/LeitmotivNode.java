package de.aetherklang.leitmotiv;

import java.util.List;

public record LeitmotivNode(
        String id,
        LeitmotivBranch branch,
        int tier,
        int cost,
        LeitmotivEffect effect,
        float amount,
        List<String> prerequisites
) {
    public LeitmotivNode {
        prerequisites = List.copyOf(prerequisites);
        if (id.isBlank()) {
            throw new IllegalArgumentException("Leitmotiv node id must not be blank");
        }
        if (tier < 0 || cost < 1 || !Float.isFinite(amount)) {
            throw new IllegalArgumentException("Invalid Leitmotiv node: " + id);
        }
    }

    public String titleKey() {
        return "leitmotiv.aetherklang.node." + id;
    }

    public String descriptionKey() {
        return titleKey() + ".description";
    }
}
