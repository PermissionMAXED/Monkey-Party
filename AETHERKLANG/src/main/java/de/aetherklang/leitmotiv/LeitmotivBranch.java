package de.aetherklang.leitmotiv;

public enum LeitmotivBranch {
    KAMPF("kampf"),
    HARMONIE("harmonie"),
    WELT("welt");

    private final String id;

    LeitmotivBranch(String id) {
        this.id = id;
    }

    public String id() {
        return id;
    }

    public String translationKey() {
        return "leitmotiv.aetherklang.branch." + id;
    }
}
