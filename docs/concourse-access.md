# Concourse vertical access

Fresh agents worked on architecture, rideable lifts and controls, independent access/performance verification, and adversarial review. The main concourse now serves four actual floor heights.

| Deck | Floor height | Public experience |
| --- | ---: | --- |
| 01 / Public concourse | 0 m | Arrivals, traders, and the four-sector interchange |
| 02 / Public promenade | 7.625 m | Existing ramps and bridges, plus outer sunwalks to both Arrivals balcony caps |
| 03 / Lantern galleries | 17.625 m | Both upper commercial galleries, rest niches, and two new skybridges |
| 04 / Express overlook | 23.36 m | Guarded east and west views of the working interchange |

## How to travel

Find the east or west lantern lift beside the northern rest bays. Each shaft is centered at x ±28.5, z −52 and appears as an amber square on the station map. Press **E**, or tap the touch interaction button, to call the car. Walk fully inside, interact again, and choose a deck. Look around during the ride; the doors open at the landing before walking resumes.

The existing amber ramps remain open. The new outer sunwalks pass around the ramp cutouts and connect the previously isolated southern balcony sections. Deck 03's bridges connect both upper galleries. The two Deck 04 overlooks return to the shared Deck 03 bridges and lower public routes through either lift.

The station map has a floor filter, lift markers, and direct transit to each deck. Direct transit and reduced-motion quick rides provide alternatives to animated vertical travel. Keyboard, mouse/drag look, touch interaction, and the joystick remain supported. Escape pauses a ride; resume continues it. Map transit and return-to-arrival safely detach the rider.

## Physical construction and controls

The original 7.625 m and 17.625 m slabs have real shaft openings. Fixed threshold strips meet the car's floor lip, while the moving roof and walls clear the slab edges. Absent or closed cars block the complete opening at each landing. Fixed shaft walls and protected door pockets prevent entry through the side or through retracted panels. Public express walks are separated from the moving staff cages.

Controls bind the rider to the car's exact height and position while preserving yaw, pitch, and free look. They clear walking input at entry and exit. Moving floors alone cannot carry the player reliably because the navigation sampler chooses the nearest old floor; the explicit carry state prevents that ambiguity. Car movement pauses while a menu is open or the page is hidden.

Player navigation includes all new floors and landings. The `journeySurfaces` view retains the original floor interpretation for already calibrated NPC itineraries, including the ramp endpoints beneath the southern balconies. All sixty existing NPC plans and timings remain identical, as do the initial main population and older commuter snapshots.

## Rendering costs

New static architecture uses the existing material batches: 7,608 additional triangles and no additional station draw calls, textures, or lights. The lift pair adds eight batched draws, 1,512 triangles, and five resident geometries, with no textures or lights. Across eighteen matched views, visible draw calls increase by two to eight and submitted triangles by 7,632 to 9,120; texture counts are unchanged.

Lift matrices stay unchanged while idle. Active animation reuses scratch matrices and introduces no per-frame matrix allocations. No shadow maps, full-screen effects, model downloads, or dependencies are added. Software-rendered callback medians in the comparison vary by −0.2 to +0.1 ms; those samples do not establish hardware-GPU or physical-phone frame rates.

## Verification

Measurements and source hashes are retained in [access-results.json](access-results.json). Architecture checks cover full-floor body connectivity, both sides of the galleries, all skybridges, both southern caps and their sunwalks, and vertical rays through the shaft openings. NPC plan/timing hashes match the previous pass exactly.

Native browser checks cover all twenty-four ordered trips between distinct stops on both cars. Maximum measured carry error is 1.8×10⁻¹⁵ m. Calls, boarding, closed/absent gates, free look, held-input cleanup, paused/hidden freezing, reduced-motion travel, cancellation, and repeated disposal pass. Idle updates produce no matrix uploads.

Adversarial review found that parked door panels could be entered at the edge of their collision pockets; extending those pockets reduced accepted capsule/panel contacts from 404 to zero. Another focused check expanded boarding eligibility to cover the entire physically walkable car interior, including the rear and side edges.

Copied-source first-person walkthroughs cover ninety-one walking legs across desktop and mobile, both gallery bridges, full express-side corridors, sunwalks, and lift travel. Root checks also walk into the car using the actual touch joystick, use touch deck selection, and exercise animated pause/resume. No unintended floor changes, blocked public routes, JavaScript errors, or failed local asset requests were found.

The existing four models, NPC routines, ships, internal transports, sound controls, and sector transit are included in production regression checks. The build remains a static Node 24/Vite site suitable for the existing Vercel configuration.

Final production JavaScript is 915.65 kB (264.07 kB gzip), compared with 897.59 kB (257.37 kB gzip) before this pass: approximately 6.70 kB more compressed code. Node 24 build verification passes for the compiled assets, all four models, and their credits. The existing nonfatal Vite bundle-size advisory remains.
