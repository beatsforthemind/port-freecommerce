/** A quiet, entirely procedural soundscape; no media downloads or autoplay. */
export function createAmbientAudio() {
  let context = null;
  let master = null;
  let airflowFilter = null;
  let airflowPan = null;
  let airflowGain = null;
  let machineryGain = null;
  let isEnabled = false;
  let desiredEnabled = false;
  let disposed = false;
  let nextChime = null;
  let generation = 0;
  let crowdGain = null;
  let crowdFilter = null;
  let crowdCadence = null;
  let crowdCadenceDepth = null;
  let dockingGain = null;
  let nextActivity = null;
  let lastUpdate = -Infinity;
  let lastSector = null;
  const profiles = {
    concourse: {air: .11, airCutoff: 760, hum: .95, crowd: .075, voiceBand: 780, dock: .006, cadence: 2.17, activity: 12},
    market: {air: .075, airCutoff: 970, hum: .62, crowd: .15, voiceBand: 1090, dock: .003, cadence: 2.65, activity: 8},
    observation: {air: .045, airCutoff: 470, hum: .24, crowd: .012, voiceBand: 510, dock: .001, cadence: 1.35, activity: 18},
    docks: {air: .13, airCutoff: 640, hum: 1.08, crowd: .045, voiceBand: 650, dock: .032, cadence: 1.75, activity: 11},
  };
  const continuousNodes = [];
  const chimes = new Set();

  function connect(source, destination) {
    source.connect(destination);
    continuousNodes.push(source);
    return source;
  }

  function initialize() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    context = new AudioContextClass();
    master = context.createGain();
    master.gain.value = 0;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.ratio.value = 3;
    compressor.knee.value = 22;
    master.connect(compressor);
    compressor.connect(context.destination);
    continuousNodes.push(master, compressor);
    machineryGain = context.createGain();
    machineryGain.gain.value = .95;
    connect(machineryGain, master);

    // Slightly detuned machinery fundamentals avoid a static sine-wave feel.
    [
      [42, 0.1, 'sine', -0.35],
      [63.07, 0.042, 'sine', 0.3],
      [84.12, 0.018, 'triangle', -0.1],
      [126.04, 0.009, 'sine', 0.5],
    ].forEach(([frequency, volume, type, pan]) => {
      const oscillator = context.createOscillator();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      const gain = context.createGain();
      gain.gain.value = volume;
      const panner = context.createStereoPanner();
      panner.pan.value = pan;
      connect(oscillator, gain);
      connect(gain, panner);
      connect(panner, machineryGain);
      oscillator.start();
    });

    const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < data.length; i++) {
      brown = (brown + (Math.random() * 2 - 1) * 0.025) / 1.025;
      data[i] = brown * 3;
    }
    const airflow = context.createBufferSource();
    airflow.buffer = buffer;
    airflow.loop = true;
    airflowFilter = context.createBiquadFilter();
    airflowFilter.type = 'lowpass';
    airflowFilter.frequency.value = 680;
    airflowGain = context.createGain();
    airflowGain.gain.value = 0.11;
    airflowPan = context.createStereoPanner();
    connect(airflow, airflowFilter);
    connect(airflowFilter, airflowGain);
    connect(airflowGain, airflowPan);
    connect(airflowPan, master);
    airflow.start();

    // A band-limited, slowly modulated bed suggests nearby conversation without
    // speech synthesis, recordings, or dozens of positional sound sources.
    const crowdBuffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
    const crowdData = crowdBuffer.getChannelData(0);
    for (let i = 0; i < crowdData.length; i++) {
      const t = i / context.sampleRate;
      const envelope = .45 + .16 * Math.sin(t * 13.63) + .12 * Math.sin(t * 19.67 + 1.8);
      crowdData[i] = (Math.random() * 2 - 1) * .45 * envelope;
    }
    const crowd = context.createBufferSource();
    crowd.buffer = crowdBuffer;
    crowd.loop = true;
    crowd.playbackRate.value = 1.27;
    crowdFilter = context.createBiquadFilter();
    crowdFilter.type = 'bandpass'; crowdFilter.frequency.value = 780; crowdFilter.Q.value = 1.25;
    crowdGain = context.createGain(); crowdGain.gain.value = .075;
    const crowdPan = context.createStereoPanner(); crowdPan.pan.value = -.14;
    connect(crowd, crowdFilter); connect(crowdFilter, crowdGain); connect(crowdGain, crowdPan); connect(crowdPan, master);
    crowdCadence = context.createOscillator(); crowdCadence.frequency.value = 2.17;
    crowdCadenceDepth = context.createGain(); crowdCadenceDepth.gain.value = .018;
    connect(crowdCadence, crowdCadenceDepth); connect(crowdCadenceDepth, crowdGain.gain);
    crowdCadence.start(); crowd.start();

    const dockingPulse = context.createOscillator(); dockingPulse.type = 'triangle'; dockingPulse.frequency.value = 36.3;
    dockingGain = context.createGain(); dockingGain.gain.value = .006;
    const dockingPan = context.createStereoPanner(); dockingPan.pan.value = .4;
    connect(dockingPulse, dockingGain); connect(dockingGain, dockingPan); connect(dockingPan, master);
    dockingPulse.start();
    return true;
  }

  function softNote(frequency, at, volume, duration, type = 'sine', panValue = 0, endFrequency) {
    if (!context || !master || !isEnabled || chimes.size >= 12) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const pan = context.createStereoPanner();
    oscillator.frequency.setValueAtTime(frequency, at);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, at + duration * .7);
    oscillator.type = type;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + .025);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    pan.pan.value = panValue;
    oscillator.connect(gain); gain.connect(pan); pan.connect(master);
    const nodes = {oscillator, gain, pan};
    chimes.add(nodes);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); pan.disconnect(); chimes.delete(nodes); };
    oscillator.start(at); oscillator.stop(at + duration + .02);
  }

  function sectorActivity(sector, time) {
    const now = context.currentTime;
    if (sector === 'market') {
      // A cup set down, its bright rim, then the soft pressure of a tea kettle.
      const pan = Math.sin(time * .19) * .45;
      softNote(1046.5, now, .005, .22, 'sine', pan);
      softNote(2093, now + .035, .0018, .13, 'sine', pan);
      softNote(698.5, now + .62, .0035, 1.35, 'sine', -.3, 783.99);
    } else if (sector === 'docks') {
      // A clamp engages before a restrained two-note boarding cadence.
      softNote(74, now, .019, .34, 'triangle', .55);
      softNote(49.3, now + .46, .013, .55, 'sine', -.35);
      softNote(392, now + .91, .005, .65, 'sine', -.2);
      softNote(523.25, now + 1.16, .004, .85, 'sine', -.2);
    } else if (sector === 'observation') {
      softNote(880, now, .003, 2.5, 'sine', -.5);
      softNote(1318.5, now + .41, .0017, 2.8, 'sine', .3);
    } else {
      // A distant call signal carries further than the words that follow it.
      softNote(493.88, now, .005, .6, 'triangle', -.45);
      softNote(369.99, now + .4, .004, .9, 'sine', -.4);
    }
  }

  function playChime(volume = .012) {
    if (!context || !isEnabled) return;
    const start = context.currentTime;
    [554.37, 739.99, 659.25].forEach((frequency, index) => {
      softNote(frequency, start + index * .28, volume, 1.6, 'sine', -.55 + index * .2);
    });
  }

  return {
    async setEnabled(value) {
      if (disposed) return false;
      desiredEnabled = Boolean(value);
      const request = ++generation;
      if (!desiredEnabled) {
        isEnabled = false;
        nextChime = null;
        nextActivity = null;
        lastSector = null;
        if (context && master) {
          master.gain.cancelScheduledValues(context.currentTime);
          master.gain.setTargetAtTime(0, context.currentTime, 0.16);
        }
        return false;
      }
      try {
        if (!context && !initialize()) return false;
        await context.resume();
        if (disposed || request !== generation || !desiredEnabled) return false;
        isEnabled = context.state === 'running';
        master.gain.cancelScheduledValues(context.currentTime);
        master.gain.setTargetAtTime(isEnabled ? 0.5 : 0, context.currentTime, 0.5);
        return isEnabled;
      } catch {
        isEnabled = false;
        return false;
      }
    },
    get enabled() { return isEnabled; },
    update(position, time, environment = {}) {
      if (!context || !isEnabled || disposed) return;
      if (time - lastUpdate < 1 / 15) return;
      lastUpdate = time;
      const x = position?.x ?? position?.[0] ?? 0;
      const y = position?.y ?? position?.[1] ?? 1.75;
      const z = position?.z ?? position?.[2] ?? 0;
      const now = context.currentTime;
      // Dock piers extend beyond x±32, so room identity takes precedence over
      // the old branch-coordinate guess. The fallback also checks docks first.
      const fallback = z < -129.8 ? 'docks' : x > 31.8 ? 'observation' : x < -31.8 ? 'market' : 'concourse';
      const sector = Object.hasOwn(profiles, environment.sector) ? environment.sector : fallback;
      const profile = profiles[sector];
      const upper = sector === 'concourse' ? Math.max(0, Math.min(1, (y - 3) / 6)) : 0;
      const crowdVolume = profile.crowd * (1 - upper * .48);
      airflowFilter.frequency.setTargetAtTime(profile.airCutoff, now, .85);
      airflowGain.gain.setTargetAtTime(profile.air, now, .85);
      machineryGain.gain.setTargetAtTime(profile.hum, now, 1.2);
      airflowPan.pan.setTargetAtTime(Math.max(-0.65, Math.min(0.65, x / 120)) + Math.sin(time * 0.07) * 0.12, now, 0.8);
      crowdGain.gain.setTargetAtTime(crowdVolume, now, 1.1);
      crowdCadenceDepth.gain.setTargetAtTime(crowdVolume * .24, now, 1.1);
      crowdCadence.frequency.setTargetAtTime(profile.cadence, now, 1.1);
      crowdFilter.frequency.setTargetAtTime(profile.voiceBand - upper * 130, now, 1.1);
      dockingGain.gain.setTargetAtTime(profile.dock + (sector === 'docks' ? Math.sin(time * .67) ** 8 * .005 : 0), now, .8);
      if (lastSector !== sector) {
        nextActivity = time + (sector === 'observation' ? 7 : 3.2);
        nextChime = time + (sector === 'observation' ? 32 : 13);
        lastSector = sector;
      }
      if (nextActivity === null) nextActivity = time + 4.5;
      if (time >= nextActivity) {
        sectorActivity(sector, time);
        nextActivity = time + profile.activity + Math.random() * 5;
      }
      if (nextChime === null) nextChime = time + 8;
      if (time >= nextChime) {
        playChime(sector === 'observation' ? .0018 : sector === 'market' ? .004 : sector === 'docks' ? .006 : .012 * (1 - upper * .4));
        nextChime = time + (sector === 'observation' ? 48 : 28) + Math.random() * 18;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      desiredEnabled = false;
      isEnabled = false;
      generation++;
      for (const node of continuousNodes) {
        if (typeof node.stop === 'function') {
          try { node.stop(); } catch { /* A source may already have stopped. */ }
        }
        node.disconnect();
      }
      for (const { oscillator, gain, pan } of chimes) {
        try { oscillator.stop(); } catch { /* Already ended. */ }
        oscillator.disconnect();
        gain.disconnect();
        pan.disconnect();
      }
      chimes.clear();
      context?.close().catch(() => {});
    },
  };
}
