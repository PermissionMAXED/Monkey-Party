package de.aetherklang.registry;

import de.aetherklang.Aetherklang;
import de.aetherklang.resonance.ResonanceState;
import net.fabricmc.fabric.api.attachment.v1.AttachmentRegistry;
import net.fabricmc.fabric.api.attachment.v1.AttachmentType;

public final class ModAttachments {
    public static final String RESONANCE_ID = "resonance";
    public static final AttachmentType<ResonanceState> RESONANCE =
            AttachmentRegistry.create(
                    Aetherklang.id(RESONANCE_ID),
                    builder -> builder
                            .initializer(ResonanceState::new)
                            .persistent(ResonanceState.CODEC)
                            .copyOnDeath()
            );

    private ModAttachments() {
    }

    public static void register() {
        Aetherklang.LOGGER.debug("Registered player attachment aetherklang:{}", RESONANCE_ID);
    }
}
