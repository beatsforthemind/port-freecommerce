# Concourse escalators

Fresh agents handled station architecture, ride controls and GPU steps, independent access/performance QA, adversarial physical/art review, and resource review. Six one-way flights connect the main passenger deck (0 m) with the public promenade (7.625 m).

| Bank | Concourse entrance z | Promenade landing z | Horizontal incline run |
| --- | ---: | ---: | ---: |
| Arrivals | 80 | 54 | 26 m |
| Interchange | −30 | −48 | 18 m |
| Departures | −92 | −110 | 18 m |

Each bank has a west-side ascending flight and an east-side descending flight, centered at x ±18.75 m. Amber arrows on the deck and directional arrows on the station map identify the routes. The original ramps and four-level lantern lifts remain available.

## Riding

Walk onto the flat comb area and into the middle of the treads. The belt carries you automatically; no interaction button or destination menu is needed. Look around freely, walk to assist, or step off at the landing. The belt speed is 0.8 m/s. New upper landings project into the concourse and join the promenade through openings in its inner rail, leaving the shop lane intact.

With reduced motion enabled, the moving steps and carry stop while the incline remains walkable in either direction. Pause, help, map, and shop dialogs stop the mechanism; resume continues it. Map transit and return to Arrivals clear movement through the existing control lifecycle. Lantern-lift rides retain priority. Standing on the belt does not create walking bob or footsteps; walking assistance still uses ordinary walking cues.

## Physical access

The flights sit inboard of the promenade, so no shopping floors or overhead slabs need holes. Their supports, underside, side guards, flat ends, and landings have vertically bounded collision volumes. High sections allow real ground-level underpasses. The longer Arrivals incline clears the existing freight porter route; the Interchange bank avoids the concierge and gallery crossing routes; the Departures bank passes beneath the old bridge with headroom.

Player floor sampling captures a transport incline only within one continuous walking step of the previous height. This allows boarding over the ground floor without pulling ground-level visitors onto a high flight. Analytic sloped colliders evaluate height at the player's position, replacing hundreds of potential rectangular segments. Coarse horizontal rejection happens before slope evaluation.

The authored NPC navigation view retains its original floors. Its collision volumes include the new structures; exact plan/timing hashes and physical route samples verify that the existing residents remain clear of the escalators. Existing promenade shoppers, bridges, sunwalks, ramps, upper galleries, and lift landings remain connected.

## Rendering and ownership

Static housings, handrails, combs, arrows, supports, and platforms reuse the station's material batches. They add 5,256 triangles and no new static draws, geometries, textures, or lights. The 318 moving steps and safety nosings share two immutable instance buffers, adding two draws, two geometries, and 4,452 triangles. Six small shader progress values animate the flights; there are no per-frame step matrix uploads.

The total addition is 9,708 triangles, two draw meshes, and two geometries, with no new textures, lights, shadows, postprocessing passes, downloads, or dependencies. Moving-step resources belong to the escalator module; station traversal owns the static architecture. Disposal is idempotent.

## Verification

Measurements, exact source hashes, and production checks are recorded in [escalator-results.json](escalator-results.json). Native and first-person checks cover boarding, all six routes, automatic exits, walking assistance, free look, edge boarding, pause/hidden/reduced motion, map transit, and lift coexistence. Physical tests check the original NPC routes and actual body clearances, not only floor connectivity.

Adversarial review reproduced an unsafe edge-capture strip: belt capture allowed centers ±0.87 m while a complete body only fit ±0.83 m. Matching capture to the complete body-fit boundary (±0.83 m, including the navigation epsilon) prevents stalled edge rides and keeps riders moving after they brush a side guard. The safety nosings render on both faces so they remain legible from below, and the flat backing plates sit below the moving treads to avoid hiding them.

Software WebGL drawing/submission comparisons do not establish hardware GPU or physical-phone frame rates. Functional controls are checked separately from frozen-view render timing.

The Node 24 production build and packaged-asset verification pass. JavaScript is 955.19 kB (281.26 kB gzip), compared with 945.55 kB (277.39 kB gzip) before this pass: approximately 3.87 kB more compressed code. The existing nonfatal Vite chunk-size advisory remains.

Focused final boundary checks cover 42 complete safe-edge rides, 12 unsafe fringe positions that never capture, and 12 actual strafe-to-guard/release cases. All keep moving when the full body fits. Resource checks cover 213,696 simulated shader positions within bounds, unchanged buffers across 600 updates, 12,320 ordinary-floor samples, isolated snapshots, and exactly-once disposal.

The independent desktop/touch walkthrough completes twelve full passive rides (all six flights on both devices), four reduced-motion manual rides, 191 waypoint walking legs, actual touch joystick boarding, 64 shop notices, all four lift stops, map-arrow filtering, map/home carry release, free look, and pause/resume. Static-mesh headroom tests pass 5,610 rays with a 2.20 m sprint-descent camera allowance.

Physical route checks pass 85,178 samples across all sixty authored journeys and 57,620 samples across a full 720-second legacy-commuter period, using a conservative 0.4 m radius and 2 m body. All 1,429 initial rendered population parts remain clear of the new fixtures. Native priority checks independently cover 6,006 samples of incline capture and ground underpasses.

Across twenty-four prewarmed matched desktop/mobile views, visible draw calls increase by zero to two, resident geometries by two, and textures by zero. Submitted triangles increase by roughly 5.3–9.7 thousand depending on visibility (9,708 native geometry triangles added in total). Frozen-camera callback medians vary by −0.2 to +0.3 ms; these are software rendering/submission samples, exclude the normal controller loop, and are not frame-rate guarantees.

Final production walkthroughs start at the real Arrivals spawn and use keyboard or the actual touch joystick throughout, without a mutable placement/test bridge. Both complete ascent, disembarkation onto the promenade, crossing the original bridge, descent, stationary-belt walking with reduced motion, map filtering, and sector transit. Sound is enabled for both runs: more than 1.5 m of passive travel in each direction produces no false footsteps. Software-rendered checks wait for positions rather than treating the run as a frame-rate benchmark; the landing approach waypoint stays clear of the side handrail.
