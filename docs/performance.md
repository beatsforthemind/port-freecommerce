# Environment detail pass — performance comparison

Three fresh agents independently implemented architectural surfaces, district detail, and atmosphere. Integration added batched passenger furnishings, cached terminal orientations, and HUD updates that run only when values change.

## What changed

- Architectural panels: seams, rivets, grilles, maintenance stencils, warning stripes, brushed wear, and baked surface relief. An additional 354 service boxes, cable trays, vents, and fasteners reuse existing material batches.
- Districts: orbital charts, instrument displays, window etching, stocked stall displays, vendors, textiles, varied travelers carrying luggage, branching foliage, dock machinery, and cargo identifiers.
- Concourse: eight seating/planter islands, four departure displays, wayfinding decals, and baked contact shadows, all in six static material batches.
- Atmosphere: 1,040 bounded GPU particles, twelve feathered light-shaft quads, animated route chevrons, and three distant vessels. Five draw calls, 420 triangles, no simulation loops or animated texture uploads.

The pass uses four new shared 1024×1024 textures, approximately 21.3 MiB including mipmaps. It adds no real-time lights, shadow maps, or postprocessing passes. All geometry and texture generation happen once at startup. Reduced motion freezes the new atmospheric animation.

## Same-view rendering comparison

Desktop viewport: 1280×800, device pixel ratio 1. Draw calls include the existing bloom/output passes. CPU values are medians of the main animation callback, including update and render submission. Original and enhanced sources were served separately and measured with the same browser harness.

| View | Original calls | Enhanced calls | Original CPU | Enhanced CPU | Enhanced triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| Arrival | 155 | 169 | 1.5 ms | 1.5 ms | 66,254 |
| Concourse | 143 | 157 | 1.4 ms | 1.4 ms | 66,002 |
| Observation | 51 | 64 | 0.7 ms | 0.7 ms | 57,490 |
| Exchange | 69 | 73 | 0.8 ms | 0.8 ms | 50,274 |
| Docks | 62 | 68 | 0.9 ms | 0.8 ms | 51,416 |

The representative concourse view adds 14 calls (9.8%) and 12,458 triangles. Across the five desktop views, total submitted calls increased 10.6%. Mobile-sized checks at 390×844 showed main-loop CPU medians between 0.8 and 1.2 ms, versus 0.7–1.2 ms in the original.

The automated browser used ANGLE/SwiftShader software rendering. GPU timer queries were unavailable, and frame intervals varied substantially. These measurements support the bounded geometry/submission cost; they are not a hardware frame-rate guarantee. No display-resolution reduction was used to obtain these comparisons.

## Verification

- Production build passes.
- All five desktop and five mobile-sized benchmark views render without browser or shader errors.
- Connectivity check using all 127 current colliders: all 73,425 walkable half-metre samples belong to one component. Every sector spawn, branch threshold, and terminal approach remains reachable.
- First-person movement, transit, terminal reading, sound, pause, reduced camera motion, and touch joystick regression checks pass against the enhanced scene. Neither desktop nor mobile layouts overflow; no browser errors were reported.

## Inhabited-station pass

A subsequent three-agent pass adds 80 inhabitants, four trading vignettes, and automated station work. It keeps the prior detail and renderer configuration.

| New module | Draw calls | Maximum geometry | New textures |
| --- | ---: | ---: | ---: |
| Population | 7 | 17,836 triangles, before visibility/detail culling | 0 |
| Independent traders | 7 | 6,730 triangles | One 1024² atlas |
| Tram, cleaners, repair cell, dock winch | 3 | 3,096 triangles | 0 |

The population uses seven shared instanced meshes, uploads at most 20 times per second, compacts away inhabitants hidden behind sector walls, and omits subpixel accessories at distance with hysteresis. Portal checks preserve figures visible through the broad doorways. Camera movement still refreshes visibility when animation is reduced; frozen poses stay unchanged. The new machines animate entirely in their vertex shader. No lights, shadow maps, or full-screen passes are added.

Same 1280×800 software-rendered harness, comparing the preceding detail pass against the populated station:

| View | Before calls | Populated calls | Before CPU | Populated CPU | Populated triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| Arrival | 169 | 186 | 1.4 ms | 1.8 ms | 87,648 |
| Concourse | 157 | 174 | 1.4 ms | 1.6 ms | 88,212 |
| Observation | 64 | 76 | 0.8 ms | 0.8 ms | 68,568 |
| Exchange | 73 | 90 | 0.9 ms | 1.1 ms | 67,368 |
| Docks | 68 | 78 | 0.8 ms | 1.0 ms | 62,704 |

The representative concourse adds 17 calls (10.8%) and 0.2 ms median main-loop CPU time. These are submission costs, not hardware FPS guarantees; the software-renderer limitation above still applies. Source geometry stays below 90,000 submitted triangles in these views.

The final static navigation audit includes 132 colliders: all 73,043 walkable half-metre samples remain connected, including every original terminal, sector spawn, and all four new trader approaches. Trader inspection and optional nearby voices/notices use the existing interface; the soundscape remains opt-in and synthesized locally.

Final browser regression passes: nearby conversation display and toggle, tea-caravan inspection, mouse look, reduced motion, sound enable/mute, transit through all sectors, solid trader footprints, and mobile joystick/transit. No browser or shader errors were reported, and the mobile layout does not overflow. The production build passes.

## Poly Pizza model integration

Four self-contained CC0 GLBs total 493,948 bytes (482.37 KiB): one animated service robot, two information consoles, three spiral plants, and two cooking vessels. Static copies share geometry and materials through instancing. Imported plants, cookware, and consoles replace their procedural counterparts; a failed asset load retains the corresponding procedural detail.

The imported module has a maximum of 14 material draws, 7,249 triangles across eight placements, and one shared 512² texture. The robot's rigid animated parts are consolidated into three weighted material batches, reducing its source scene from 19 primitive draws to seven without changing its animation. Only its supplied idle clip runs, at a bounded 20 Hz update rate with distance culling and reduced-motion support. No new lights, shadows, or full-screen effects are added.

Same desktop viewport and software-rendered harness as above:

| View | Populated calls | Imported calls | Populated CPU | Imported CPU | Imported triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| Arrival | 186 | 195 | 1.8 ms | 2.7 ms | 93,649 |
| Concourse | 174 | 182 | 1.6 ms | 1.9 ms | 93,621 |
| Observation | 76 | 76 | 0.8 ms | 1.0 ms | 69,296 |
| Exchange | 90 | 98 | 1.1 ms | 1.4 ms | 71,641 |
| Docks | 78 | 78 | 1.0 ms | 1.3 ms | 62,704 |

The concourse adds eight submitted calls (4.6%) and approximately 5,400 triangles. Mobile-sized views at 390×844 submit 171, 168, 76, 94, and 70 calls respectively. These short SwiftShader samples describe submission cost and geometry bounds; GPU timings are unavailable and the results do not establish hardware frame rates.

Verification passes: all four GLBs return successfully, the supplied robot idle clip animates, the imported observation console opens its existing information panel, all sectors and spawn points remain reachable, the three new solid footprints block movement, mobile movement works without layout overflow, and a deliberately failed tree request restores procedural foliage while the station reaches ready. No browser or shader errors occur during normal loading. The production build includes byte-identical copies of all four original GLBs. Source URLs, licenses, hashes, and inspection details are in [model-assets.md](model-assets.md).

## Distinct district architecture

The rectangular side rooms have been replaced by a fan-shaped observatory, a winding bazaar, and an octagonal departure hall with three boarding piers. The concourse gains two usable ramps, a public promenade, and two bridges. Static boxes remain instanced by material; repeated custom architecture is merged. No lights, shadow maps, or full-screen passes are added.

| View | Before calls | New calls | Before CPU | New CPU | New triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| Arrival | 195 | 195 | 2.7 ms | 2.1 ms | 105,440 |
| Concourse | 182 | 183 | 1.9 ms | 1.9 ms | 104,924 |
| Observation | 76 | 79 | 1.0 ms | 1.0 ms | 75,955 |
| Exchange | 98 | 105 | 1.4 ms | 1.4 ms | 79,089 |
| Docks | 78 | 70 | 1.3 ms | 1.1 ms | 70,096 |

The desktop view remains 1280×800 at DPR1. Ten desktop/mobile views report no browser or shader errors. Mobile-sized views submit 165, 162, 79, 97, and 65 calls respectively, with median main-loop submission times between 1.0 and 2.1 ms. These are short software-rendered samples, not hardware frame-rate guarantees. The sector views now use different floor plans and spawn points, so the comparison describes the cost of each experience rather than pixel-identical compositions.

The same 80 inhabitants are redistributed onto the actual circulation: eight promenade commuters, winding market loops, slow gallery walks, and boarding queues. Seven population batches and the 20 Hz upload limit remain. The optional audio pass adds one shared gain node; transient voices are capped at twelve.

Navigation verification includes 194 combined collision footprints. All 90,640 walkable half-metre samples across ground floors, ramps, terrace, and upper bridges form one connected component. Authored crowd routes pass 10 cm collision sampling. Real controller simulations pass complete ascent/descent on both concourse ramps and the observation ramp, bridge crossing, and upper-edge protection. Every sector spawn, terminal approach, district inspection point, and initial population position is valid. The observation computer and its collider are placed on the 2.8 m terrace.

The final browser walkthrough also passes upstairs transit, a concourse ramp descent, observation ramp ascent and terminal reading, the full winding market route to the common court, dock terminal reading, sound enable/mute, and reduced-motion freezing. A touch-sized browser can transit upstairs and move across the bridge with the joystick, with no horizontal layout overflow. All four imported assets remain loaded. The final production build passes.

## Adversarial review and optimization

The follow-up review fixes loading/lifecycle/input/collision edge cases and safely removes invisible work. Console material consolidation reduces imported draws from 14 to 10. Conservative robot, legacy-crowd, and analytically bounded machine visibility checks avoid offscreen submissions. Simulation remains active behind paused menus while scene rendering is capped at 15 Hz. Reduced motion now freezes the original world and crowd too.

| View | Architecture-pass calls | Reviewed calls | Reviewed CPU | Reviewed triangles |
| --- | ---: | ---: | ---: | ---: |
| Arrival | 195 | 191 | 2.1 ms | 105,440 |
| Concourse | 183 | 179 | 1.9 ms | 104,924 |
| Observation | 79 | 68 | 1.0 ms | 71,019 |
| Exchange | 105 | 91 | 1.4 ms | 70,352 |
| Docks | 70 | 66 | 1.1 ms | 66,452 |

Mobile call counts become 154, 151, 68, 83, and 61 respectively. The mobile concourse's median callback submission time is approximately 1.5 ms versus 1.9 ms in the preceding pass. Normal main-hall geometry is retained; phone views correctly omit the robot when it is outside the narrower view. The software-renderer and short-sample limitations above still apply.

With six missing wall colliders added and the observatory floor boundary corrected, all 90,481 walkable half-metre samples remain connected across 200 footprints. All 20 older commuter routes are also clear of props, including a conservative baggage envelope. The [adversarial report](adversarial-review.md) records the complete findings, focused tests, before/after data, and the remaining first-load bundle opportunity.
