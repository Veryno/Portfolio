// The shared clock every visitor's sky runs on, so two screens open at the same
// moment show the same sky.

// Seconds in one sky day: day, sunset, night, sunrise and back.
export const DAY_SECONDS = 180;

let offset = 0;

// Milliseconds on the shared clock: this device's clock, corrected if it was off.
export function sharedNow() {
  return Date.now() + offset;
}

// Check this device's clock against the website's once. A device more than a couple
// of seconds out (a laptop that stopped syncing its time, say) takes the website's
// time instead, so its sky still lines up with everyone else's.
export function syncClock() {
  if (typeof fetch !== 'function') return;
  const sent = Date.now();
  fetch(window.location.href, { method: 'HEAD', cache: 'no-store' })
    .then((res) => {
      const date = Date.parse(res.headers.get('date') ?? '');
      const back = Date.now();
      if (!Number.isFinite(date) || back - sent > 3000) return;
      // The header is only to the second, so take the middle of that second; a
      // cached copy says how old it is.
      const server = date + (Number(res.headers.get('age')) || 0) * 1000 + 500;
      const off = server - (sent + back) / 2;
      if (Math.abs(off) > 2000) offset = off;
    })
    .catch(() => {});
}
