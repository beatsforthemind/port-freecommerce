# Human models and wardrobe

Four fresh agents worked on shared anatomy, the older crowd and stallkeepers, visual/performance verification, and an independent review. The pass updates 76 humans in the main population, 20 older commuters, and four market stallkeepers. The four service robots remain part of the 80-actor population.

## Visual direction

The figures use restrained stylization with adult proportions. The base profile is 1.78 m tall with a 0.26 m head, approximately 6.85 heads tall. A broader jaw, a short chin, a bevelled crown, cropped hair, and a shallow nasal plane give the head a readable silhouette. Eyes and mouth decals are omitted; there are no moving pupils, fixed smiles, photographic skin textures, or facial animation.

Shaped shoulders and waists replace the former cylindrical torsos. Jackets, split coat hems, work collars, aprons, trousers, boots, and practical bags use a shared muted palette. Skin and hands use matte materials. Height variation is restrained, and the same geometry language applies to every human group.

Upper and lower limbs form connected joint chains. Hands follow wrists, footwear follows ankles, and carried bags follow the commuter's pose and heading. Overlapping sleeve/trouser shells and same-batch hinge covers close gaps at strongly bent elbows and knees. Main heads, necks, hands, and boots remain present when distant accessories lose detail.

## Human scale and contact

Bench cushion tops are now 0.55 m above the local floor, with corresponding backs and armrests. Readers sit near the actual front edge, and fixed-length leg IK places shoes on the rendered deck, including stepped and sloped surroundings. Market counters and front displays are lower so grounded adults can work behind them and remain visible at normal eye height. Private stall work recesses replace the former solid visual block.

The existing navigation surfaces, public routes, collider footprints, and vertical collider metadata are preserved. Observation benches register their original collision metadata separately from their lower visual geometry.

## Geometry and updates

| Human group | Before maximum triangles | After maximum triangles | Draw batches |
| --- | ---: | ---: | ---: |
| Main population, including four robots | 17,944 | 18,912 | 7 before / 7 after |
| Older commuters | 3,644 | 4,204 | 4 before / 4 after |

The shared head uses 62 triangles, the shaped torso 20, and tapered limb shells eight. Stallkeeper geometry is merged into the existing matte fabric batch. No per-person draw calls, textures, light sources, model downloads, dependencies, or skeletal-animation assets are added. Population uploads remain capped at 20 Hz; the older commuters retain their 30 Hz cap and visibility checks. Reduced motion freezes the poses.

Each geometry factory returns a separately owned resource. Modules dispose their own geometry and materials, and the helper holds no global disposable geometry cache.

Fourteen stationary standing/seated figures cache their joint and combined part matrices. Transform, floor, seating, or pose changes invalidate the cache; walkers and talking figures continue animating. An equivalence check compared 3,681,104 float values through animation, visibility, and LOD changes without a single difference. In that fixture, static FK builds fell from 1,192 to 14.

## Verification

The close-up review covers front/profile/back views, normal viewing distance, walking midstride, reading poses, social gestures, older commuters, and grounded stallkeepers under station lighting. Initial review found a pointed/receding chin, reversed limb taper, and open gaps at bent joints; those were corrected before the final comparison.

Numerical checks cover joint continuity, stance-foot contact, reader cushion/hip contact, essential-part LOD, finite outward normals, frozen updates, and repeated resource disposal.

## Same-view measurements

The same six viewpoints were measured at desktop 1280×800 and touch-enabled mobile 390×844, both DPR 1. Motion remained enabled, with six warmup frames and 16 sampled callbacks per view.

| Desktop view | Calls before / after | Before CPU median | After CPU median | Before triangles | After triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| Arrival | 193 / 193 | 2.2 ms | 2.6 ms | 105,416 | 111,382 |
| Concourse | 179 / 179 | 2.1 ms | 2.2 ms | 104,896 | 110,482 |
| Observation | 68 / 68 | 1.1 ms | 1.0 ms | 70,991 | 73,715 |
| Market | 90 / 90 | 1.4 ms | 1.4 ms | 70,100 | 73,730 |
| Docks | 66 / 66 | 1.1 ms | 1.0 ms | 66,328 | 70,102 |
| Promenade | 189 / 189 | 2.2 ms | 2.2 ms | 109,732 | 115,088 |

All twelve views retain the same draw calls, texture counts, geometry counts, and render resolution. Submitted triangles increase 3.8–5.7% for the fuller heads, articulated limbs, and covered joints. Affected character buffer arrays increase by 29,852 bytes (about 29.2 KiB), and first-view shader programs increase from 44 to 45. These are measured quality costs; this pass does not have zero runtime cost.

Final callback medians range from 1.0–2.6 ms in this run, with changes up to +0.4 ms in the busiest views. The browser used ANGLE/SwiftShader software rendering; short callback samples do not establish hardware FPS or physical-phone performance. The static-pose cache removes repeated work while preserving the tested poses exactly.

All 23 floor surfaces and 103 district colliders match the baseline. A 71,269-probe walking mask is unchanged, and all four model assets plus the previous ship/transport features remain loaded. Source hashes, full measurements, pose checks, and cache equivalence are retained in [human-results.json](human-results.json).

Final Node 24 production checks pass at desktop and touch-enabled viewports: entry, every sector and the upper promenade, all four GLBs, the 80-actor population, four stallkeepers, and the prior nine ships/two express cabins/two service lifts. There are no JavaScript errors, failed local requests, or Vite development resources in the production page.

Production JavaScript is 860.32 kB (242.17 kB gzip), versus 850.55 kB (238.47 kB gzip) before this pass: about 3.70 kB more compressed code. There are no additional asset requests. The build retains Vite's existing nonfatal bundle-size advisory.
