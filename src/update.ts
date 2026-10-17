// Keeps an open tab on the newest version of the site. When a new version has
// been deployed, the page reloads the next time it comes back into view, or after
// a few minutes of nobody touching it, so a tab left open can't fall out of step
// with the shared sky on other screens.

const CHECK_MINUTES = 10;
const IDLE_MINUTES = 3;

// The built script a page runs; it gets a new name with every deploy.
function buildOf(doc: Document) {
  return doc.querySelector('script[type="module"][src]')?.getAttribute('src') ?? null;
}

async function newerBuild(current: string) {
  try {
    const res = await fetch(window.location.pathname, { cache: 'no-store' });
    if (!res.ok) return false;
    const latest = buildOf(new DOMParser().parseFromString(await res.text(), 'text/html'));
    return !!latest && latest !== current;
  } catch {
    return false;
  }
}

export function watchForUpdates() {
  const current = buildOf(document);
  if (!current) return;
  let lastInput = Date.now();
  let hiddenAt = 0;
  const touched = () => (lastInput = Date.now());
  for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart']) window.addEventListener(type, touched, { passive: true });
  const reloadIfNewer = async () => {
    if (await newerBuild(current)) window.location.reload();
  };
  window.setInterval(() => {
    if (document.hidden || Date.now() - lastInput > IDLE_MINUTES * 60_000) reloadIfNewer();
  }, CHECK_MINUTES * 60_000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt > 30_000) reloadIfNewer();
  });
}
