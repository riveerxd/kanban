"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task } from "./KanbanBoard";

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
}

export function TaskCard({ task, isDragging = false }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        bg-white dark:bg-slate-800
        p-4 rounded-lg shadow-sm
        border border-slate-200 dark:border-slate-700
        cursor-grab active:cursor-grabbing
        hover:shadow-md transition-shadow
        ${isDragging ? "opacity-50" : ""}
      `}
    >
      <h3 className="font-medium text-slate-800 dark:text-slate-100 mb-1">
        {task.title}
      </h3>
      {task.description && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {task.description}
        </p>
      )}
    </div>
  );
}
