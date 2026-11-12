# Lighting and rendering pass

The four items this pass left open are covered in [Ships, signs, typefaces, and sector visibility](ships-signs-and-visibility.md).

This pass acts on a review of the station on real graphics hardware. Earlier passes were measured under software rendering, which reports draw calls, triangles, and submission time but not what the GPU spends per pixel. On hardware the frame is bound by per-pixel shading, and the largest single cost was a bloom chain that visibly changed 1.6% of pixels and kept the scene from being anti-aliased.

## What changed

**Rendering**

- The frame is drawn straight to the canvas with 4× multisampling. The bloom, HDR render target, and output passes are removed.
- A governor watches frame intervals and lowers the pixel ratio in steps when the budget of about 50 frames a second is missed, then raises it again when there is headroom. If fewer pixels buy no time, it concludes the rate is capped by the display or a power-saving mode and restores the resolution. At its lowest ratio it sheds the shadow map and probes as a last resort.
- Translucent layers (dust, vent steam, light shafts, route chevrons, planetary rings) are now blended after tone mapping. Their opacities were retuned against the original for that.

**Lighting**

- One overhead key light, straight down from below the roof zone, owns the only shadow map: 2048 × 4096 over the concourse, refreshed 30 times a second. The roof, its trusses, and cable trays sit behind the shadow camera.
- The hemisphere ground term is now the floor's bounce. Roof bays, bridge soffits, and balcony undersides are readable instead of black; the undersides also use a new, less absorbent soffit paint.
- One reflection probe per sector (128 px, captured once at load from the finished scene) feeds every lit material. The probe changes at a doorway with a short dip instead of a cut.
- Three point lights that lit pools of floor without any fixture are replaced by additive floor pools. Real-time lights go from seven to five.
- People outside the shadow map (the three side districts) get soft contact blobs that follow ramps. Without the shadow map, everyone does.

**Fixtures**

- Light strips get a camera-facing halo, lit panels a soft surround, and floors a pool where a fixture would light them: 448 halos and 189 cards and pools in two instanced draws, built once, with no per-frame uploads.
- Deck-level shop windows show one of four backlit interiors instead of a blank pane.
- Glazing turns paler and more opaque toward a grazing angle.

**Surfaces and sky**

- District walls, trim, and ships use the concourse panel atlas; district floors use a new paving sheet. District boxes are batched per district, so a district out of view is culled.
- Stencilled panel print is mirrored by the way a face looks, so it reads left to right on every wall.
- Signs flip their texture on back faces and read correctly from behind. Backed signs are opaque and write depth; unbacked lettering no longer does.
- Pelagos, its rings, the stars, and a new moon share one sky that follows the eye. The old ringed planet was a 45 m sphere about 100 m outside the gallery, with a second unrelated giant to the north. Both bodies are lit from one sun direction, and the rings hide behind the planet by a ray test rather than a depth buffer.
- The sign typeface is awaited (up to 1.5 s) before any sign is drawn. Previously every sign that asked for it was rasterised in the fallback face.

**Movement and residents**

- The visitor walks at 3.6 m/s and sprints at 7.5 m/s (previously 6.3 and 11). Camera bob and footstep sounds use one step length, derived from ground covered.
- Both crowds play their timetables 1.5× faster. Scaling time instead of editing speeds keeps every calibrated meeting, queue, and crossing in the same relative order. Residents now cruise at a median 1.30 m/s (0.98–1.42), with a 0.68 m step.
- Within about thirty metres, resting residents shift their weight; within four and a half, they may turn their head toward the visitor.
- A resident stops about 1.5 m short of a visitor standing in their path, waits, then makes the lost time up at up to 30% over their usual pace. After roughly four seconds they carry on regardless, so nobody is held indefinitely.
- Residents are solid to a visitor on foot (0.55 m), but a step that moves away from someone is always allowed.

**Defects**

- Transfer couplings no longer cross the airlock doors at gates 06, 07, and 08.
- Seven promenade shops were built from an unlit light colour; their structure now uses lit paint.
- The imported service unit's saturated shell is brought into the station palette.
- One fascia sign that sat directly behind the arrival copy is shown only once the visitor is inside.
- The observation arrival point is beside the compass ring, with the planet ahead rather than a console.

**Loading**

- Floors and colliders are indexed in four-metre cells. The index answers identically to the full scan it replaced.
- Shaders are linked off the main thread before the first frame, including the variants the probe capture needs.
- Model downloads start before the station is built instead of after it.
- Sign textures are sized by the sign's physical width. The four half-metre terminal markers were 1024 × 1024 each.

## Measured cost

Apple M1 Pro, Chromium with Metal, 1440 × 900 viewport at device pixel ratio 2 (a 2304 × 1440 canvas). Frame times are uncapped means over 150 frames, taken as the median of three rounds interleaved between the original and the new build.

| View | Original | Now | Change |
| --- | ---: | ---: | ---: |
| Arrival | 4.25 ms | 3.20 ms | −25% |
| Concourse | 3.98 ms | 3.05 ms | −23% |
| Promenade overlook | 3.99 ms | 2.87 ms | −28% |
| Exchange court | 3.64 ms | 2.22 ms | −39% |
| Dock pier | 3.44 ms | 1.98 ms | −42% |
| Observation terrace | 2.98 ms | 1.83 ms | −39% |

| Budget | Original | Now |
| --- | ---: | ---: |
| Draw calls, concourse main pass | 195 | 189 |
| Draw calls, dock pier | 54 | 44 |
| Shadow pass, 30 times a second | none | 80 calls, 109,000 triangles |
| Real-time lights | 7 | 5 |
| Translucent draws | 37 | 26 |
| Material textures | 92 MiB | 79 MiB |
| Shadow map | none | 32 MiB |
| Full-screen passes | bloom chain and output | none |
| Shader programs | 53 | 105 |

The program count doubles because each material needs a second variant for the probe capture. Both sets are linked asynchronously.

| Loading, development server | Original | Now |
| --- | ---: | ---: |
| Navigation to ready | 1.87 s | 1.37 s |
| Main-thread script, sampled | 1,477 ms | 833 ms |
| Navigation queries | 804 ms | 148 ms |
| Blocking shader link | 220 ms | 96 ms |

## Verification

- Navigation: 2.19 million height and walkability queries on the real station data, including every floor and collider boundary, answer identically to the original implementation. Journey planner statistics are unchanged, and no route is invalid.
- Brightness: at deck level, mean frame brightness is within a few points of the original in the concourse, exchange, gallery, and docks. The promenade is about a tenth darker, because the deck above it now shades it. The share of near-black pixels fell from 56% to 44% looking up at the roof. Beneath the north bridge, where a removed point light used to reach the soffit, it is 17% against 14%.
- Residents: cruising pace, stopping short of the visitor and resuming, and collision at 0.55 m with free retreat were each exercised by script.
- Tiers: a touch-sized browser starts without the shadow map and probes and draws contact blobs for everyone. A simulated slow device steps 1.60 → 1.36 → 1.16 → 0.98 → 0.84 → 0.75, then sheds lighting detail. A simulated 30 Hz cap restores the full ratio and stops. Fast hardware changes nothing.
- Lifecycle: pause, resume, reduced motion, transit to every sector and deck, and page disposal run without browser or shader errors. The production build passes.

## Limits

- Timings are from one machine in an automated browser, with about ±10% between runs. Phones and integrated graphics were not measured; the touch tier and the governor are the provision for them.
- Asynchronous shader linking depends on a browser extension. Without it the first frame links all programs on the main thread, as before, and there are now twice as many.
- The shadow map covers the concourse only, and the probes are static. Trains and the escalator treads move in their vertex shaders and cast no shadows.
- Residents follow fixed paths. One whose patience runs out walks through the visitor rather than around.
- Halos and pools are geometry, not light. They do not illuminate people or walls.
