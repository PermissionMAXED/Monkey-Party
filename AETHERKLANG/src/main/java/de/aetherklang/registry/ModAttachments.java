package de.aetherklang.registry;

import de.aetherklang.Aetherklang;
import de.aetherklang.resonance.ResonanceState;
import net.fabricmc.fabric.api.attachment.v1.AttachmentRegistry;
import net.fabricmc.fabric.api.attachment.v1.AttachmentType;
import net.minecraft.util.Identifier;

public final class ModAttachments {
    public static final String RESONANCE_ID = "resonance";
    public static final AttachmentType<ResonanceState> RESONANCE =
            AttachmentRegistry.createDefaulted(
                    Identifier.of(Aetherklang.MOD_ID, RESONANCE_ID),
                    ResonanceState::new
            );

    private ModAttachments() {
    }

    public static void register() {
        Aetherklang.LOGGER.debug("Registered player attachment aetherklang:{}", RESONANCE_ID);
    }
}
