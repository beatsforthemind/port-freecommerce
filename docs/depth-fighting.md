# Depth fighting: overlapping surfaces

Wherever two surfaces were drawn in the same place, the depth buffer could not decide which one was in front. The winner then changed from pixel to pixel and frame to frame as the visitor walked: the flicker in the owner's six screenshots. This pass finds and removes it across the station. It changes geometry offsets and one renderer option only. Floors, colliders and navigation are unchanged.

## What changed

**The six screenshots**

| Shot | Where | Cause | Fix |
| --- | --- | --- | --- |
| 1 | Lantern lift, Deck 01 | The car floor and lip lay in the deck plane | Raised clear of the deck, as were the landing sills on every deck |
| 2 | Dock throat floor | The throat floor box overlapped the hall's deck plane for a metre | The throat floor starts where the deck ends |
| 3 | North bulkhead from the docks | The rib piers and the dark lintel shared both faces | The piers stop under the lintel instead of running up through it |
| 4, 5 | Residents | Not a depth fight: every sleeve's open top stood 3–7 cm above the sloped shoulder and read as a second torso | Sleeve tops lowered to the shoulder line, for every figure type |
| 6 | Under the east balcony, Deck 01 | A crate was buried in the east ramp, its face in the ramp wall | The crate is no longer drawn. Its collider stays, so navigation is unchanged |

**Concourse hall** (`src/world.js`)

- The balcony soffits on both gallery levels overlapped the slab above them along every edge.
- The roof lining ended flush with the top bulkhead rib, and the service trunks ended in the side shell's end face. Both showed from the docks.
- On the upper side walls, the trunks, conduits and window boxes were sunk into the surface behind them. The roof ribs and lit strips were sunk into the roof lining, and the ceiling service fins lay flush under their dark panel.
- Four Deck 01 wall signs (NOODLES, ORBITAL SUPPLY, CONTRACTS & CLAIMS, SHORT-STAY HABITATS) crossed the wall exchangers. They now hang clear of the exchangers and of the strip glow above them.
- The column strips of the last bay and the last roof rib's strip lay inside the south end wall, and their glow floated out of it. They now stop short of the wall.
- Each Deck 01 shop window's glow card ran 0.88 m into the next column rib. It now stops at the rib.

**Lifts, promenade shops and access** (`src/public-lifts.js`, `src/promenade-shops.js`, `src/storefronts.js`, `src/concourse-access.js`, `src/concourse-upper.js`)

- At all 64 promenade shop ends, the back wall, floor plate and fascia ran into the side cheeks. The shopfront dark panels lay against their edge trims.
- The backlit shop windows stood 10 mm in front of the hall's lit panes, and the open lift gates 5 mm behind their jambs.
- The escalator backing plates lay in the landing slab's edge, and their support braces inside their posts. The bench seat pads were sunk into their plinths.
- The amber edge strips of the promenade and gallery bridges were threaded through the rail posts. On the Lantern Galleries, the inner top rail rested half on the hall's own top rail; it now sheathes it.

**Docks and the moored craft** (`src/district-docks.js`, `src/dock-ships.js`)

- The pier-mouth lintel and the panel above it shared faces. So did the hub glazing and its beams and slabs, the centre-pier canopy and its cheeks, and the side-pier glazing, decks and collars.
- The craft's glazing bands, livery stripes and crown glazing sank into the hull.
- The gate lettering and the throat desk notices stood 3 cm off their backings, and fought when seen down the hall.

**Exchange and observation gallery** (`src/district-market.js`, `src/district-observation.js`)

- The stall counters' front panels and tops shared their end faces. The post tops of one stall were inside its steel rail.
- The doorway walls and the gallery vestibule ended in the concourse shell face.
- The exchange wall ran 2.5 cm behind its rust band and fought from 145–245 m.

**Residents** (`src/population.js`, `src/districts.js`, `src/district-market.js`)

- A seated reader's work collar lay across the face, and the badge floated beside the head.
- Trousers showed through the sides of long coats.
- The hips block was flush with the jacket hem and fought it on figures across the hall.

**Props, signs and effects** (`src/station-life.js`, `src/main.js`, `src/glow.js`, `src/signage.js`, `src/furnishings.js`, `src/commerce.js`, `src/atmosphere.js`, `src/audio-sources.js`)

- The staff-lift cages parked in the Deck 03 gallery floor. They now park 2 cm above it, and the lift's sound follows the cage.
- On the information terminals, the screen stood 1 cm proud of its housing and the lamp bar ends lay against it.
- Glow cards lay behind the service trunks that cross the lit windows. Strip halos lay flat in the plane of faces that also face the eye: column ribs, signs and bridge fascias.
- Signs are offset in depth by a fixed amount as well as by slope, so a sign seen head-on no longer fights its backing.
- Floor prints ran through the feet of benches, planters, boards and ramps. The TRANSIT DOCKS print lay in the top of an inlay, and the traders' prints stood 1–3 cm off their stalls.
- The southern light shaft ran out through the arrivals wall. The dock winch beam lay inside the gantry beam.
- Smaller items: the bench light strip, the tea caravan's posts and the specimen broker's label.

**Depth buffer** (`src/main.js`)

- The renderer is created with `reversedDepthBuffer: true`. Where the browser offers `EXT_clip_control` and stores depth as floats (Chrome on Apple silicon was verified), layers a few millimetres or centimetres apart stop flickering at the far end of the hall. Elsewhere three.js falls back to the ordinary depth buffer with one console warning, and nothing else changes.
- It went in last, because reversed depth makes an exact overlap flicker more as the visitor moves. Every geometry fix was verified with it off.
- Rejected after measurement: a higher near plane (0.1 m is already the most the collision clearance allows), a logarithmic depth buffer (68–105% slower, and it settles exact overlaps by draw order), and global polygon-offset or depth-priority rules (they drag surfaces through what is in front of them at distance).

## Rules for new geometry

- One surface owns each plane. Stop a box at the face it meets. Do not run it into, or flush with, another box.
- A layer meant to read on top stands proud by a deliberate amount, sized to how far away it can be seen. In ordinary 24-bit depth with the 0.1 m near plane, 1 mm holds to about 41 m, 1 cm to about 130 m and 3 cm to about 224 m. The hall is 230 m long.
- No hair-thin offsets, and no global depth bias.
- Glow cards and ribbons must not lie in the plane of a face that faces the eye.

## Measured

Each view is drawn three times at the same instant with the near plane nudged by about 0.1%. Coverage does not depend on the near plane, so the only pixels that can change are depth decisions too close to call. The control noise is 0. The same 910 random standing views were measured before and after, on every deck and in every district, plus 45 long sight lines. All runs used a 1280×800 page with render resolution held fixed, and standard depth:

| Area | Views | Before (unstable px) | After | Change |
| --- | ---: | ---: | ---: | ---: |
| Deck 01 | 150 | 334,486 | 32,135 | −90% |
| Promenade (Deck 02) | 150 | 589,077 | 26,141 | −96% |
| Lantern Galleries (Deck 03) | 120 | 139,755 | 17,463 | −88% |
| Express Overlook (Deck 04) | 100 | 71,137 | 14,102 | −80% |
| Exchange | 120 | 19,723 | 6,658 | −66% |
| Observation gallery | 120 | 15,671 | 9,916 | −37% |
| Docks | 150 | 398,371 | 19,451 | −95% |
| **Total** | **910** | **1,568,220** | **125,866** | **−92%** |
| Long sight lines | 45 | 154,771 | 23,204 | −85% |

Reversed depth was judged by walking instead: 24 steps of 2 mm with the eye, counting pixels that flip in at least 8. The near-plane nudge cannot see exact overlaps under reversed float depth. On the 45 long sight lines, with every geometry fix in, it removes 3,863 flickering pixels and adds 19. Over 210 random standing views in every area it removes 1,974 and adds 209. That run was measured before the last few fixes (the south-wall strips, the window cards and the sign move). Both controls pass: a still frame shows 0 flips, and a known overlap in the unfixed build shows them.

The five screenshot places measure 0–1 unstable pixels after the fixes; the bulkhead view measured 10,048 before.

**Unchanged:** all 55 floors and 372 colliders, and 310,575 walkability probes over every deck. The hidden-concourse culling is still pixel-identical over 180 district poses with reversed depth. The production build passes its verifier, and the page loads with no console errors.

## What is left

- **Knee and elbow seams on residents.** The thigh and calf, and the upper arm and forearm, overlap with almost equal cross-sections. This is the largest remaining source, but it is spread thinly and the two surfaces are the same colour. Removing it means a slimmer lower segment or a polygon-offset material for limbs.
- **Creases** where boxes meet at corners, and the junction line where the dock throat floor meets the hub floor at z −139. Both are sub-pixel at normal field of view.
- **Long-range thin layers on browsers without reversed depth.** These are the gate 07 seams and doors, the hub post bands, and the doubled gallery balustrade at its post junctions, seen from 150–300 m.
- **Not finished in this pass:**
  - the tint line where the district glass passes into its frames
  - the promenade billboards standing inside the ramp wedges (262 px in 3 views, from about 150 m)
  - about 200 px where two areas' fixes meet on the hall floor beyond the gallery doorway, seen from the observation terrace
  - the glow cards in front of the hall's lit shop panes, edge-on

**Found along the way, not depth fighting, for the owner:**

- The first roof bay's ceiling panel and two fins run about 3 m out through the north bulkhead into the sky above the dock throat (`src/world.js`, the roof bay loop).
- The terminal contact shadows are placed at the terminals' original coordinates (`src/furnishings.js`). The exchange terminal has none, and the observation terminal's lies 2.8 m under the floor.
- The collider of the crate removed from the east ramp still keeps walkers 16 cm further from the ramp wall, along 2.7 m. Deleting it, or moving the crate and its collider to open floor, would change navigation slightly.
