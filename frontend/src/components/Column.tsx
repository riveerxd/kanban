"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TaskCard } from "./TaskCard";
import { ColumnType } from "./KanbanBoard";

interface ColumnProps {
  column: ColumnType;
}

export function Column({ column }: ColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  return (
    <div className="flex flex-col min-w-[320px] bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4">
      <h2 className="font-semibold text-lg mb-4 text-slate-800 dark:text-slate-100">
        {column.title}
        <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
          ({column.tasks.length})
        </span>
      </h2>
      <SortableContext
        id={column.id}
        items={column.tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className="flex flex-col gap-3 flex-1 min-h-[200px] p-2 rounded-md bg-slate-50 dark:bg-slate-900/50"
        >
          {column.tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
