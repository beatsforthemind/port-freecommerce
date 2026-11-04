// Every itinerary repeats within this common window; the older commuters use
// its 720-second subdivision. Phase offsets are validated against both groups.
export const POPULATION_TIMETABLE_SECONDS=1440;

// Calibrated offline across the full 24-minute window against all commuters.
const PHASE_OFFSETS_SECONDS=Object.freeze({
  "connection-0": 43.25,
  "connection-1": 296.5,
  "connection-2": 444.75,
  "connection-3": 64.75,
  "connection-4": 283.25,
  "connection-5": 169.75,
  "connection-6": 424.75,
  "connection-7": 113.25,
  "connection-8": 339.75,
  "connection-9": 226.5,
  "docks-local-0": 7.75,
  "docks-local-1": 17.25,
  "docks-local-2": 13.25,
  "docks-local-3": 10.25,
  "docks-local-4": 40.5,
  "docks-local-5": 122.75,
  "gallery-break-0": 296.5,
  "gallery-break-1": 296.5,
  "gallery-break-2": 296.5,
  "gallery-break-3": 113.25,
  "long-haul-0": 51.5,
  "long-haul-1": 171.5,
  "long-haul-2": 291.5,
  "long-haul-3": 411.5,
  "long-haul-4": 531.5,
  "long-haul-5": 651.5,
  "market-errand-0": 319.75,
  "market-errand-1": 319.75,
  "market-errand-2": 319.75,
  "market-errand-3": 319.75,
  "market-local-0": 287.25,
  "market-local-1": 287.25,
  "market-local-2": 254.75,
  "market-local-3": 254.75,
  "market-local-4": 254.75,
  "market-local-5": 222.25,
  "market-local-6": 222.25,
  "market-local-7": 222.25,
  "market-local-8": 222.25,
  "market-local-9": 222.25,
  "observation-local-0": 76.75,
  "observation-local-1": 9.5,
  "observation-local-2": 153.5,
  "observation-local-3": 8,
  "observation-local-4": 52,
  "observation-local-5": 84.75,
  "promenade-break-0": 55.25,
  "promenade-break-1": 175.25,
  "promenade-local-0": 296.5,
  "promenade-local-1": 74.5,
  "promenade-local-2": 134.5,
  "promenade-local-3": 113.25,
  "promenade-local-4": 43.25,
  "promenade-local-5": 314.5,
  "promenade-local-6": 374.5,
  "promenade-local-7": 339.75,
  "service-0": 12.25,
  "service-1": 24.75,
  "service-2": 180,
  "service-3": 76.5
});

/** Apply once at construction. Playback requires no traffic search or solver. */
export function applyPopulationTimetable(actors) {
  let scheduled=0,calibrated=0,paddingSeconds=0;
  for(const actor of actors){
    const plan=actor.journey;
    if(!plan?.valid||!plan.legs.length)continue;
    const nativeDuration=plan.timetableNativeDuration??plan.duration;
    const home=plan.legs[plan.legs.length-1];
    const homeWait=plan.timetableHomeWait??home.wait;
    const count=Math.max(1,Math.floor(POPULATION_TIMETABLE_SECONDS/nativeDuration));
    let period=nativeDuration<=POPULATION_TIMETABLE_SECONDS
      ?POPULATION_TIMETABLE_SECONDS/count
      :POPULATION_TIMETABLE_SECONDS*Math.ceil(nativeDuration/POPULATION_TIMETABLE_SECONDS);
    // Shared market streets need a common cadence; unrelated short periods
    // would repeatedly force the same pedestrians into crossing traffic.
    if(plan.id.startsWith('market-')||plan.id==='service-2')period=360*Math.ceil(nativeDuration/360);
    const padding=Math.max(0,period-nativeDuration);
    actor.initialJourneyPhase??=actor.journeyClock/nativeDuration;
    plan.timetableNativeDuration=nativeDuration;plan.timetableHomeWait=homeWait;
    home.wait=homeWait+padding;plan.duration=period;
    const offset=PHASE_OFFSETS_SECONDS[plan.id];
    actor.journeyClock=Number.isFinite(offset)?offset:actor.initialJourneyPhase*period;
    if(Number.isFinite(offset))calibrated++;
    scheduled++;paddingSeconds+=padding;
  }
  return Object.freeze({masterPeriodSeconds:POPULATION_TIMETABLE_SECONDS,scheduled,calibrated,paddingSeconds});
}
