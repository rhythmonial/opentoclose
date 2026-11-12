"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setContractSide } from "@/app/configurator/upload_your_contract_docs/actions";

const ADD = "__add__";

// A contract's side (buyer, seller, transaction, listing, other, or one of
// their own), saved as soon as it's picked.
export function DocSideSelect({
  docId,
  value,
  sides,
}: {
  docId: string;
  value: string | null;
  sides: string[];
}) {
  const router = useRouter();
  const [side, setSide] = useState(value ?? "");
  const [options, setOptions] = useState(sides);

  async function save(next: string) {
    setSide(next);
    const res = await setContractSide(docId, next);
    if (!res.ok) window.alert(res.error ?? "Couldn't save.");
    router.refresh();
  }

  return (
    <select
      value={side}
      onChange={(e) => {
        if (e.target.value === ADD) {
          const name = window.prompt("Name your side")?.replace(/\s+/g, " ").trim().slice(0, 40);
          if (!name) return;
          if (!options.some((o) => o.toLowerCase() === name.toLowerCase())) {
            setOptions((o) => [...o, name]);
          }
          save(options.find((o) => o.toLowerCase() === name.toLowerCase()) ?? name);
          return;
        }
        save(e.target.value);
      }}
      aria-label="Side"
      className={`rounded-md border px-2 py-1 text-xs font-semibold ${
        side ? "border-border bg-bg text-ink" : "border-danger/40 bg-danger/5 text-danger"
      }`}
    >
      <option value="" disabled>
        Select a side
      </option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
      <option value={ADD}>+ Add your own&hellip;</option>
    </select>
  );
}
