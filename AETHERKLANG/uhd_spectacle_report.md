# Aetherklang UHD Spectacle Report

Date: 2026-07-21

## Result

**PASS — 13/13 requested visual and feature checks demonstrated.**

The Fabric 1.21.9 development client and dedicated development server remained
live throughout the walkthrough. The server used its existing world with
view/simulation distance 4; no out-of-memory failure occurred.

| Check | Result | Evidence under `/opt/cursor/artifacts` |
| --- | --- | --- |
| 64 px textures in inventory and world | PASS | `uhd_inventory_resonance_64px_v2.png`, `uhd_crystals_portal_world_64px.png`, `uhd_texture_atlas_static_64px.png` |
| Animated crystals and portal flipbooks | PASS | `uhd_live_crystals_portal_flipbooks_world.mp4`, `uhd_animated_crystals_portal_flipbooks.mp4`, `uhd_animated_block_flipbook_frames.png` |
| Geometry beams | PASS | `uhd_live_geometry_beam_choral.mp4`, `uhd_geometry_renderer_spectacle.mp4`, `uhd_particle_and_beam_sprite_sets.png` |
| Kammerton parallax sky | PASS | `uhd_kammerton_parallax_demo.mp4`, `uhd_live_kammerton_parallax_photo.mp4`, `uhd_kammerton_skyscape_reference.png` |
| Choral and Motiv emissive entity skins | PASS | `uhd_live_choral_motivs_emissive.mp4`, `uhd_choral_motivs_emissive_clean.png`, `uhd_entity_skin_emissive_atlas.png` |
| Stimmaltar block-entity renderer | PASS | `uhd_stimmaltar_block_entity_animation.mp4`, `uhd_kammerton_live_arrival.png` |
| Fermate geodesic dome | PASS | `uhd_fermate_geodesic_dome_animation.mp4`, `uhd_geometry_renderer_spectacle.mp4` |
| Glass HUD | PASS | `uhd_live_client_initial.png`, `uhd_kanon_live_kammerton.png` |
| UHD Kodex and Leitmotiv screens | PASS | `uhd_live_kodex_leitmotiv_photo_lens_v2.mp4`, `uhd_kodex_screen.png`, `uhd_leitmotiv_screen_current_v3.png` |
| Photo mode (`O`) and resonance lens (`I`) | PASS | `uhd_live_kodex_leitmotiv_photo_lens_v2.mp4`, `uhd_photo_mode.png`, `uhd_resonance_lens.png` |
| Klangflora blocks | PASS | `uhd_klangflora_blocks_live.png`, `uhd_klangflora_texture_atlas.png` |
| New feature: Kanon | PASS | `uhd_live_kanon_kammerton.mp4`, `uhd_kanon_live_kammerton.png` |
| New feature: Sturmfront | PASS | `uhd_kanon_live_kammerton.png`, `uhd_kammerton_live_arrival.png` |

## Build and runtime validation

| Validation | Result |
| --- | --- |
| `./gradlew --no-daemon dependencies` | PASS |
| `./gradlew --no-daemon --max-workers=2 -Dorg.gradle.jvmargs=-Xmx1G genSources check build` | PASS |
| Final `./gradlew --no-daemon --max-workers=2 -Dorg.gradle.jvmargs=-Xmx1G check build` | PASS — `BUILD SUCCESSFUL` |
| Development dedicated server on port 26843 | PASS |
| Development client connected to the server | PASS |
| Core interaction smoke test | PASS — summoned Choral/Motivs, targeted Choral with the tuning fork to render the braided geometry beam, and started a Kanon challenge |

The final build transcript is `uhd_build_green.log`. Minecraft's offline
Mojang/Realms 401 messages and unavailable OpenAL device are expected Cursor
Cloud host limitations and did not block rendering.
