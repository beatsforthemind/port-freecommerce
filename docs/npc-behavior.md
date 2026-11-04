# Purposeful station journeys

Four fresh agents worked on main-population routines, concourse commuters, independent physical/performance checks, and adversarial review. This pass changes the behavior of the existing inhabitants. Their shared human geometry, materials, and instanced rendering remain in use.

## What people do

- Connecting passengers meet arrivals, check gate directions, and use separate outbound and return lanes.
- Long-haul passengers walk from Arrivals into the docks, wait beside the real boarding approach, and return while the pressure locks remain closed.
- Provision shoppers travel into the exchange, browse Salt + Static, and order meals at Hot Noodles.
- Local shoppers stop in separate customer positions at Salt + Static, Hot Noodles, Second Orbit, and After Hours.
- Gallery visitors cross the vestibule and ramp to watch the planet. Local observers stop near views rather than continuously circling.
- Promenade visitors use the public ramps; upstairs commuters cross both bridges and pause to meet a connection or watch the interchange.
- Concourse messengers visit handover points, vestibules, notices, and dock rendezvous positions.
- Four service units perform information, parcel, returned-container, and optical-sensor errands.

Readers, conversation groups, and stallkeepers retain their established places and poses. Written roles and activity names are diagnostic data; no floating labels or new interface are added.

## Motion and circulation

Itineraries connect real public floors and static geometry. Route construction validates body clearance and floor continuity once, with bounded local detours when needed. Temporary construction caches are released. Playback samples precompiled segments and schedules; it does not run frame-time pathfinding or an all-pairs avoidance solver.

Each walking leg accelerates from rest, follows a continuous path, brakes into its destination, and waits for an activity. Body heading anticipates turns and settles toward the relevant counter, gate, view, or arrival entrance. Walking and stopped turns use the same endpoint heading convention. Gait advances with actual traveled distance and fades to a neutral stance when stopped.

Waiting positions sit outside the main walking lines. Customer slots are separated at counters, and home waits use individual meeting pockets. Repeating timetables and fixed phase offsets coordinate shared routes; phase calibration happens offline, adding no runtime traffic solver. Market traffic uses a common cadence because unrelated short periods would repeatedly force people into the same crossings.

Floor and sector state update even when an NPC is hidden. People on the public ramps keep the correct deck when they return to view. The previously open promenade path now closes over its real second bridge; long concourse trips return continuously instead of wrapping to the opposite endpoint.

Reduced motion freezes the existing clocks and poses. Camera movement can still reveal the frozen crowd. A blocked optional journey falls back for that actor and records an explicit diagnostic, rather than preventing the station from opening.

## Rendering and diagnostics

The existing population remains 80 actors: 76 humans and four small service units. Its 60 scheduled residents share seven batches and 18,912 maximum triangles. The other 20 commuters retain four batches and 4,204 triangles. Eight seated readers, twelve stationary social/display visitors, and four market stallkeepers keep their existing geometry.

Population uploads remain capped at 20 Hz and commuter uploads at 30 Hz. Stationary, neutral journey poses reuse cached transforms, with changes in position, floor, heading, scale, or visibility handled by the existing invalidation/repacking logic. No models, textures, lights, shadow maps, or dependencies are added.

The on-demand `window.stationExperience.npcBehavior` getter returns copied snapshots for local development. Activity counts are available through population and commuter diagnostics. Ordinary rendering does not generate snapshot arrays.

## Validation and limits

Source hashes, measurements, route checks, timing checks, and production results are retained in [npc-results.json](npc-results.json). The review covers body/floor containment, stationary people, moving crowd spacing, destination facing, walking/dwell/cycle seams, reduced motion, offscreen reconstruction, upload caps, resource disposal, and the existing station features.

The original population produced 94 endpoint jumps in a 1,000-second sample, with a largest displacement of 204.96 m and no walking destination stops. The final 1,800-second checks at both 0.1-second and off-grid 0.037-second intervals found no teleports, floor jumps, backwards travel, cumulative-distance resets, idle walking, or crowd-center contacts below 0.6 m. Minimum measured separation was 0.758 m, including stationary standing/talking visitors. The complete 24-minute timetable was covered.

All 111,561 body/floor route probes passed. A separate 2,490-probe check covered the wider service-unit arms. Review also corrected arrivals visitors facing away from Customs, inconsistent stop/turn headings, inaccurate gate-reading intents, a late floating-point distance reset, and routes that crossed stationary visitors or long-held meeting positions.

At the same six viewpoints on desktop 1280×800 and touch-enabled 390×844, draw calls, textures, geometries, and resolution stayed identical. Desktop render-callback medians were:

| View | Calls before / after | CPU before / after |
| --- | ---: | ---: |
| Arrival | 193 / 193 | 2.2 / 2.3 ms |
| Concourse | 179 / 179 | 1.9 / 2.0 ms |
| Observation | 68 / 68 | 1.0 / 1.0 ms |
| Exchange | 90 / 90 | 1.3 / 1.3 ms |
| Docks | 66 / 66 | 1.0 / 1.1 ms |
| Promenade | 189 / 189 | 2.0 / 1.9 ms |

Changes across all twelve views ranged from −0.1 to +0.2 ms. Visible triangle counts vary with where people are standing; maximum character geometry is unchanged. The comparison used SwiftShader software rendering, six warm-up frames and sixteen sampled callbacks per view. Its single subsequent source change was the local-clock arithmetic correction; final functional and production checks use the corrected sampler.

Route validation adds a real one-time construction cost: approximately 1.02 seconds in the final Node fixture. It releases its temporary caches before playback. The idle-pose optimization compared 22,864,000 matrix values across movement, visibility, detail changes, and reduced motion without a difference. Upload-cap tests offered 1,000 updates in one second and observed 19 population uploads and 29 commuter uploads, with no extra uploads while frozen.

The Node 24 production build and desktop/mobile smoke tests pass. They cover all 60 calibrated main schedules, the other 20 commuters, all sectors and the upper promenade, all four GLBs, existing ship/transport counts, sound opt-in/muting/preferences, and copied diagnostics. No JavaScript errors or local request failures occurred. Production JavaScript is 897.59 kB (257.37 kB gzip), versus 875.79 kB (248.54 kB gzip) before this pass: about 8.83 kB more compressed code. The existing nonfatal Vite bundle advisory remains.

These are authored, repeating routines rather than a general pedestrian simulation. The schedules are calibrated for this station layout; changing routes, speeds, stops, or physical obstacles requires checking the timetable again. The pass does not add player collision, conversations driven by an AI service, or dynamic responses to arbitrary new obstacles. Browser measurements use desktop automation and software rendering; they do not establish physical-phone or hardware-GPU frame rates.
