"use client";

import { useRef, useState } from "react";

function setHeadingLevel(
  value: string,
  pos: number,
  level: number,
): { value: string; cursor: number } {
  const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
  let lineEnd = value.indexOf("\n", pos);
  if (lineEnd === -1) lineEnd = value.length;
  const line = value.slice(lineStart, lineEnd);
  const stripped = line.replace(/^#{1,6}\s*/, "");
  const prefix = level > 0 ? "#".repeat(level) + " " : "";
  const newLine = prefix + stripped;
  return {
    value: value.slice(0, lineStart) + newLine + value.slice(lineEnd),
    cursor: lineStart + newLine.length,
  };
}

export function MarkdownTextarea({
  name,
  defaultValue = "",
  rows = 3,
  placeholder,
}: {
  name: string;
  defaultValue?: string;
  rows?: number;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const ref = useRef<HTMLTextAreaElement>(null);

  function wrapSelection(before: string, after: string = before) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const next =
      value.slice(0, start) + before + selected + after + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + before.length;
      el.selectionEnd = start + before.length + selected.length;
    });
  }

  function applyHeading(level: number) {
    const el = ref.current;
    if (!el) return;
    const { value: next, cursor } = setHeadingLevel(
      value,
      el.selectionStart,
      level,
    );
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = cursor;
    });
  }

  function insertListItem() {
    const el = ref.current;
    if (!el) return;
    const pos = el.selectionStart;
    const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
    const next = value.slice(0, lineStart) + "- " + value.slice(lineStart);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = pos + 2;
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1 rounded-t-lg border border-b-0 border-border bg-surface px-2 py-1.5">
        <button
          type="button"
          onClick={() => wrapSelection("**")}
          title="Bold"
          className="flex h-7 w-7 items-center justify-center rounded text-sm font-bold text-ink hover:bg-border-soft"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => wrapSelection("*")}
          title="Italic"
          className="flex h-7 w-7 items-center justify-center rounded text-sm italic text-ink hover:bg-border-soft"
        >
          I
        </button>
        <select
          onChange={(e) => {
            applyHeading(Number(e.target.value));
            e.target.selectedIndex = 0;
          }}
          defaultValue="0"
          title="Font size"
          className="h-7 rounded border border-border bg-bg px-1 text-xs text-ink outline-none"
        >
          <option value="0">Normal text</option>
          <option value="3">Small heading</option>
          <option value="2">Medium heading</option>
          <option value="1">Large heading</option>
        </select>
        <button
          type="button"
          onClick={() => wrapSelection("[", "](https://)")}
          title="Link"
          className="flex h-7 w-7 items-center justify-center rounded text-sm text-ink hover:bg-border-soft"
        >
          &#128279;
        </button>
        <button
          type="button"
          onClick={insertListItem}
          title="Bulleted list"
          className="flex h-7 w-7 items-center justify-center rounded text-sm text-ink hover:bg-border-soft"
        >
          &#8226;
        </button>
      </div>
      <textarea
        ref={ref}
        name={name}
        rows={rows}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="rounded-b-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
      />
    </div>
  );
}
