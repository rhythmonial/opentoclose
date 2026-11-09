// Sends saves one at a time, a moment after the last change, always with
// the latest changes: if a save is still going when another change comes
// in, the newer one goes out right after it. A failed or rejected save
// reports "error" instead of throwing (clicking quickly used to leave
// overlapping saves that could crash the page).
export function createSaveQueue<T>(
  save: (value: T) => Promise<{ ok: boolean }>,
  onState: (state: "saving" | "saved" | "error") => void,
  delay = 700,
) {
  let pending: { value: T } | null = null;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function flush() {
    if (running || !pending) return;
    const { value } = pending;
    pending = null;
    running = true;
    let ok = false;
    try {
      ok = (await save(value)).ok;
    } catch {
      ok = false;
    }
    running = false;
    if (pending) {
      void flush();
    } else {
      onState(ok ? "saved" : "error");
    }
  }

  return {
    push(value: T) {
      pending = { value };
      onState("saving");
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush(), delay);
    },
  };
}
