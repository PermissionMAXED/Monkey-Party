package de.aetherklang.registry;

import de.aetherklang.Aetherklang;
import de.aetherklang.partitur.PartiturPlayerData;
import de.aetherklang.resonance.ResonanceState;
import net.fabricmc.fabric.api.attachment.v1.AttachmentRegistry;
import net.fabricmc.fabric.api.attachment.v1.AttachmentType;

public final class ModAttachments {
    public static final String RESONANCE_ID = "resonance";
    public static final String PARTITUR_ID = "partitur";
    public static final AttachmentType<ResonanceState> RESONANCE =
            AttachmentRegistry.create(
                    Aetherklang.id(RESONANCE_ID),
                    builder -> builder
                            .initializer(ResonanceState::new)
                            .persistent(ResonanceState.CODEC)
                            .copyOnDeath()
            );
    public static final AttachmentType<PartiturPlayerData> PARTITUR =
            AttachmentRegistry.create(
                    Aetherklang.id(PARTITUR_ID),
                    builder -> builder
                            .initializer(PartiturPlayerData::new)
                            .persistent(PartiturPlayerData.CODEC)
                            .copyOnDeath()
            );

    private ModAttachments() {
    }

    public static void register() {
        Aetherklang.LOGGER.debug(
                "Registered player attachments aetherklang:{} and aetherklang:{}",
                RESONANCE_ID,
                PARTITUR_ID
        );
    }
}
