"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove } from "@dnd-kit/sortable";
import { Column } from "./Column";
import { TaskCard } from "./TaskCard";

export interface Task {
  id: string;
  title: string;
  description?: string;
  columnId: string;
}

export interface ColumnType {
  id: string;
  title: string;
  tasks: Task[];
}

export function KanbanBoard() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const [columns, setColumns] = useState<ColumnType[]>([
    {
      id: "todo",
      title: "To Do",
      tasks: [
        { id: "1", title: "Task 1", description: "Description for task 1", columnId: "todo" },
        { id: "2", title: "Task 2", description: "Description for task 2", columnId: "todo" },
      ],
    },
    {
      id: "in-progress",
      title: "In Progress",
      tasks: [
        { id: "3", title: "Task 3", description: "Description for task 3", columnId: "in-progress" },
      ],
    },
    {
      id: "done",
      title: "Done",
      tasks: [
        { id: "4", title: "Task 4", description: "Description for task 4", columnId: "done" },
      ],
    },
  ]);

  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = columns
      .flatMap((col) => col.tasks)
      .find((task) => task.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const activeColumn = columns.find((col) =>
      col.tasks.some((task) => task.id === activeId)
    );
    const overColumn = columns.find(
      (col) => col.id === overId || col.tasks.some((task) => task.id === overId)
    );

    if (!activeColumn || !overColumn) return;

    if (activeColumn.id !== overColumn.id) {
      setColumns((columns) => {
        const activeTaskIndex = activeColumn.tasks.findIndex(
          (task) => task.id === activeId
        );
        const activeTask = activeColumn.tasks[activeTaskIndex];

        const overTaskIndex = overColumn.tasks.findIndex(
          (task) => task.id === overId
        );

        return columns.map((col) => {
          if (col.id === activeColumn.id) {
            return {
              ...col,
              tasks: col.tasks.filter((task) => task.id !== activeId),
            };
          }
          if (col.id === overColumn.id) {
            const newTasks = [...col.tasks];
            const insertIndex =
              overTaskIndex >= 0 ? overTaskIndex : newTasks.length;
            newTasks.splice(insertIndex, 0, {
              ...activeTask,
              columnId: col.id,
            });
            return { ...col, tasks: newTasks };
          }
          return col;
        });
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const activeColumn = columns.find((col) =>
      col.tasks.some((task) => task.id === activeId)
    );

    if (!activeColumn) return;

    const oldIndex = activeColumn.tasks.findIndex((task) => task.id === activeId);
    const newIndex = activeColumn.tasks.findIndex((task) => task.id === overId);

    if (oldIndex !== -1 && newIndex !== -1) {
      setColumns((columns) =>
        columns.map((col) => {
          if (col.id === activeColumn.id) {
            return {
              ...col,
              tasks: arrayMove(col.tasks, oldIndex, newIndex),
            };
          }
          return col;
        })
      );
    }
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="text-slate-600 dark:text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Kanban Board
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Welcome, <span className="font-medium text-slate-800 dark:text-slate-100">{user.username}</span>
            </span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-md transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 p-8 overflow-x-auto">
          {columns.map((column) => (
            <Column key={column.id} column={column} />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? (
            <TaskCard task={activeTask} isDragging />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
