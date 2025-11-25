"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TaskCard } from "./TaskCard";
import { ColumnType } from "./KanbanBoard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

interface ColumnProps {
  column: ColumnType;
  onAddTask: (columnId: string, title: string, description: string) => void;
  editingTaskId: string | null;
  onEditingChange: (taskId: string | null) => void;
  onDeleteColumn?: () => void;
  onEditColumn?: (title: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onEditTask?: (taskId: string, title: string, description: string) => void;
  locks: Record<string, {username: string, mine: boolean}>;
  onRequestLock: (resourceType: string, resourceId: number) => void;
  onReleaseLock: (resourceType: string, resourceId: number) => void;
}

export function Column({ column, onAddTask, editingTaskId, onEditingChange, onDeleteColumn, onEditColumn, onDeleteTask, onEditTask, locks, onRequestLock, onReleaseLock }: ColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });
  const [isHovered, setIsHovered] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState(column.title);

  const handleAddClick = () => {
    onEditingChange(`new-${column.id}`);
  };

  const handleSaveNew = (title: string, description: string) => {
    onAddTask(column.id, title, description);
    onEditingChange(null);
  };

  const handleCancel = () => {
    onEditingChange(null);
  };

  const handleSaveTitle = () => {
    if (editingTitle.trim() && onEditColumn) {
      onEditColumn(editingTitle.trim());
      setIsEditingTitle(false);
    }
  };

  const handleCancelEditTitle = () => {
    setEditingTitle(column.title);
    setIsEditingTitle(false);
  };

  const isAddingNew = editingTaskId === `new-${column.id}`;

  return (
    <Card
      className="flex flex-col min-w-[320px] p-4 group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isHovered && onDeleteColumn && (
        <Button
          onClick={onDeleteColumn}
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 p-1 h-auto w-auto hover:bg-destructive/10 text-destructive z-10"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </Button>
      )}

      {isEditingTitle ? (
        <div className="mb-4">
          <Input
            type="text"
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveTitle();
              if (e.key === "Escape") handleCancelEditTitle();
            }}
            autoFocus
            className="font-semibold text-lg mb-2 pr-8"
          />
          <div className="flex gap-2">
            <Button
              onClick={handleSaveTitle}
              size="sm"
            >
              Save
            </Button>
            <Button
              onClick={handleCancelEditTitle}
              variant="outline"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <h2
          className="font-semibold text-lg mb-4 text-foreground pr-8 cursor-pointer hover:text-primary transition-colors"
          onDoubleClick={() => setIsEditingTitle(true)}
        >
          {column.title}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            ({column.tasks.length})
          </span>
        </h2>
      )}
      <SortableContext
        id={column.id}
        items={column.tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className="flex flex-col gap-3 flex-1 min-h-[200px] p-2 rounded-md bg-muted/50"
        >
          {column.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isEditing={editingTaskId === task.id}
              onSave={(title, description) => {
                if (onEditTask) {
                  onEditTask(task.id, title, description);
                }
                onEditingChange(null);
              }}
              onCancel={() => {
                onReleaseLock('task', parseInt(task.id));
                onEditingChange(null);
              }}
              onDelete={() => onDeleteTask?.(task.id)}
              onEdit={() => {
                // For inline edit: request lock AND set editing state
                onRequestLock('task', parseInt(task.id));
                onEditingChange(task.id);
              }}
              lock={locks[`task_${task.id}`]}
              onRequestLock={onRequestLock}
              onReleaseLock={onReleaseLock}
            />
          ))}

          {isAddingNew && (
            <TaskCard
              task={{ id: `new-${column.id}`, title: "", description: "", columnId: column.id, position: column.tasks.length }}
              isEditing={true}
              onSave={handleSaveNew}
              onCancel={handleCancel}
            />
          )}

          {!isAddingNew && (isHovered || column.tasks.length === 0) && (
            <Button
              onClick={handleAddClick}
              variant="outline"
              className="border-2 border-dashed hover:border-primary p-4 flex items-center justify-center gap-2 hover:text-primary group-hover:opacity-100 opacity-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-sm font-medium">Add task</span>
            </Button>
          )}
        </div>
      </SortableContext>
    </Card>
  );
}
