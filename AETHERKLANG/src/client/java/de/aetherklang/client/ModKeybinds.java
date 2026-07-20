package de.aetherklang.client;

import de.aetherklang.Aetherklang;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import org.lwjgl.glfw.GLFW;

public final class ModKeybinds {
    private static final KeyBinding.Category CATEGORY =
            KeyBinding.Category.create(Aetherklang.id("controls"));

    public static final KeyBinding OPEN_KODEX = register("open_kodex", GLFW.GLFW_KEY_K);
    public static final KeyBinding DASH = register("dash", GLFW.GLFW_KEY_R);
    public static final KeyBinding CYCLE_MOOD = register("cycle_mood", GLFW.GLFW_KEY_M);

    private ModKeybinds() {
    }

    private static KeyBinding register(String path, int defaultKey) {
        return KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.aetherklang." + path,
                InputUtil.Type.KEYSYM,
                defaultKey,
                CATEGORY
        ));
    }

    public static void register() {
        // Static initialization registers the three frozen key bindings.
    }
}
