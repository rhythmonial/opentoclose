"use client";

import { useEffect, useState } from "react";

export function TimerButton({
  accountId,
  clientId,
  onStop,
}: {
  accountId: string;
  clientId: string;
  onStop: (args: {
    accountId: string;
    clientId: string;
    startedAt: string;
    stoppedAt: string;
  }) => Promise<void>;
}) {
  const storageKey = `otc_timer_${clientId}`;
  const [startedAt, setStartedAt] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved ? Number(saved) : null;
    } catch {
      return null;
    }
  });
  const [now, setNow] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (startedAt == null) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  function handleStart() {
    const start = Date.now();
    setStartedAt(start);
    setNow(start);
    try {
      window.localStorage.setItem(storageKey, String(start));
    } catch {
      // ignore
    }
  }

  async function handleStop() {
    if (startedAt == null) return;
    setSaving(true);
    const stoppedAt = Date.now();
    try {
      await onStop({
        accountId,
        clientId,
        startedAt: new Date(startedAt).toISOString(),
        stoppedAt: new Date(stoppedAt).toISOString(),
      });
    } finally {
      setStartedAt(null);
      setSaving(false);
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
    }
  }

  const elapsedMs = startedAt != null ? Math.max(0, now - startedAt) : 0;
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  const display = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-2">
      {startedAt != null && (
        <span className="font-mono text-sm font-semibold text-ink">
          {display}
        </span>
      )}
      <button
        type="button"
        onClick={startedAt == null ? handleStart : handleStop}
        disabled={saving}
        className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 ${
          startedAt == null ? "bg-accent" : "bg-danger"
        }`}
      >
        {startedAt == null ? "Start" : saving ? "Saving…" : "Stop"}
      </button>
    </div>
  );
}
