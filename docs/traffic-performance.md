# Station traffic — November 3, 2026

Four fresh agents implemented interior transport and orbital traffic, measured the result, and independently reviewed the motion and resource handling. This pass changes `src/station-life.js` and `src/atmosphere.js`; public walking floors, colliders, model assets, and renderer settings remain intact.

## Working routes

- Three coupled freight wagons and two express cabins travel on separate overhead lines. Both services use a 120-second cycle, smooth acceleration and braking, eight-second berth stops, and reversal inside the pressure hull. Four moving express door leaves open only toward a platform; berth lamps follow the same service clock.
- Four roof-hung berths give the routes physical endpoints. Two guided service lifts connect the express landings at 23.36 m to the existing staff galleries at 17.625 m. These are background staff facilities; the public promenades and their ramps remain the walking routes.
- Nine exterior vessels replace three identical ships: three couriers, two container freighters, two passenger shuttles, and two freight tenders. Flight headings follow their lanes. Tenders decelerate into clearance holds, turn while stopped, and depart; aft drive apertures and port/starboard beacons make direction readable.

Look up from the public promenade to see both rail services. The observation gallery and the dock glazing frame the exterior traffic.

## Rendering budget

| Module | Before draws | After maximum draws | Before triangles | After triangles | Geometry attribute bytes, before/after |
| --- | ---: | ---: | ---: | ---: | ---: |
| Internal machinery and transport | 3 | 3 | 3,096 | 3,096 | 408,672 / 408,672 |
| Atmosphere, including shipping | 5 | 5 | 420 | 392 | 46,144 / 46,144 |
| Combined | 8 | 8 | 3,516 | 3,488 | 454,816 / 454,816 |

Including the unchanged index and instance-matrix arrays, the complete buffer-array total is 457,288 bytes both before and after. The table counts base geometry attributes only.

The exterior fleet itself uses 224 triangles versus 252 previously. Simpler hulls, tapered geometry, and small surface panels fund the larger fleet. Interior roof ties follow structural bays, continuous rail strips replace many small markers, and six-sided machine cylinders fund the extra cabins, berths, and lifts.

There are no added textures, light sources, shadow maps, postprocessing passes, model requests, dependencies, or per-object animation loops. Geometry buffers are built once. Motion is evaluated in vertex shaders using shared clocks; JavaScript updates those clocks and a small, fixed number of conservative visibility bounds. The shipping batch can be skipped when all its flight lanes are outside the view.

## Verification

Independent checks cover displaced GPU positions rather than only the source geometry at the origin. They include transport dwell/reversal/wrap boundaries, door travel, lift extremes, long-session timestamps, camera visibility, reduced-motion freezing, unchanged geometry buffers, and repeated disposal. A separate review corrected doors opening onto empty air and checked the service lift floor and bridge connections.

Exterior checks include the station envelope, static docked ships, the planet globe, and its rotated ring annulus. More than one million sampled exterior vertex positions stayed inside the visibility bounds. The final conservative full-hull clearance from the rings is approximately 9.26 m in these checks; an earlier route that crossed the rings was corrected before the final benchmark.

## Same-view browser comparison

Desktop 1280×800 and touch-enabled mobile 390×844, both at DPR 1, using identical temporary camera/instrumentation hooks. Each of six fixed views receives six warmup frames and 16 measured callbacks. Motion stays enabled. Callback CPU time includes scene update and render submission.

| Desktop view | Before calls | After calls | Before CPU median | After CPU median | After submitted triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| Arrival | 193 | 193 | 2.2 ms | 2.1 ms | 105,416 |
| Concourse | 179 | 179 | 2.0 ms | 1.9 ms | 104,896 |
| Observation | 68 | 68 | 1.0 ms | 1.0 ms | 70,991 |
| Market | 91 | 90 | 1.3 ms | 1.3 ms | 70,100 |
| Docks | 66 | 66 | 1.0 ms | 1.0 ms | 66,328 |
| Promenade | 189 | 189 | 2.0 ms | 2.0 ms | 109,732 |

Across all twelve desktop/mobile views, calls stay the same except the exchange, which saves one call on each viewport. Submitted geometry falls by 28 triangles in the other views and by 252 in the exchange, where the fleet is entirely out of view. Texture counts, geometry counts, and render resolution match the baseline in every view.

The browser used ANGLE/SwiftShader software rendering. Median callback changes range from −0.2 to +0.1 ms in these short samples; these results do not establish a hardware FPS, battery, or physical-phone performance guarantee. No resolution reduction or disabled motion was used to obtain the comparison.

The final Vite build produces 850.55 kB of JavaScript (238.47 kB gzip), versus the preceding build's 843.47 kB (235.92 kB gzip). The new routing/shader code adds about 2.55 kB compressed; it introduces no additional requests or asset downloads. The existing nonfatal bundle-size advisory remains.

Full measurements, source hashes, and independent motion/lifecycle checks are retained in [traffic-results.json](traffic-results.json).

Final Node 24 production checks pass on desktop and a touch-enabled viewport: entry, transit through all sectors and the upper promenade, all four GLBs, 80 inhabitants, nine exterior vessels, two express cabins, two service lifts, four moving platform-side door leaves, and credits delivery. No JavaScript errors or local HTTP failures occurred. Font fallbacks worked; the production page requested no Vite development modules.
