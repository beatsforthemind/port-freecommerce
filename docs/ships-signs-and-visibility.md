# Ships, signs, typefaces, and sector visibility

This pass closes the four items the [lighting and rendering pass](lighting-and-rendering.md) left open: the docked ships were eight-sided prisms, the typefaces came from a font service, every lettered sign had its own texture, and the concourse was drawn from the side districts whether or not it could be seen.

## What changed

**Docked craft**

- The liner, the shuttle, and the tender are built from lofted hulls instead of boxes on a prism (`src/dock-ships.js`). Each is one mesh and one draw.
  - **Liner, 72 m:** two decks of cabin windows behind glazing bands, a glazed bridge, a radome, twin drive pods on swept pylons, radiators, a dish, and thrusters.
  - **Shuttle, 25 m:** a lifting body with a canopy, cabin windows, stub wings with tip pods, a tail fin, two small drives, and a boarding ramp.
  - **Tender, 36 m:** a pusher. Seven cargo modules are clamped along an open truss, with one bay empty under a handling trolley; the crew cab rides behind and above the load, ahead of the drive block.
- The craft are lit by what is outside the hull: the star that lights the moon and Pelagos, Pelagos itself on whatever faces east, and warm light spilling from the departure hall. No fog reaches them. Hull plating, plate-to-plate shade, and seams are computed in the shader from surface distances in metres, so they keep one physical size on every part.
- Names and codes are stencilled from one 512 px coverage sheet: `PFC 07 LONG WAY ROUND`, `PFC 06 SIX MINUTES`, `PFC 08 SEALED + COUNTED`, and cargo codes.
- Each craft now lies broadside to its own pier. The shuttle and the tender run along the west and east piers' glazing, and the liner runs north from the hall beside the centre pier. Before, each sat beyond the end of its pier, behind its own coupling.
- A ribbed transfer tunnel leaves each lock squarely, turns once, and meets a collar on the hull. The tunnels replace the square coupling beams.

**Signs**

- Every plain lettered sign is a quad on one shared sheet (`src/signage.js`): 52 signs in ten draws, at most two per layer plus the four terminal markers. The sheet holds glyph coverage in a single channel; each sign carries its own ink and backing colours, so identical lettering is drawn once whatever its colours.
- Ink and backing are mixed in display space, as a canvas would composite them, so backed signs look as they did. Unbacked lettering takes its alpha from coverage alone and has no dark fringe.
- The dock signs were on a sheet of their own at about half the density. They are now as sharp as the rest, and they read correctly from behind, which they did not.
- Seen from behind, a sign still reads left to right, and an arrow that points along it is turned so that it points at the same place. The reverse of `06 / LOCAL ←` reads `06 / LOCAL →`.
- Lettering mounted in front of the north glazing is drawn after the glass. It used to be tinted by a pane that is behind it.
- Two printed sheets that still read mirrored from behind, the district information panels and the traders' cloth and boards, now flip each tile on back faces.

**Typefaces**

- Space Grotesk and Barlow Condensed are served from the site as three WOFF2 files, 49 KB in all. Nothing is requested from a font service. See [`src/fonts/README.md`](../src/fonts/README.md) for sources, licence, and how to rebuild them.
- The files are Latin subsets with the arrows U+2190–2199 added. The hosted subset left most arrows out, so the arrows on signs and buttons used to come from whatever the visitor's system offered.
- The sign typeface is preloaded and arrives before the station starts to build. The build verifier fails if a font service is referenced or a typeface is missing.

**Sector visibility**

- The hall's contents are sorted once, after the reflection probes are captured: whatever lies wholly inside the concourse joins its own render layer (`src/visibility.js`). The concourse's box batches are split into the hall and the hull around it, and the traders' batches into those in the hall and those in the districts.
- Each frame, an eye standing on a district floor sees the hall only if one of that district's openings is in view. The exchange and the gallery each have one doorway. The departure head is glazed, so its opening is the whole north bulkhead.
- While no opening is in view, the hall is skipped: 99 objects and about 88,000 triangles, and with them the shadow pass that only the hall receives.
- The rule is conservative. An eye that is not at walking height above a district floor, or is within reach of the hall, sees everything.

**Defects fixed along the way**

- A half-metre gap ran the length of the concourse between the ground wall and the shell above it. From the gallery it showed the inside of the hall through the hull. The wall now meets the shell, as do the two wall sections and the lintel at the exchange doorway.
- `ARRIVALS ⇄ TRANSFERS` used a character neither typeface has. It is now `↔`, which Space Grotesk draws.

## Measured cost

Apple M1 Pro, Chromium with Metal, 1440 × 900 viewport at device pixel ratio 2 (a 2304 × 1440 canvas). Frame times are uncapped means over 150 frames.

Culling switched on and off in one session, median of five interleaved rounds:

| View | Hall | Off | On | Change |
| --- | --- | ---: | ---: | ---: |
| Exchange court, facing west | hidden | 2.21 ms | 2.07 ms | −6% |
| Exchange street, facing north-west | hidden | 2.12 ms | 2.02 ms | −5% |
| Gallery terrace, facing Pelagos | hidden | 1.95 ms | 1.76 ms | −10% |
| Gallery ramp, facing the glass | hidden | 2.28 ms | 1.90 ms | −17% |
| Dock hub, facing north | hidden | 1.94 ms | 1.87 ms | −4% |
| Pier 07, facing the liner | hidden | 2.12 ms | 1.92 ms | −9% |
| Pier 08, facing the tender | hidden | 2.30 ms | 1.98 ms | −14% |
| Exchange doorway, facing the concourse | shown | 2.69 ms | 2.71 ms | +1% |

Against the previous build, median of five rounds in separate browser sessions:

| View | Before | Now | Change |
| --- | ---: | ---: | ---: |
| Arrival | 3.25 ms | 3.27 ms | +1% |
| Concourse | 3.09 ms | 3.09 ms | 0% |
| Promenade overlook | 2.92 ms | 2.96 ms | +1% |
| Exchange court | 2.30 ms | 2.16 ms | −6% |
| Dock hub | 2.01 ms | 1.93 ms | −4% |
| Dock pier, facing the lock | 2.04 ms | 1.99 ms | −2% |
| Pier 07, facing the liner | 1.95 ms | 2.04 ms | +5% |
| Pier 08, facing the tender | 2.06 ms | 2.08 ms | +1% |
| Observation terrace | 1.86 ms | 1.84 ms | −1% |

Differences of a few per cent between sessions are within the noise. The ships cost what the culling saves where a ship fills the view.

| Budget | Before | Now |
| --- | ---: | ---: |
| Draw calls, exchange court | 67, and 69 more for shadows | 41 |
| Triangles, exchange court | 106,000, and 95,000 more for shadows | 32,000 |
| Draw calls, observation terrace | 60, and 69 more for shadows | 38 |
| Draw calls, dock hub | 61, and 69 more for shadows | 49 |
| Draw calls, concourse main pass | 189 | 178 |
| Triangles, concourse main pass | 145,000 | 157,000 |
| Docked craft | boxes in the district batches | 3 draws, 13,700 triangles |
| Textures on the GPU | 67 | 28 |
| Material textures | 79 MiB | 60 MiB |
| Sign textures | 41, about 26 MiB | one sheet, 6 MiB with mipmaps |
| Geometries | 186 | 153 |
| Shader programs | 105 | 107 |
| Requests to other hosts | 4 | 0 |
| Navigation to ready, development server | 1.41 s | 1.12 s |

The shadow pass ran 30 times a second in every sector. It now runs only while the hall is drawn.

## Verification

- **Culling is invisible.** For an eye pose in a district, the frame with the hall hidden and the same frame with it shown are rendered in one animation frame and compared pixel by pixel. Over 11,100 random poses in the three districts, the hall was hidden in 5,076, and none differed by a single pixel. Half the poses crowded the openings, a third stood at unusual eye heights between 0.75 and 3.25 m, and the run was repeated at 800 × 500, 1100 × 420, and 420 × 800.
- **The test can fail.** With the hall deliberately hidden while an opening was in view, the same comparison reported differences in 70–83% of those poses, up to 93% of the frame.
- **How often it helps.** With poses spread evenly over each district's floor and every direction equally likely, the hall is hidden in 68% of views from the exchange, 73% from the gallery, and 41% from the docks.
- **Signs.** Twenty-four views and ten close-ups were captured before and after, side by side. Apart from the changes listed above, they match.
- **Typefaces.** In a real browser every face loads from the site and no other host is contacted. The sign face arrives about 26 ms after navigation starts on the development server. Canvas tests confirm that `← → ↑ ↗ ↔` come from Space Grotesk.
- **Small texture limits.** With the limit forced to 2048, the sign sheet is drawn at 2048 × 2048 and the station loads without errors.
- **Lifecycle.** On a desktop and a phone-sized touch browser: entering, walking, transit to all four sectors and all four decks, the dialogs, pause, reduced motion, return to the title, re-entry, and teardown run without console, shader, or network errors. Resident pace, yielding, and collision are unchanged. The governor steps and sheds lighting detail as before. The production build passes.

## Limits

- Culling depends on the exchange and the gallery staying sealed rooms with one doorway each. If a district gains another window onto the hall, add it to `OPENINGS` in `src/visibility.js`. `visibility.enabled = false` draws everything, for comparison.
- The sorting reads bounds once. An object that is added later, or that leaves the hall after being sorted into it, must state `userData.concourseInterior` itself.
- Residents, the glow layer, dust, and the freight machinery span sectors and are still drawn from the districts. They are hidden by the hull, not skipped.
- The craft cast no shadows on themselves or each other, and the piers beside them are still lit by the interior rig.
- The nine vessels in the exterior traffic lanes are still simple hulls.
- Timings are from one machine in an automated browser, with about ±10% between runs. Safari, Firefox, and phones were not measured.
