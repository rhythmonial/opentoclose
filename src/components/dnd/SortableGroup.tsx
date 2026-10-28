"use client";

import { useId, useState, type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export function SortableGroup({
  items,
  onReorder,
}: {
  items: { id: string; node: ReactNode }[];
  onReorder: (orderedIds: string[]) => void | Promise<void>;
}) {
  // A stable id keeps dnd-kit's accessibility ids the same on server and
  // client, avoiding a hydration mismatch.
  const dndId = useId();
  const idsKey = items.map((i) => i.id).join(",");
  const [trackedKey, setTrackedKey] = useState(idsKey);
  const [order, setOrder] = useState(items.map((i) => i.id));

  if (idsKey !== trackedKey) {
    setTrackedKey(idsKey);
    setOrder(items.map((i) => i.id));
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);
    onReorder(next);
  }

  const byId = new Map(items.map((i) => [i.id, i.node]));

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1.5">
          {order.map((id) => (
            <SortableRow key={id} id={id}>
              {byId.get(id)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2">
      <button
        {...attributes}
        {...listeners}
        type="button"
        aria-label="Drag to reorder"
        className="mt-2 flex shrink-0 cursor-grab touch-none items-center text-ink-faint active:cursor-grabbing"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="8" cy="6" r="1.6" />
          <circle cx="8" cy="12" r="1.6" />
          <circle cx="8" cy="18" r="1.6" />
          <circle cx="16" cy="6" r="1.6" />
          <circle cx="16" cy="12" r="1.6" />
          <circle cx="16" cy="18" r="1.6" />
        </svg>
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
