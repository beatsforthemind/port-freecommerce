/**
 * Holds the frame budget by trading pixels first and lighting detail second.
 * It only ever sees frame intervals, so it also has to recognise a display or
 * power-saving mode that caps the frame rate, where fewer pixels buy nothing.
 */
export function createRenderGovernor({
  limit = 1, floor = .75, budgetMs = 21.5, steadyMs = 18.5, windowMs = 1500, patienceMs = 6000,
  onRatio = () => {}, onRelief = () => {},
} = {}) {
  let ceiling = limit, ratio = limit;
  let samples = [], elapsed = 0, steady = 0;
  let raisedFrom = 0, stalled = 0, lastSlow = 0, restore = 0;
  let capped = false, relieved = false;
  const lowest = () => Math.min(ceiling, floor);
  const stats = {changes: 0, lastP80: 0};

  function set(next) {
    next = Math.max(lowest(), Math.min(ceiling, next));
    if (Math.abs(next - ratio) < 1e-3) return false;
    ratio = next; stats.changes++; onRatio(ratio); return true;
  }
  function clear() { samples = []; elapsed = 0; }

  return {
    get ratio() { return ratio; },
    get capped() { return capped; },
    get relieved() { return relieved; },
    get stats() { return {...stats, ratio, limit, ceiling, capped, relieved}; },
    /** The device limit changed (another monitor, browser zoom): start again from it. */
    setLimit(next) {
      if (Math.abs(next - limit) > 1e-3) { limit = ceiling = ratio = next; raisedFrom = stalled = lastSlow = restore = steady = 0; capped = false; clear(); }
      return ratio;
    },
    /** Drop everything gathered so far, after a pause, resize, or hidden tab. */
    reset: clear,
    sample(ms) {
      // A single long gap is a tab switch, a collection or a shader compile, not a trend.
      if (!(ms > 0) || ms > 250) { clear(); return; }
      samples.push(ms); elapsed += ms;
      if (elapsed < windowMs) return;
      samples.sort((a, b) => a - b);
      const p80 = samples[Math.min(samples.length - 1, Math.floor(samples.length * .8))];
      stats.lastP80 = p80; clear();
      if (capped) return;
      if (p80 > budgetMs) {
        steady = 0;
        if (raisedFrom) {
          // The last increase was too much. Settle one step below it for good.
          ceiling = raisedFrom; raisedFrom = 0; set(ceiling); lastSlow = 0; return;
        }
        // Fewer pixels that buy no time mean something else sets the pace.
        if (lastSlow && (lastSlow - p80) / lastSlow < .04) stalled++; else { stalled = 0; restore = ratio; }
        if (stalled >= 2) { capped = true; set(restore || ceiling); return; }
        lastSlow = p80;
        if (ratio > lowest() + 1e-3) set(ratio * .85);
        else if (!relieved) { relieved = true; onRelief(); }
      } else {
        lastSlow = 0; stalled = 0;
        if (p80 < steadyMs) {
          steady += windowMs;
          if (steady >= patienceMs && ratio < ceiling - 1e-3) { steady = 0; raisedFrom = ratio; set(ratio * 1.12); return; }
        } else steady = 0;
        // A window that held after an increase confirms it.
        raisedFrom = 0;
      }
    },
  };
}
