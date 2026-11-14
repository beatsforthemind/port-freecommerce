# Shops and trading areas

The station's businesses read as placeholders. On Deck 01 a "shop" was a flat backlit picture of silhouettes on a dark wall, with no door and no name. On the promenade and in the Exchange, every counter and wall was built from the hull's panel material, so each shop carried `PRESSURE SHELL · INSPECTION A` stencils and vent grilles, and looked like a cargo container with a dark recess behind it. This pass rebuilds the Deck 01 frontage as 22 real shops and refits the 32 promenade shops and the Exchange stalls.

## What changed

**Deck 01: 22 shopfronts** (`src/deck-shops.js`)

- Each wall bay is now a named business, 11 to a side:

  | Kind | Businesses |
  | --- | --- |
  | Provisions | Last Light Provisions, Arrivals Sundries, Passage Supply Co. |
  | Food and drink | Noodles 24H, Half Measure, The Slow Orbit, First & Last Cup |
  | Outfitters | Dockside Outfitters, Common Thread |
  | Parts and chandlery | Spare & Seal, Tender & Line, Orbital Supply |
  | Offices | Contracts & Claims, Meridian Credit, Gate Seven Freight Desk, Short-Stay Habitats |
  | Books and charts | The Long Shelf, Ringside Charts |
  | Luggage | Liftside Lockers, Left Luggage |
  | Pharmacy | Quiet Cycle Pharmacy |
  | Plants | Greenhouse Nine |

- **A fascia** carries the shop's mark, name, purpose, bay number and hours.
- **A door** stands in a short recess: two leaves in the shop's colour with lit slots and pull bars, under a lamp, with an amber threshold strip and an entry reader beside it.
- **A display case** replaces the picture. It is glazed, 5.8 m wide and about 0.9 m deep, with real shelves and stock, so the goods shift against each other as a visitor walks past. What stands in it depends on the trade:
  - tins with labels, cartons and crates of fruit
  - stock pots, a steamer and paper lanterns
  - garments on a rail beside a fitting form
  - tools on a board over bins of parts
  - a service counter with terminals and pigeonholes
  - a wall of lockers with cases waiting in front
  - shelves of book spines and a globe
  - potted plants under grow lamps
  - back-bar bottles on lit shelves
- **A price board** hangs on the pier beside the door, and a plate over the door gives the hours.
- Shops that sell from the window keep an awning over it.
- **E** at any shopfront opens a line or two about the business, as on the promenade.
- The flat picture windows and their sheet (`src/storefronts.js`) are gone, along with four hanging signs that named shops which now name themselves.

**Promenade: 32 shops refitted** (`src/promenade-shops.js`)

- Each bay is finished in plain paint in a deep shade of its own sign colour, with a lighter counter and a dark exterior. Before, all 32 shared three stencilled hull materials.
- The back wall is lit and battened, with a dado rail and a lamp under the roof. Before, it was a black recess.
- Shelves are stocked in each trade's colours. Chart, repair, habitat and luggage shops gained shelving where their back walls were bare, and a tailor's rail is hung along its whole length.
- Every counter has a till. Merchandise that was made of hull material (pots, plants, instruments) is plain metal, green or glass.

**The Exchange** (`src/district-market.js`, `src/districts.js`)

- The stalls' walls and counter tops are plain paint, and their shelves hold stock in four colours and several sizes.

**Shared kit** (`src/shop-kit.js`)

- Fittings and stock in any colour are merged into static meshes: one lit and one self-lit per group.
- The lit mesh carries about a fifth of its own colour as light, as goods under a shop's lamps do. A display stays readable under the dim balcony without a single added light.

## What did not change

- Floors, colliders and walkability. Everything new on Deck 01 stays inside the wall line, and the promenade's shop pockets keep their colliders.
- The promenade's names, signs, stories and shopkeepers, the four independent traders in the hall, and every resident's route.

## Measured cost

Measured on an Apple M1 Pro in Chromium on the real GPU. "Before" is commit `da6ee01`.

| | Before | After |
| --- | ---: | ---: |
| Scene triangles, looking up the hall from arrivals | 281,424 | 370,076 |
| Scene draw calls, same view | 190 | 194 |
| Deck 01 shop meshes | 44 triangles | 71,832 |
| Promenade shop fittings (boxes moved out of the hull batches) | 3,988 curved | 25,992 |
| Textures | 28 | 28 |
| JavaScript bundle, gzip | 302.8 kB | 312.3 kB |

At 2304×1440 with the frame rate uncapped, the median frame time over three interleaved rounds rose by 4–5% in the hall and by 0–7% elsewhere. Run-to-run noise there is about ±10%, so the cost is at most a few per cent. The Deck 01 fittings are one set of meshes to a wall, so the frontage behind a visitor is skipped; that split was made after the timing. No lights, shadow maps or downloads are added. This was not measured on a phone.

## Verification

- Every shop kind was looked at from across the hall, from the street and at the glass, before and after.
- All 55 floors, 371 colliders and 310,575 walkability probes are identical, and every resident route is still valid.
- [Depth fighting](depth-fighting.md): 125,993 unstable pixels before and 128,992 after over the same 910 standing views, in standard depth. Shop glass is three panes that stop short of the sill, the head and the mullions, so that no pane runs into a frame.
- The hidden-concourse culling is still pixel-identical over 180 district poses.
- The walkthrough on desktop and phone layouts runs with no console errors or failed requests, and the production build passes its verifier.

## What is left

- Nobody can go inside. The Deck 01 shops are frontages with a metre of depth behind the glass, and their doors stay shut.
- Deck 01 shops have no shopkeepers. The promenade's 16 and the Exchange's four are unchanged.
- The Exchange's wall panels and the four hall traders were left as they were.
- About 250 unstable pixels appear in a few views from the promenade, where a shopfront's painted wall runs behind a column rib.
