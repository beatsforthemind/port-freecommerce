# Station audio

Four fresh agents worked on the ambient engine, spatial activity, independent signal/lifecycle verification, and adversarial review. The soundscape is synthesized locally with Web Audio. It adds no recordings, dependencies, downloads, or speech service.

## Listening and controls

Use the sound button at the upper right, or enable **Station sound** in Controls. Sound starts off on every load. Controls includes a volume slider and **Your footsteps** switch; these two preferences are saved locally when storage is available. Changing preferences while sound is off does not create an audio context. **Nearby conversation captions** controls the existing written conversations independently.

Headphones make the heading-relative stereo easier to follow. Equal-power stereo panning keeps the cost predictable; this is not HRTF or a complete three-dimensional acoustic simulation. Device volume and speaker bass response affect the low machinery layer.

If a browser blocks automatic playback after returning to the tab, switch sound off and on to provide a fresh user gesture.

## Acoustic character

| Area | Sound and space |
| --- | --- |
| Concourse | Low infrastructure harmonics, distant social texture, restrained PA chimes, and longer reflections. The public promenade has a quieter crowd and more open reflections. |
| Exchange | Closer, brighter social texture, short room reflections, a pressure kettle near the tea caravan, and occasional small transaction tones. |
| Observation | Sparse machinery and crowd, softer high frequencies, quiet room tails, and infrequent delicate tones. |
| Docks | Heavier ventilation, hull texture, muted mechanical impacts, and a denser enclosed return. |

Two fixed stereo impulse responses run through shared wet buses. Room changes smooth the ambience, return levels, and damping; they do not replace the convolver buffers or cut their tails. The crowd is an abstract synthesized murmur, with no intelligible recorded dialogue. Sparse notices use filtered tones rather than speech.

Five reusable positional emitters represent freight, the express service, the nearest service lift, the market kettle, and repair tooling. Listener heading, horizontal and vertical distance, and approximate doorway paths control their pan, level, and filtering. Bulkheads attenuate and muffle sounds; this uses inexpensive room/portal checks rather than geometry raycasts. One lift emitter represents whichever of the two cages is nearer.

The transport layer reads the exact clock used by the visual service shaders, including the existing initial phase, dwell periods, acceleration, doors, and lift cycles. Reduced motion freezes the corresponding motor activity and service cues. Exterior ships do not acquire audible engines across vacuum.

Both repeating ambience buffers use a short endpoint correction after their overlap join. Raw endpoint differences are exactly zero, with lower filtered murmur transients and unchanged storage or processing topology.

Footsteps accumulate actual horizontal travel while exploring. Metal deck, market flooring, and gallery surfaces use three tiny reusable impact buffers. Cadence follows distance and speed; standing still, paused menus, arrival cameras, transit, and teleports do not create a walking loop. The minimum interval and bounded transient pool prevent bursts after long frames.

## Resource budget

| Resource | Before | After |
| --- | ---: | ---: |
| Before first enable | No context | No context, nodes, or buffers |
| Fixed audio nodes after enable | 28 | 66: 41 ambient + 25 spatial |
| Maximum simultaneous transient voices | — | 4 ambient notes + 8 spatial events |
| Hard total node budget | — | 118 |
| Audio buffer storage at 48 kHz | 1,536,000 B | 2,023,680 B (1.93 MiB) |
| Muted context | Continues running | Fades, then suspends after approximately 180 ms |
| Graphics resources | Existing scene | No added draws, geometry, textures, lights, or passes |

Audio controls update at most 15 Hz, with fixed emitter count and reused buffers. Context suspension stops audio processing while muted or hidden; the initialized graph remains available for reuse. Disposal stops sources, disconnects nodes, removes listeners, clears buffers, and closes the live context. Impulse and footstep storage scales with the context's native sample rate.

The richer enabled graph has a real DSP and memory cost, including two shared convolvers. The fixed budgets and hidden/muted suspension limit that cost; they do not establish zero impact or guarantee frame rate on every device.

In an isolated desktop Chromium comparison, three 120-second stereo 48 kHz renders per variant measured a median of 1.044 CPU-seconds before and 4.188 after, excluding graph/buffer setup and export. That is approximately 0.87% versus 3.49% of one CPU core for steady audio. This synthetic offline measurement is separate from graphics frame rate, audio-driver behavior, and physical-phone performance. The warmed control benchmark took 84.6 ms before and 75.1 ms after for 60,000 monotonic calls spanning 1,000 logical seconds; initialization was excluded.

## Verification

Final measurements and source hashes are retained in [audio-results.json](audio-results.json). Native Chromium offline renders check finite samples, clipping, stereo output, volume behavior, room transitions, and representative activity. Fault-injected lifecycle checks cover failed initialization, retry, interrupted resume, rapid toggles, visibility changes, external closure, and repeated disposal. Spatial checks cover clock agreement, panning, bulkhead filtering, movement guards, voice bounds, and cleanup.

All 15 final render cases passed. The highest raw peak was 0.151, including a full-volume 44.1 kHz dock capture. Volume zero and the settled mute window were exact digital silence. An eight-second walking capture produced 28 footfalls with at least 0.267 seconds between them; stationary and disabled-footstep cases produced none. An isolated heading reversal exchanged left/right energy exactly. A 108,000-update stress case spanning two logical hours reached the 118-node/12-voice ceiling without increasing buffer storage, then returned to 66 nodes and zero voices on mute. Repeated disposal released all owned nodes and buffers.

Desktop and touch-enabled browser checks cover opt-in playback, accessible button state, in-dialog controls, keyboard volume, persistence without autoplay, mute suspension, rapid toggles, and scrolling without horizontal overflow. Production checks also retain all four models, population batches, ship traffic, transports, and sector transit.

The final Node 24 build and desktop 1280×800 / touch-enabled 390×844 production checks pass without JavaScript errors or failed local requests. Every sector and the upper promenade selects the corresponding audio profile, with no transit footsteps. Production JavaScript is 875.79 kB (248.54 kB gzip), versus 860.32 kB (242.17 kB gzip) before this pass: about 6.37 kB more compressed code. The existing nonfatal Vite bundle-size advisory remains.

These checks establish signal safety and application behavior. They do not substitute for subjective listening on headphones and speakers, physical-phone profiling, or browser/OS audio-interruption testing across Safari and Firefox. No listening-quality claim is inferred from RMS or peak measurements.

Implementation references: the [Web Audio specification](https://www.w3.org/TR/webaudio-1.1/), [AudioContext suspension](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/suspend), and [audio context states](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state).
