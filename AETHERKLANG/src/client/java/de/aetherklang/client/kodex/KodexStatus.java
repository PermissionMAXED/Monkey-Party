package de.aetherklang.client.kodex;

import net.minecraft.text.Text;

public enum KodexStatus {
    UNMARKED("", 0xFFB4A7C6),
    PLAYABLE("playable", 0xFF5FF5E0),
    FOUNDATION("foundation", 0xFFF5C95F),
    VISION("vision", 0xFFE989C4);

    private final String id;
    private final int accent;

    KodexStatus(String id, int accent) {
        this.id = id;
        this.accent = accent;
    }

    public int accent() {
        return accent;
    }

    public boolean isMarked() {
        return this != UNMARKED;
    }

    public Text title() {
        return Text.translatable("kodex.aetherklang.status." + id);
    }

    public static KodexStatus byId(String id) {
        for (KodexStatus status : values()) {
            if (status.id.equals(id)) {
                return status;
            }
        }
        return UNMARKED;
    }
}
