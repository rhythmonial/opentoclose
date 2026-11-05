"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { moveStep } from "@/app/profile/setup-steps-actions";
import { MoveConfirm } from "@/components/MoveConfirm";

export type SectionTarget = {
  phase: string;
  phaseLabel: string;
  section: string;
};

export function MoveStepSelect({
  stepId,
  stepTitle,
  currentPhase,
  currentSection,
  targets,
}: {
  stepId: string;
  stepTitle: string;
  currentPhase: string;
  currentSection: string;
  targets: SectionTarget[];
}) {
  const [isPending, startTransition] = useTransition();
  // Index into options of the section picked, waiting for the Move button.
  const [choice, setChoice] = useState("");
  const options = targets.filter(
    (t) => !(t.phase === currentPhase && t.section === currentSection),
  );
  const pillars = Array.from(new Set(options.map((t) => t.phase)));
  if (options.length === 0) return null;

  function move() {
    const target = options[Number(choice)];
    if (!target) return;
    const formData = new FormData();
    formData.set("step_id", stepId);
    formData.set("to_phase", target.phase);
    formData.set("to_section", target.section);
    startTransition(async () => {
      await moveStep(formData);
      setChoice("");
    });
  }

  const picked = choice ? options[Number(choice)] : undefined;

  return (
    <>
      <MoveMenu
        label={picked ? picked.section : "Move ▾"}
        active={Boolean(picked)}
        disabled={isPending}
        ariaLabel={`Move ${stepTitle} to another section`}
        groups={pillars.map((pillar) => ({
          label: options.find((t) => t.phase === pillar)!.phaseLabel,
          items: options
            .map((t, index) => ({ t, index }))
            .filter(({ t }) => t.phase === pillar)
            .map(({ t, index }) => ({ value: String(index), label: t.section })),
        }))}
        onPick={setChoice}
      />
      {choice && (
        <MoveConfirm
          pending={isPending}
          onMove={move}
          onCancel={() => setChoice("")}
        />
      )}
    </>
  );
}

// The "Move ▾" button and its menu: pillar names in bold, with their
// sections under them. (A native dropdown can't style its group labels.)
// It can sit inside a <summary>, so clicks mustn't open or close that.
function MoveMenu({
  label,
  active,
  disabled,
  ariaLabel,
  groups,
  onPick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  ariaLabel: string;
  groups: { label: string; items: { value: string; label: string }[] }[];
  onPick: (value: string) => void;
}) {
  const [at, setAt] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!at) return;
    menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const close = () => setAt(null);
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menu.current?.contains(target) && !button.current?.contains(target)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [at]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (at) return setAt(null);
    const r = button.current!.getBoundingClientRect();
    const width = 256;
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 240 && above > below;
    const maxHeight = Math.min(384, up ? above : below);
    setAt({
      top: up ? r.top - 4 - maxHeight : r.bottom + 4,
      left: Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8)),
      maxHeight,
    });
  }

  // Up / down arrows move between sections.
  function onMenuKey(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={Boolean(at)}
        title="Move this lesson to another section"
        onClick={toggle}
        className={`h-7 shrink-0 truncate rounded-lg border bg-surface px-1.5 text-center text-xs font-medium outline-none hover:text-ink focus:border-accent disabled:opacity-50 ${
          active ? "max-w-40 border-accent text-ink" : "w-[3.75rem] border-border text-ink-soft"
        }`}
      >
        {label}
      </button>
      {at && (
        <div
          ref={menu}
          role="menu"
          aria-label={ariaLabel}
          onKeyDown={onMenuKey}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          style={{ top: at.top, left: at.left, maxHeight: at.maxHeight }}
          className="fixed z-50 w-64 overflow-y-auto rounded-lg border border-border bg-surface p-1 text-left shadow-lg"
        >
          {groups.map((g) => (
            <div key={g.label} role="group" aria-label={g.label}>
              <p className="sticky top-0 bg-surface px-2.5 pb-1 pt-2 text-sm font-bold text-ink">
                {g.label}
              </p>
              {g.items.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onPick(item.value);
                    setAt(null);
                  }}
                  className="block w-full rounded-md py-1.5 pl-5 pr-2.5 text-left text-sm text-ink-soft hover:bg-accent-soft/50 hover:text-ink focus:bg-accent-soft/50 focus:text-ink focus:outline-none"
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
