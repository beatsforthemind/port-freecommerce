# Imported model sources

The selected third-party models come from Poly Pizza and supplement the original procedural environment. They are not official *Murderbot* assets.

| Local asset | Model and creator | Source | License |
| --- | --- | --- | --- |
| `animated-robot.glb` | Animated Robot — Quaternius | [Poly Pizza](https://poly.pizza/m/QCm7qe9uNJ) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `scifi-computer.glb` | Scifi Computer — Quaternius | [Poly Pizza](https://poly.pizza/m/U0xmt6tUlL) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `tree-spiral.glb` | Tree Spiral — Quaternius | [Poly Pizza](https://poly.pizza/m/poFJzEWCk8) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `cooking-pot.glb` | Cooking Pot — Quaternius | [Poly Pizza](https://poly.pizza/m/jAUb3FoCN7) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

Sources and creator credit are retained even though CC0 does not require attribution. Runtime placement, scale, orientation, and any palette adjustments belong to this project.

## Local file inspection

Run `node scripts/inspect-glb.mjs` to inspect the files in `public/models/poly-pizza/`. It reports file sizes, scene-instanced triangle counts, primitive/material counts, animation names and durations, skins, external resources, and base bounds. The bounds describe the default node transforms and do not guarantee the animated skin's full extent.

| Asset | Download size | Scene triangles | Mesh nodes / primitives | Used materials | Textures | Animation |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Animated Robot | 401,024 bytes (391.63 KiB) | 3,237 | 14 / 19 | 3 | 0 | 14 clips, including `RobotArmature\|Robot_Idle` |
| Scifi Computer | 41,964 bytes (40.98 KiB) | 624 | 1 / 5 | 5 | 0 | None |
| Tree Spiral | 35,944 bytes (35.10 KiB) | 748 | 1 / 1 | 1 | 1 | None |
| Cooking Pot | 15,016 bytes (14.66 KiB) | 260 | 1 / 1 | 1 | 0 | None |

All four source files total **493,948 bytes (482.37 KiB)**. These are source-file counts; runtime consolidation and shared instances can reduce draw calls without changing the source models.

The robot's downloaded scene contains more geometry than the site's rounded 1.4k-triangle listing. Its 19 primitives are all indexed triangle lists, not strips. Two hands use skins with 43 joints each; the other body parts are rigid meshes parented to the animated hierarchy. Its default transformed bounds are approximately 6.619 × 4.634 × 2.778 source units, so runtime normalization must account for the idle pose rather than assuming metre scale. The file is self-contained and requires no glTF extensions or external texture files.

Robot SHA-256: `54f1a6999cca701cdc2f8fb67bcd9a283e1154cb80cac356f031bed7c2e74cbe`.

The computer has five untextured color primitives. These can be consolidated with baked vertex colors if their draw-call cost is excessive. Its source bounds measure approximately 0.580 × 2.079 × 0.644 units. The tree already has a single primitive/material with one embedded 512×512 PNG palette atlas (5,276 compressed bytes); its source bounds measure approximately 2.364 × 4.491 × 2.228 units and require horizontal centering. Both files are self-contained and need no glTF extensions or external resources.

Computer SHA-256: `2462a9e43d8ef20636a5be154cb092c17548b9baac2e3538fde7319e9928b923`.

Tree SHA-256: `16b571e404dff48380d8289a92596d41a5b49e75fae9e0151d1a3fc1fc0a4e86`.

The pot is a single untextured primitive. Its source bounds measure approximately 2.418 × 1.076 × 1.992 units, with a minimum Y of −0.412; normalize its base before placing it on a counter. Its dark metal material has metalness 0.4 and roughness approximately 0.415. The computer's five materials share metalness 0.4 and roughness 1, differing only in base color; they are compatible with consolidation that preserves those colors.

Pot SHA-256: `3836f63ea0a1135d1dbb6f8a942af6a1bc27912c21d5112c1820e88c64779995`.

Every downloaded file is self-contained, uses glTF 2.0, and requires no glTF extensions or additional decoder. Only the tree has a texture. Machine-readable source, license, checksum, bounds, and animation metadata are retained in [model-assets.json](model-assets.json).

## Runtime batching validation

The robot's independently animated rigid parts are converted into three weighted color batches while the four original hand primitives retain their skins. This reduces the robot from 19 source primitive draws to seven, keeping all 3,237 triangles and its supplied animation hierarchy. A world-space vertex comparison against the unmodified rig at four idle-animation times, including a translated, rotated, and scaled parent, differed by less than 0.000001 units.

The subsequent adversarial pass combines the computer's five compatible untextured materials into one batch with linear vertex colors. Geometry, normals, colors, and source PBR parameters are preserved; the complete imported module now has a maximum of ten draws instead of fourteen, with the same 7,249 triangles across eight instances. A conservative animated robot sphere stops offscreen rendering and mixer work. Each asset has an eight-second fetch/decode deadline, with aborts and disposal of late results; failed details retain procedural replacements. See [the review](adversarial-review.md) for focused verification and measured scene costs.
