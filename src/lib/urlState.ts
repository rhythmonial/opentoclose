// Keeps where someone is on a page (a tab, a page of a document) in its
// address, so a reload comes back to it. The page reads it back from its
// search params.
export function setUrlParam(key: string, value: string | number | null) {
  try {
    const url = new URL(window.location.href);
    if (value === null || value === "") url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
    window.history.replaceState(window.history.state, "", url);
  } catch {}
}
