# Residents: rounded figures and a station wardrobe

The 116 human figures were folded-card shapes: four-sided torsos and limbs, box hands and shoes, a dark cap baked onto a faceted head, and no clothing beyond a jacket colour. This pass gives them rounded bodies, a head with real structure, and clothes that belong on a working spaceport. It covers the 76 residents, the 20 concourse commuters, the 16 promenade shopkeepers and the 4 market stallkeepers. The skeletons, poses, routes and timetables are unchanged. It builds on the earlier [human models](human-models.md) pass.

## Staying clear of the uncanny valley

The figures stay stylized, and the detail goes into silhouette and clothing instead of the face.

- **No eyes and no mouth.** A face has a brow, a nose, cheeks, ears and a jaw. The eye sockets are a shallow recess with a little shade, as a face reads under soft overhead light.
- **Nothing across the eyes.** A dark visor was tried and removed: a bar over a featureless face reads as a mask.
- **Nobody is bald.** A smooth bare head with no features is the one combination that looked like a mannequin, so every figure has hair or headgear.
- **Smooth skin, cut hair.** Skin and cloth are smooth-shaded so that they read as soft forms. Hair is left faceted, so it reads as cut hair instead of a cap.
- **No pale blow-out.** The two lightest skin tones are a little deeper, so a face under a ceiling light does not turn white.

## What changed

**Shared shapes** (`src/humanoid.js`)

- The torso is a rounded garment with a hem, a waist, a chest, sloped shoulders and a neck opening.
- A limb is a rounded, tapered shell with both ends closed. The same shape, by scale alone, is also a neck, a stand collar, hips, a hand, a boot upper and a pack strap.
- The head is sculpted from eleven rings, chin to crown.
- Hair is a separate shell that fits the head, with a hairline swept to one side. Scaled up, the same shell is a deck helmet.
- Hair has its own eight colours, from black through browns and auburn to grey. Before, hair was the skin colour darkened.

**Residents** (`src/population.js`)

- Five cuts, chosen by role and position in the crowd:
  - **Crew coverall:** one colour from collar to boot, a broad seal ring at the neck with a status light, amber signal bands on the upper arms, hip pouches, tall boots, and for half of them gloves. Dock staff and one resident in eight wear it.
  - **Long coat:** a high collar and skirts to the knee. Each skirt hangs round its own thigh, so the coat parts with the stride.
  - **Trimmed jacket:** a contrasting collar and cuffs.
  - **Vest:** worn over a close undersuit, so the sleeves and collar differ from the body.
  - **Tunic:** a plain collar and a narrow band on the upper arm.
- Every figure has a stand collar, rounded hips, hands that hang edge-on to the thigh (a reader's lie flat on the page), and boots with a sole and a rounded upper.
- Hair is cropped or fuller; some wear it long at the back or tied up.
- Half the crew wear a hard helmet with ear cups and goggles pushed up on the brow. A few residents wear a comms earpiece.
- Hair, helmets and earpieces ride on the head, and turn with it when a resident glances at the visitor.
- Travel packs rest against the back, and their straps follow the chest and the slope of the shoulder (`src/travel-gear.js`).

**Commuters, shopkeepers and stallkeepers** (`src/districts.js`, `src/promenade-keepers.js`, `src/district-market.js`)

- The same shapes, with necks, collars, hips, hands, soled boots and hair. One commuter in three wears a vest over an undersuit.

## Measured cost

Measured on an Apple M1 Pro in Chromium on the real GPU. "Before" is commit `1812277`.

| | Before | After |
| --- | ---: | ---: |
| Resident draw calls | 7 | 8 |
| Commuter draw calls | 4 | 5 |
| Shopkeeper and stallkeeper draw calls | unchanged | unchanged |
| Resident triangles, all visible | 21,448 | 120,448 |
| Commuter triangles | 4,764 | 27,344 |
| Shopkeeper triangles | 4,384 | 20,800 |
| Scene triangles, looking up the hall from arrivals | 163,724 | 281,424 |
| Scene draw calls, same view | 188 | 190 |
| JavaScript bundle, gzip | 298.5 kB | 302.8 kB |

**Frame time is unchanged.** At 2304×1440 with the frame rate uncapped, the median over three interleaved rounds moved between −2% and +2% across nine views, and run-to-run noise there is about ±10%. The scene is limited by pixels, not triangles, on this machine.

The triangle count is the cost: the busiest view submits about 70% more. No textures, lights, downloads or dependencies are added. A phone that cannot hold the frame budget is still handled by the existing governor, which lowers resolution and then lighting. This was not measured on a phone.

## Verification

- Close-ups of every figure type from the front, side and back were compared before and after: walking, standing, seated, talking, with and without packs, and with heads turned toward the visitor.
- All 55 floors, 371 colliders and 310,575 walkability probes are identical, and every resident route is still valid.
- [Depth fighting](depth-fighting.md) is unchanged: 125,866 unstable pixels at the end of that pass and 125,993 now, over the same 910 standing views in standard depth. The two skirts of a long coat lap by a centimetre so that they never share a face.
- The hidden-concourse culling is still pixel-identical over 180 district poses.
- The production build passes its verifier, and the page loads with no console errors.

## What is left

- The figures are still simple. Fingers, facial expression and cloth movement are out of scope for this style.
- A hair shell sits about 7 mm off the scalp. On browsers without the reversed depth buffer it can shimmer on a head more than about 100 m away, where a head is three pixels wide.
- The four service robots are unchanged, apart from their arms taking the new limb shape.
