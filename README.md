# Port FreeCommerce

A vast, explorable first-person space station built with [Three.js](https://threejs.org/). An original, unofficial fan interpretation inspired by the commercial stations of Martha Wells’s *The Murderbot Diaries*. Architecture, signs, planets, crowds, and sound are procedural. Selected CC0 foreground models by Quaternius are packaged with the project; the four GLBs total about 482 KiB and need no third-party runtime requests.

## Run locally

```sh
nvm use
npm ci
npm run dev
```

Use Node 24 (`.nvmrc`); run `nvm install` first if that version is not installed.

Open the local URL printed by Vite. For a production build:

```sh
npm run build
npm run preview
```

The build outputs a static site to `dist/`, suitable for any static host. WebGL 2 and hardware acceleration are required. The typefaces are served from the site itself, so nothing is requested from another host. No backend, account, or API key is needed.

## Deploy through Vercel

The project includes Vercel configuration for a static Vite deployment with Node 24, reproducible dependency installation, and asset caching. Every production build checks the compiled files, the three packaged typefaces, and all four packaged models, including their credits. No environment variables are required.

From this folder, run `vercel` for a preview deployment, then `vercel --prod` when ready to publish to production. See [deployment instructions](docs/deployment.md) for settings, validation, and the Git import alternative. These commands publish to your selected Vercel account; preparing this project does not create a deployment.

## Explore

- **WASD / arrows:** walk. **Shift:** move faster.
- **Mouse:** look around. If pointer lock is unavailable, click and drag the scene.
- **E:** read nearby public information terminals.
- **Escalators:** step onto a flight; west-side units go up to Deck 02 and east-side units return to the concourse. Look around or walk to assist. With reduced motion, walk the stationary steps.
- **E by a lantern lift:** call it; step inside and press **E** again to choose a deck. The touch interaction button does the same.
- **E near independent traders:** inspect their wares and discover short environmental stories.
- **M:** open the sector map and transit between sectors.
- **H / ?:** controls and reduced camera motion.
- **Escape:** pause and release the mouse.
- On touch screens, move with the left joystick and drag the right side to look.
- Sound and fullscreen can be toggled in the upper right. Sound is off initially. Controls includes volume and an optional footstep setting; these preferences are remembered locally.

Four physically connected sectors are walkable: the monumental concourse, the planetary observation gallery, the commercial exchange, and transit docks. The sector map provides instant transit. Public terminals contain original station notices and environmental stories. Find all four sectors at your own pace.

The sectors now have distinct architecture and circulation:

- **Concourse:** six escalators form three up/down pairs between the passenger deck and promenade; panoramic lantern lifts connect four public decks, from street-level arrivals to the express overlook. Both Deck 02 walls form a trading street of 32 independent shops and stalls. Amber ramps climb to the promenade, outer sunwalks reach the Arrivals balconies, and two new skybridges connect the Lantern Galleries. The map offers direct transit to every deck.
- **Observation:** a narrow vestibule opens into a faceted fan with reading alcoves, roof petals, and panoramic glazing. A broad ramp rises 2.8 m toward the planet-facing terrace.
- **Exchange:** low overlapping canopies shelter a winding street around irregular shop islands. Follow the bends to the common table, food stalls, and repair lane.
- **Docks:** customs opens into a tall octagonal holding hall. Three glazed piers branch toward the local shuttle, long-haul liner, and freight tender.

Travelers follow each area's real routes; readers sit on both observation levels and commuters cross the upper bridges. The map traces the actual public floors, including raised routes. The optional soundscape changes with each area's use and softens the crowd upstairs.

## Project structure

| File | Purpose |
| --- | --- |
| `src/main.js` | Renderer, frame loop, interface, sectors, transit, interaction |
| `src/lighting.js` | Light rig, the concourse shadow map, per-sector reflection probes, detail tiers |
| `src/render-governor.js` | Adaptive pixel ratio that holds the frame budget, then sheds lighting detail |
| `src/glow.js` | Fixture halos, lit-panel surrounds, and floor light pools in two instanced draws |
| `src/contact-shadows.js` | Soft blobs under people the shadow map does not reach |
| `src/sky.js` | Stars, the ringed giant Pelagos, and its moon, placed at infinity with one sun |
| `src/signage.js` | One shared lettering sheet for every plain sign, readable from both sides |
| `src/visibility.js` | Sorts what lies inside the concourse and skips it while no opening to it is in view |
| `src/world.js` | Batched concourse architecture, balconies, floor, navigation sculpture |
| `src/storefronts.js` | Backlit deck-level shop windows from one shared sheet |
| `src/districts.js` | Shared district batching, signs, travelers, and drones |
| `src/district-observation.js` | Fan-shaped observatory, ramp, terrace, ringed planet, and quiet alcoves |
| `src/district-market.js` | Irregular bazaar, winding streets, canopies, shop islands, and common court |
| `src/district-docks.js` | Octagonal departure hall, branching boarding piers, pressure locks, and the berths of three craft |
| `src/dock-ships.js` | The liner, shuttle, and freight tender: lofted hulls, one mesh each, lit by the star and the planet |
| `src/concourse-access.js` | Public ramps, escalator housings and landings, bridges, rails, and floor metadata |
| `src/concourse-upper.js` | Lantern galleries, skybridges, express overlooks, and Arrivals sunwalks |
| `src/concourse-levels.js` | Shared public floor heights and lift-shaft layout |
| `src/public-lifts.js` | Rideable panoramic lift cars, landing gates, calls, and travel state |
| `src/escalator-layout.js` | Shared flight positions, landing connections, and balustrade openings |
| `src/escalators.js` | GPU moving treads, direction nosings, automatic belt carry, and reduced-motion access |
| `src/promenade-directory.js` | Original business catalog and a shared atlas for storefront signs and counter notices |
| `src/promenade-shops.js` | Eleven types of stocked shops and stalls along both promenade walls |
| `src/promenade-keepers.js` | Stationary merchants in one mesh, sharing the established human proportions |
| `src/navigation.js` | Shared polygon floors, height sampling, vertical collisions, sector classification, and a cell index for fast queries |
| `src/station-plan.js` | Station map generated from the real public floors |
| `src/surfaces.js` | Cached procedural panel albedo/normal atlases and district paving, with physically scaled UVs |
| `src/furnishings.js` | Batched seating, planters, departure boards, decals, baked contact shadows |
| `src/atmosphere.js` | GPU dust, vent steam, light shafts, route chevrons, exterior traffic |
| `src/population.js` | Diverse travelers, readers, social groups, workers, and service units |
| `src/population-behavior.js` | Public-floor route compilation and distance-paced activity schedules |
| `src/population-timetable.js` | Coordinated periods and prevalidated journey departure phases |
| `src/commuter-behavior.js` | Concourse transfer, arrival, shopping, and messenger itineraries |
| `src/humanoid.js` | Shared adult proportions, restrained head shapes, tailored torsos, tapered limbs, and wardrobe palettes |
| `src/travel-gear.js` | Shared fitted travel packs and connected shoulder straps, clear of arm movement |
| `src/commerce.js` | Tea caravan, specimen broker, salvage workshop, suspended seed library |
| `src/station-life.js` | Scheduled freight and express services, staff lifts, cleaners, repair cell, dock winch |
| `src/imported-models.js` | Local GLB loading, scale/origin normalization, static instancing, animated service robot |
| `src/controls.js` | First-person movement, collision queries, pointer lock, mouse/touch fallback |
| `src/gait.js` | The visitor's walking and sprinting pace, and the step length shared by camera and footsteps |
| `src/audio.js` | Optional room ambience, shared reflections, PA cues, volume, and audio lifecycle |
| `src/audio-sources.js` | Directional machinery, synchronized transport cues, and movement-paced footsteps |
| `src/kit.js` | Shared geometry and material helpers |
| `src/style.css` | Arrival view, exploration HUD, dialogs, responsive touch interface |
| `src/fonts/` | The two typefaces as WOFF2 subsets, with their sources and rebuild steps |

Architecture and repeated props use material-based instancing. The renderer draws straight to an anti-aliased canvas, adapts pixel density to hold its frame budget, keeps one shadow map for the concourse, and pauses rendering in background tabs. It respects the system reduced-motion setting, with an in-app override for camera motion. To extend a district, add geometry, vertically bounded colliders, floor polygons or ramp surfaces, and population routes to its builder. Walking, crowd placement, terminal heights, and the station plan share that floor metadata.

The detail pass adds worn metal panels, grilles, surface relief, service equipment, passenger rest areas, stocked counters, vendor displays, cargo labels, and orbital instruments. Four shared 1024² textures supply the new surface/print detail. Atmospheric motion runs in shaders on immutable geometry; contact shadows are baked decals. No additional lights, shadow maps, or full-screen effects are introduced. Crowd matrix uploads are limited to 30 Hz, and HUD text changes only when its value changes. See [the performance comparison](docs/performance.md) for measured rendering costs and test limitations.

The inhabited-station pass adds 80 more inhabitants in seven instanced batches, with varied travel clothing, respirators, augmentations, bags, seated readers, and social groups. Doorway visibility culls people hidden by sector walls, and distant accessories use simpler detail; uploads cap at 20 Hz. Four independent traders create new places to visit and inspect. A cargo tram, cleaners, repair manipulators, and a dock winch keep the station working around its passengers. Optional nearby voices and notices reveal short original stories; disable them from Controls. When sound is enabled, the synthetic soundscape changes between the market, observation gallery, concourse, and docks. It uses no recorded dialogue, downloads, or speech services.

The human-model pass gives all 100 human figures a consistent style: adult proportions, shaped jackets, muted travel clothing, natural skin tones, cropped hair, and quiet facial planes. Hands and boots follow connected limb chains; readers sit on benches scaled to their bodies, and stallkeepers stand behind counters at a natural working height. Shared geometry retains seven population and four commuter batches, with no new textures or model downloads. See [human models](docs/human-models.md) for visual choices, measured costs, and close-up verification.

The accessory correction replaces side-mounted satchel blocks and wrist luggage proxies with shallow, visibly strapped travel packs. The packs sit clear of the animated arms and share the existing character batches. See [NPC accessories](docs/npc-accessories.md) for the screenshot diagnosis and focused verification.

The traffic pass gives the overhead freight train a coupled three-wagon consist and adds a separate two-cabin express service. Both ease into physical berths, wait, and reverse. Express doors open toward the platforms; two guided service lifts connect the express berths to the staff galleries. Nine exterior couriers, freighters, shuttles, and tenders follow separate flight lanes, with clearance holds, turns, departures, drive apertures, and navigation beacons. All movement uses the existing GPU batches, with no new textures, lights, downloads, or per-object CPU simulation. Reduced motion freezes the service clocks. See [traffic performance](docs/traffic-performance.md) for budgets, comparisons, and verification limits.

The audio pass gives the concourse long reflections, the exchange a closer social atmosphere, the gallery a quiet bed, and the docks heavier ventilation and hull texture. Nearby freight, express cabins, service lifts, repair tools, and a market kettle change direction and level as you move. Footsteps follow actual movement and change with the deck surface. Transport cues share the visible service clock; muted and hidden pages suspend audio processing. Sound stays opt-in, with no recordings, network requests, or speech services. See [the audio experience](docs/audio-experience.md) for controls, resource budgets, and validation.

The journey pass gives the existing inhabitants destinations and activities: passengers meet arrivals and wait at the docks, shoppers visit real counters, gallery visitors stop to watch the planet, and messengers make handovers. Four service units perform small station errands. Fourteen journeys connect sectors and two use the public promenade ramps. Walking follows continuous return paths, with acceleration, braking, turns, and strides paced by distance. Separate market lanes and coordinated timetables keep through traffic clear of waiting customers. The population retains its seven batches and the other commuters retain four; no assets or dependencies are added. See [NPC behavior](docs/npc-behavior.md) for routines, performance measurements, and validation.

The vertical-access pass opens every concourse floor: the public deck, promenade, Lantern Galleries, and Express Overlook. Two rideable lantern lifts beside the northern rest bays provide continuous first-person travel with free look. New bridges and guarded walks connect the upper galleries and the formerly isolated southern balcony caps. Reduced motion offers quick travel, and the floor-aware map provides direct deck transit. Existing NPC routes and timings remain identical. See [concourse access](docs/concourse-access.md) for routes, controls, safety checks, and rendering costs.

The promenade trading street adds thirty-two original businesses across both walls of Deck 02: atmosphere tasting, alien botany, memory jewelry, pressure-suit repair, multi-form tailoring, navigation, food, and other interstellar services. Distinct counters, canopies, instruments, plants, specimens, fabric, and machinery give the windows physical depth. Inspect any shop with **E** or the touch button for its story; sage marks on the floor map locate the traders. The existing lift landings, bridge approaches, ramp entries, and sunwalks remain clear. See [promenade shops](docs/promenade-shops.md) for the directory and measured costs.

The escalator pass adds three paired banks at Arrivals, Interchange, and Departures. Six flights connect the public deck to the trading promenade with automatic boarding, free look, and optional walking assistance. Side guards and new landings join the promenade without cutting its shopping lane. Moving treads use shared instance buffers and shader motion; reduced motion freezes the mechanism while keeping the steps walkable. The old ramps and four-level lifts remain available. See [escalator access](docs/escalators.md) for routes, controls, measured costs, and verification.

The lighting and rendering pass replaces the bloom chain with direct, anti-aliased rendering, and spends the time it frees on things the station lacked. An overhead key light casts the hall's only shadow map, so balconies, bridges, kiosks, and people are grounded; people in the side districts get soft contact shadows instead. One reflection probe per sector, captured once at load, gives the metal something to reflect. Light strips, lanterns, and shop windows gain halos and floor pools from two instanced draws, with no added lights; three point lights that had no fixture are gone. The side districts share the concourse's panel surfaces and get their own paving. Outside, a single sky replaces two unrelated gas giants: Pelagos to the east and its moon to the north, both at infinity and lit by one sun. Signs now read correctly from behind, stencilled print is no longer mirrored on half the walls, and the sign typeface is loaded before any sign is drawn.

The same pass makes the station feel inhabited at walking pace. The visitor walks at 3.6 m/s and sprints at 7.5, with camera bob and footsteps driven by one step length. Residents walk at about 1.3 m/s on the same calibrated timetables, played half as fast again. Nearby residents shift their weight, glance at a visitor who comes close, stop for someone standing in their path and then make the time up, and can no longer be walked through. Frame time on the test machine fell by 23–42% with all of this enabled, and the load is about a quarter faster. Touch devices start without the shadow map and probes, and a governor lowers resolution, then lighting detail, on hardware that cannot hold the budget. See [lighting and rendering](docs/lighting-and-rendering.md) for the measurements, budgets, and limits.

The ships, signs, and visibility pass finishes what the lighting pass left open. The liner, the shuttle, and the freight tender are now lofted hulls with cabin windows, glazed bridges, drives, radiators, cargo modules, and stencilled names, lit by the same star as the moon; each lies broadside to its own pier at the end of a ribbed transfer tunnel. Every plain sign is lettered on one shared sheet and reads correctly from both sides, with its arrows turned to match. The two typefaces are served from the site. From a side district, the concourse and its shadow pass are skipped while no doorway to it is in view. See [Ships, signs, typefaces, and sector visibility](docs/ships-signs-and-visibility.md) for measurements and how the culling was shown to be invisible.

The depth-fighting pass removes the flicker where two surfaces were drawn in the same place. Examples are a lift floor in the deck, the dock throat floor over the hall deck, the bulkhead piers inside their lintel, and a crate buried in a ramp, along with about seventy other patterns across every deck and district. Each fix gives one surface clear ownership of its plane and leaves floors, colliders and navigation exactly as they were. The renderer also uses a reversed depth buffer where the browser supports it. Across 910 standing views and 45 long sight lines, flickering pixels fell by 92% and 85%. See [depth fighting](docs/depth-fighting.md) for the causes, the rules for new geometry, the measurements, and what is left.

The imported foreground models are **Animated Robot**, **Scifi Computer**, **Tree Spiral**, and **Cooking Pot** by Quaternius, downloaded from Poly Pizza under CC0. The service unit uses its supplied idle animation. Repeated consoles, plants, and pots share geometry and materials. Selected terminal bodies, planter growth, specimen branches, and cookware proxies are omitted only after their replacement asset loads successfully; otherwise the procedural versions remain available. Creator/source links and exact file inspection records are in [model assets](docs/model-assets.md), [machine-readable metadata](docs/model-assets.json), and the in-app Controls credits link. Run `node scripts/inspect-glb.mjs public/models/poly-pizza/*.glb` to inspect the original files again.

The interface and the station's signs are set in **Space Grotesk** and **Barlow Condensed**, both under the SIL Open Font License 1.1. They are served from this site as Latin subsets, and the licence is published with them at `/fonts/OFL.txt`.

No game assets, text, or official maps from the books are included. This is an atmospheric exploration, with original names and notices, rather than a canonical reconstruction.

The [adversarial review](docs/adversarial-review.md) records reproduced bugs, fixes, rendering comparisons, and remaining scope limits. It covers bounded model loading, viewport/DPR changes, cached history restoration, resource ownership, pointer-lock timing, wall/floor boundaries, long-session crowd routes, reduced motion, and touch controls. Raw measurements are retained in [review results](docs/review-results.json).
