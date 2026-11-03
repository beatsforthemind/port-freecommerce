# Adversarial review — November 3, 2026

Three independent reviewers examined navigation/input, rendering/resource ownership, and interface/lifecycle behavior. Findings were reproduced before targeted fixes. This pass fixed **14 confirmed issues: two P1 and twelve P2**. No P0 or unresolved P1 issue was found in the reviewed paths.

## Confirmed findings and fixes

| Severity | Finding and user impact | Fix and evidence |
| --- | --- | --- |
| P1 | A hanging optional GLB blocked the entire station indefinitely. A stalled tree request still left the original loading screen active after 10.5 seconds. | [imported-models.js:82](../src/imported-models.js#L82) bounds fetch and decoding with an 8-second deadline, aborts requests, and disposes late decoder results. Browser test reaches ready with three assets, clears loading, and enters exploration using procedural foliage. |
| P1 | Back/Forward cache entry destroyed the renderer and controls. Restoring that cached document could leave a dead scene. | [main.js:562](../src/main.js#L562) retains the runtime for persisted history entries and refreshes the viewport on restoration. Permanent teardown remains idempotent. Browser lifecycle simulation resumes drawing; the disposal test confirms zero teardown calls for persisted entries. |
| P2 | Resize during model loading was missed; subsequent display-scale changes retained the old pixel ratio and rendering cost. | [main.js:171](../src/main.js#L171) registers sizing before asynchronous loading, synchronizes camera/canvas/composer, and watches resolution changes independently of resize. A 480×800 viewport now gets the correct 768×1280 buffer at the 1.6 cap. At DPR1, canvas and composer both become 481×800 instead of retaining approximately 1.6× resolution. |
| P2 | Immediate E after transit could inspect the previous room's trader or terminal. | [main.js:162](../src/main.js#L162) clears interaction during transit and recomputes it synchronously after teleport and reentry. The focused reproduction now opens the new room's information. |
| P2 | Returning to the arrival camera retained the previous area's audio profile. | [main.js:279](../src/main.js#L279) restores the concourse audio context. Verified against a return from the market. |
| P2 | A movement key pressed during asynchronous pointer-lock acquisition was discarded. | [controls.js:91](../src/controls.js#L91) preserves keys on acquisition and clears them on loss. Both key-order cases now move exactly the same distance; blur, hidden-tab, late-lock, and joystick-cancel resets still pass. |
| P2 | Two north bulkheads and four arrival ribs lacked colliders, allowing the camera into solid geometry. | [world.js:231](../src/world.js#L231) adds six vertically bounded footprints. Former wall positions are blocked while the central dock passage stays open. |
| P2 | The observation entrance's navigation polygon extended beyond its visible pressure hull. A sampled route reached an outside-hull eye position. | [district-observation.js:261](../src/district-observation.js#L261) preserves the actual fan edges and adds only the precise overlap beneath the concourse floor. The redundant oversized connector is removed. All 408 targeted exterior probes are rejected. |
| P2 | Teardown omitted world/terminal resources, instanced buffers, and the bloom/output passes. | [world.js:373](../src/world.js#L373), [districts.js:222](../src/districts.js#L222), and [main.js:572](../src/main.js#L572) dispose owned resources exactly once. Shared architectural atlases survive until their final station owner disposes. Composer user passes are explicitly released. |
| P2 | Reduced motion left the original gyro, planet, lights, drones, and 20-person crowd advancing and uploading matrices. | [world.js:365](../src/world.js#L365) and [districts.js:162](../src/districts.js#L162) use local paused clocks. A 1,000-update test produces no motion or uploads, and resumption advances only by the next delta. |
| P2 | Reverse commuters could escape their route after roughly 33 minutes because JavaScript remainder became negative. | [districts.js:195](../src/districts.js#L195) uses positive modulo. A 3,005-second simulation stays within route bounds. |
| P2 | Legacy commuter lanes crossed the tea cart and specimen display. | [districts.js:138](../src/districts.js#L138) uses clear lanes at x=±5.2 and ±7.7. All 20 complete routes pass 31,220 samples against 200 footprints, including a 0.8 m baggage envelope. At least 8.8 m of clear central width remains. |
| P2 | Travelers visible through two district doorways were incorrectly culled, then popped in when the viewer entered the concourse. | [population.js:218](../src/population.js#L218) requires both doorway intersections instead of rejecting every cross-branch sightline. Clear/reverse rays, blocked rays, and 18 exact boundary cases pass. |
| P2 | Mobile sound/fullscreen controls and HUD shortcuts had small hit areas. | [style.css](../src/style.css) gives those touch controls at least 44×44 px hit areas and enlarges close/setting targets. The mobile layout still fits without horizontal overflow. |

## Performance upgrades

- Five untextured console color regions become one vertex-color batch. Imported maximum draw calls fall **14→10**, with the same 7,249 triangles and eight placements. Position, normal, color, and bounds comparisons preserve the supplied model.
- The robot uses a conservative animated sphere and current camera frustum. Its seven draws and mixer updates stop when it is fully off camera. Edge-of-frame and idle-pose checks find no false culling.
- The original crowd's four meshes use one conservative route-box visibility test. Hidden crowd uploads stop; current poses restore on reentry, including during reduced motion.
- The three machine batches use analytically expanded bounds for every shader motion branch. Tests cover tram wrapping, cleaner motion, brush and arm rotation, winch motion, cable scaling, parent transforms, and more than 250,000 vertex poses.
- Paused menus render their scene background at at most 15 Hz while station simulation and input scheduling continue. A synthetic 60-tick test performs 13 paused renders versus 60 exploring renders. The software browser was already below this cap, so its measurements do not establish a hardware saving from this change alone.
- Navigation retains its simple scan: the measured baseline was approximately 3.2 microseconds per query. A more complex broad phase was not justified. Constant body probes are reused and nonfinite coordinates are rejected.

## Measured rendering comparison

Same harness and sector spawn points, desktop 1280×800 at DPR1. CPU values are medians of the main animation callback, including render submission. Draw counts include bloom/output.

| View | Before calls | After calls | Reduction | Before CPU | After CPU | After triangles |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Arrival | 195 | 191 | 2.1% | 2.1 ms | 2.1 ms | 105,440 |
| Concourse | 183 | 179 | 2.2% | 1.9 ms | 1.9 ms | 104,924 |
| Observation | 79 | 68 | 13.9% | 1.0 ms | 1.0 ms | 71,019 |
| Exchange | 105 | 91 | 13.3% | 1.4 ms | 1.4 ms | 70,352 |
| Docks | 70 | 66 | 5.7% | 1.1 ms | 1.1 ms | 66,452 |

At 390×844, submitted calls change **165→154**, **162→151**, **79→68**, **97→83**, and **65→61** respectively. Mobile concourse median submission time changes from approximately 1.9 to 1.5 ms. All ten views report no browser or shader errors.

The browser uses ANGLE/SwiftShader software rendering. GPU timer queries are unavailable. These short samples establish bounded submission/geometry savings, not hardware FPS or power-consumption guarantees. Animated population visibility can change triangle counts between captures.

## Verification

- All **90,481** walkable half-metre samples form one connected component with **200** static collision footprints.
- All authored crowd loops, eight ramp/bridge/edge controller scenarios, every spawn, terminal approach, district landmark approach, and all 80 newer inhabitants remain valid.
- Six focused input/reset cases pass.
- Desktop terminal reading, sound enable/mute, reduced-motion freezing, and mobile upper-deck joystick movement pass.
- Normal loading retains all four models. A deliberately stalled tree request reaches usable exploration with its procedural fallback; late decoding is cleaned up.
- Resource-disposal tests are idempotent and verify shared-atlas ownership.
- Production build passes: JavaScript 843.47 kB, 235.92 kB gzip. No dependencies were added.

Machine-readable measurements and focused proof summaries are retained in [review-results.json](review-results.json).

## Remaining work and scope limits

**P3 — first-load bundle:** Vite still reports one JavaScript chunk above 500 kB. Splitting optional loading/decorative code is a future `/optimize` opportunity. Moving bytes between chunks alone would not reduce the total payload; improving first interaction further would require progressive initialization of optional models.

The history test exercises the persisted page-transition lifecycle directly. Actual Back/Forward cache eligibility varies with browser features and active connections. Hardware GPU profiling, a formal screen-reader/contrast audit, and a broad physical-device matrix remain outside this pass.

## Supplemental interface health

These are scoped reviewer judgments, not a conformance certification.

| Dimension | Score / 4 | Evidence / limit |
| --- | ---: | --- |
| Accessibility | 2 | Keyboard/transit, labels, reduced motion, and larger touch targets work; nonvisual spatial exploration remains limited. |
| Performance | 3 | Measured call savings and bounded updates; optional startup still waits for assets/deadline and the main bundle remains large. |
| Responsive design | 3 | Desktop and 390×844 checks pass; broader device/text-scaling coverage is still needed. |
| Theming | 3 | HUD tokens and intentional station palettes remain consistent; many art-direction colors are module-local. |
| Interface anti-patterns | 4 | The world remains the focus, with distinct spatial districts and restrained supporting controls. |
| **Total** | **15 / 20 — Good** | Critical reviewed failures were fixed; remaining work is concentrated in first-load and broader accessibility validation. |

Preserve the shared material batches, limited animation upload rates, opt-in synthesized audio, procedural failure fallbacks, and floor metadata shared by walking, crowds, and the map. After future feature work, use `/audit` to revisit behavior, `/optimize` for measured loading changes, and `/polish` for a final interface pass.
