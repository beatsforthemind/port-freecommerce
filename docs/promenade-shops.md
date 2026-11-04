# Deck 02 promenade traders

Six fresh agents handled the original business directory, storefront geometry, shopkeepers, independent access/performance QA, adversarial visual review, and resource lifecycle review. Both walls of the public promenade now form a trading street of thirty-two businesses across eleven physical shop types.

Take either lantern lift to **02 / Public promenade**, use the amber ramps, or select the promenade on the station map. The businesses sit along both pressure walls from the north end to the Arrivals bridge. **E**, or the touch interaction button, opens the nearest shop's original environmental story. The map shows traders in sage on Deck 02 and in the all-decks view.

## Directory

| Wall | Business | Trade |
| --- | --- | --- |
| West | Six Moons Noodle Bureau | Food and drink |
| West | Parcel of Rain | Alien botany |
| West | Foldline Cartography | Navigation and charts |
| West | Other Sleeves Atelier | Adaptive tailoring |
| West | Breath Exchange | Atmosphere and sensory services |
| West | Second Self Drone Works | Repair and fabrication |
| West | Red Shift Spice Office | Food and drink |
| West | Afterimage Memory Jewels | Curios and instruments |
| West | Small Gravities Habitat Office | Habitat showroom |
| West | Slowlight Apothecary | Transit health and optics |
| West | The Lost Constellation | Curios and instruments |
| West | Soft Landing Cargo Atelier | Travel equipment |
| West | Midnight Ferment Cooperative | Food and drink |
| West | Quiet on Credit | Atmosphere and sensory services |
| West | Odd Tender Clearing House | Trade and services |
| West | Aphelion Tea Room | Food and drink |
| East | Orbit & Anchor Outfitters | Travel equipment |
| East | Manybody Transit Clinic | Transit health and optics |
| East | Pocket Biospheres | Alien botany |
| East | Twelve Tides Protein Kitchen | Food and drink |
| East | Patchwork Suit Service | Repair and fabrication |
| East | Elsewhere Navigation Cabinet | Navigation and charts |
| East | Rootless Nursery | Alien botany |
| East | The Useful Minute | Trade and services |
| East | Silhouette Transit Wear | Adaptive tailoring |
| East | The Unfamiliar Instrument | Curios and instruments |
| East | Comet Crumb Bakery | Food and drink |
| East | Borrowed Horizon | Atmosphere and sensory services |
| East | Lumen Lens Exchange | Transit health and optics |
| East | Pollen Post | Alien botany |
| East | Little Courier Assembly | Repair and fabrication |
| East | Dust Archive & Salvage | Curios and instruments |

The street combines sealed food preparation, local repair work, climate-specific plants, garments for different body plans, atmospheric samples, unusual instruments, navigation, and small practical services. Physical merchandise, shelving, counters, canopies, and displays distinguish the shops; signs carry individual names, translated taglines, counter notices, and small original glyphs.

## Public access

Every shop is a walk-up retail pocket at floor height **7.625 m**. Fixtures begin at absolute x=27.1 m, leaving the main lane and existing NPC routes inward of that line. The thirty-two collision pockets apply only at the shop level; ground, upper galleries, and express overlooks stay open. Structural columns, the entire lantern-lift bay, bridge approaches, ramp connections, and both sunwalk entrances retain their clearances. No walking floors or existing itineraries are replaced.

Inspection uses the nearest eligible place in three dimensions, with lift controls retaining priority. This prevents the older promenade notice from masking the east-side shop near the Arrivals bridge. A shop's story is available from the public lane; the guarded display pockets are not walk-in interiors.

## Geometry and ownership

Box fixtures use the station's existing material batches. Curved merchandise shares three merged meshes. All sixty-four brand and counter panels share one opaque mesh and one **2048×1024** canvas atlas; it is generated once and never redrawn. Sixteen merchants use the established adult head, torso, limb, skin, and clothing style in one immutable vertex-colored mesh, with serving, repair, reading, and folding poses.

No lights, shadow maps, postprocessing passes, downloaded models, dependencies, character simulations, or per-frame shop updates are added. The station's existing disposal traversal owns the appended geometry, material, and sign texture resources. The original four CC0 models, optional audio, moving transports, and all sixty calibrated NPC journeys are retained.

## Verification

The raw measurements, source hashes, and final production checks are in [promenade-results.json](promenade-results.json). They include walking and inspection coverage on both walls, lift and bridge clearances, floor-height isolation, NPC plan/timing equivalence, atlas orientation, merchandise bounds, and matched desktop/mobile rendering views. Software WebGL submission timings do not establish hardware-GPU or physical-phone frame rates.

Shop fixtures add 11,776 triangles in the existing box batches and three curved meshes; signs add 128 triangles and one draw; keepers add 4,384 triangles and one draw. The total is **16,288 triangles, five draws, five geometries, and one texture**. The atlas is approximately 8 MiB of base RGBA data, or 10.67 MiB with mipmaps. These are real added costs; static batching keeps the new street out of the frame-update loop.

The Node 24 production build and packaged-asset verification pass. Final JavaScript is 945.55 kB (277.39 kB gzip), compared with 915.65 kB (264.07 kB gzip) before this pass: approximately **13.32 kB more compressed code**, including the original directory text. The existing nonfatal Vite chunk-size advisory remains.

Independent final checks pass for all 32 inspection anchors and 50,312 navigation samples. All sixty authored NPC plans, timings, and initial snapshots match the preceding commit exactly. Desktop and touch walkthroughs complete 64 shop notice visits, 140 walking legs, both bridges and sunwalks, the ramp, floor-map filtering, and every lift stop. Native movement checks cover all twenty-four ordered lift trips with the actual shop/station colliders.

Twenty-four matched desktop/mobile views add zero to five visible draws and 5,520 to 16,288 submitted triangles, depending on visibility. Frozen-view callback medians vary by −0.1 to +0.2 ms; this measures software WebGL submission, excludes the normal interaction loop, and is not a hardware frame-rate result. New shop buffers and atlas versions stay unchanged through 600 world updates. Exact disposal and shared industrial texture ownership also pass.
