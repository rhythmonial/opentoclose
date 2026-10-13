"use client";

import { useState } from "react";
import {
  addResource,
  updateResource,
  deleteResource,
  reorderResources,
} from "@/app/profile/setup-step-resources-actions";
import { SortableGroup } from "@/components/dnd/SortableGroup";

type Resource = { id: string; kind: string; label: string | null; url: string };

const KINDS = [
  { value: "google_doc", label: "Google Doc (copy)" },
  { value: "pdf", label: "PDF (download)" },
  { value: "link", label: "Link" },
];

export function StepResourcesEditor({
  stepId,
  initialResources,
}: {
  stepId: string;
  initialResources: Resource[];
}) {
  const [resources, setResources] = useState(initialResources);
  const [adding, setAdding] = useState(false);
  const [newKind, setNewKind] = useState("link");
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");

  async function handleAdd() {
    if (!newUrl.trim()) return;
    const row = await addResource(stepId, {
      kind: newKind,
      label: newLabel.trim(),
      url: newUrl.trim(),
    });
    setResources((prev) => [...prev, row]);
    setNewLabel("");
    setNewUrl("");
    setNewKind("link");
    setAdding(false);
  }

  async function handleSave(
    id: string,
    data: { kind: string; label: string; url: string },
  ) {
    setResources((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...data } : r)),
    );
    await updateResource(id, data);
  }

  async function handleDelete(id: string) {
    setResources((prev) => prev.filter((r) => r.id !== id));
    await deleteResource(id);
  }

  async function handleReorder(orderedIds: string[]) {
    setResources((prev) =>
      orderedIds.map((id) => prev.find((r) => r.id === id)!),
    );
    await reorderResources(stepId, orderedIds);
  }

  return (
    <div
      className="flex flex-col gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      <SortableGroup
        items={resources.map((r) => ({
          id: r.id,
          node: (
            <ResourceRow
              resource={r}
              onSave={(data) => handleSave(r.id, data)}
              onDelete={() => handleDelete(r.id)}
            />
          ),
        }))}
        onReorder={handleReorder}
      />

      {adding ? (
        <div className="flex items-end gap-2 rounded-lg border border-dashed border-border bg-bg p-2.5">
          <select
            value={newKind}
            onChange={(e) => setNewKind(e.target.value)}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-ink"
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label (optional)"
            className="flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-ink"
          />
          <input
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://..."
            className="flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-ink"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="text-xs text-ink-faint"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="self-start text-xs font-semibold text-accent"
        >
          + Add resource link
        </button>
      )}
    </div>
  );
}

function ResourceRow({
  resource,
  onSave,
  onDelete,
}: {
  resource: Resource;
  onSave: (data: { kind: string; label: string; url: string }) => void;
  onDelete: () => void;
}) {
  const [kind, setKind] = useState(resource.kind);
  const [label, setLabel] = useState(resource.label ?? "");
  const [url, setUrl] = useState(resource.url);
  const [dirty, setDirty] = useState(false);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border-soft bg-bg p-2.5">
      <select
        value={kind}
        onChange={(e) => {
          setKind(e.target.value);
          setDirty(true);
        }}
        className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-ink"
      >
        {KINDS.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </select>
      <input
        value={label}
        onChange={(e) => {
          setLabel(e.target.value);
          setDirty(true);
        }}
        placeholder="Label (optional)"
        className="flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-ink"
      />
      <input
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setDirty(true);
        }}
        placeholder="https://..."
        className="flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-ink"
      />
      {dirty && (
        <button
          type="button"
          onClick={() => {
            onSave({ kind, label, url });
            setDirty(false);
          }}
          className="shrink-0 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white"
        >
          Save
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 text-xs font-medium text-danger"
      >
        Delete
      </button>
    </div>
  );
}
