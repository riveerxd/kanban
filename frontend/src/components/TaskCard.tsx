"use client";

import { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task } from "./KanbanBoard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
  isEditing?: boolean;
  onSave?: (title: string, description: string) => void;
  onCancel?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
}

export function TaskCard({ task, isDragging = false, isEditing = false, onSave, onCancel, onDelete, onEdit }: TaskCardProps) {
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description || "");
  const [isHovered, setIsHovered] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalEditTitle, setModalEditTitle] = useState(task.title);
  const [modalEditDescription, setModalEditDescription] = useState(task.description || "");
  const [isEditingInModal, setIsEditingInModal] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const modalTitleRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: task.id,
    disabled: isEditing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  useEffect(() => {
    if (isEditing && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    if (isEditingInModal && modalTitleRef.current) {
      modalTitleRef.current.focus();
    }
  }, [isEditingInModal]);

  useEffect(() => {
    setModalEditTitle(task.title);
    setModalEditDescription(task.description || "");
  }, [task.title, task.description]);

  const handleSave = () => {
    if (editTitle.trim() && onSave) {
      onSave(editTitle.trim(), editDescription.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      onCancel?.();
    }
  };

  if (isEditing) {
    return (
      <Card className="p-4 border-2 border-primary">
        <Input
          ref={titleInputRef}
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Task title"
          className="font-medium mb-2"
        />
        <Textarea
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Description (optional)"
          className="text-sm resize-none"
          rows={2}
        />
        <div className="flex gap-2 mt-2">
          <Button
            onClick={handleSave}
            size="sm"
          >
            Save
          </Button>
          <Button
            onClick={onCancel}
            variant="outline"
            size="sm"
          >
            Cancel
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onDoubleClick={onEdit}
        onClick={(e) => {
          if (!isEditing && !(e.target as HTMLElement).closest('button')) {
            setIsModalOpen(true);
          }
        }}
        className={`
          p-4 cursor-grab active:cursor-grabbing
          hover:shadow-md transition-shadow
          relative group
          ${isDragging ? "opacity-50" : ""}
        `}
      >
        {isHovered && onDelete && (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 p-1 h-auto w-auto hover:bg-destructive/10 text-destructive z-10"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </Button>
        )}
        <h3 className="font-medium text-foreground pr-6">
          {task.title}
        </h3>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={(open) => {
        setIsModalOpen(open);
        if (!open) {
          setIsEditingInModal(false);
        }
      }}>
        <DialogContent className="aspect-square w-[min(90vw,90vh)] max-w-[min(90vw,90vh)] h-[min(90vw,90vh)] max-h-[min(90vw,90vh)] flex flex-col p-6">
          <DialogHeader className="flex-shrink-0">
            {isEditingInModal ? (
              <Input
                ref={modalTitleRef}
                type="text"
                value={modalEditTitle}
                onChange={(e) => setModalEditTitle(e.target.value)}
                className="text-3xl font-bold h-auto py-2"
              />
            ) : (
              <DialogTitle className="text-3xl font-bold text-foreground">
                {task.title}
              </DialogTitle>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 px-2 py-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground/80 mb-3">Description</h3>
              {isEditingInModal ? (
                <Textarea
                  value={modalEditDescription}
                  onChange={(e) => setModalEditDescription(e.target.value)}
                  placeholder="Add a description..."
                  className="min-h-[150px] text-base resize-none"
                />
              ) : (
                <p className="text-base text-muted-foreground whitespace-pre-wrap">
                  {task.description || "No description provided"}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {task.createdAt && (
                <div>
                  <h3 className="text-lg font-semibold text-foreground/80 mb-2">Created At</h3>
                  <p className="text-base text-muted-foreground">
                    {new Date(task.createdAt).toLocaleString()}
                  </p>
                </div>
              )}

              {task.updatedAt && (
                <div>
                  <h3 className="text-lg font-semibold text-foreground/80 mb-2">Updated At</h3>
                  <p className="text-base text-muted-foreground">
                    {new Date(task.updatedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex-shrink-0 flex justify-between items-center pt-4 border-t border-border">
            {isEditingInModal ? (
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (onSave && modalEditTitle.trim()) {
                      onSave(modalEditTitle.trim(), modalEditDescription.trim());
                      setIsEditingInModal(false);
                    }
                  }}
                  size="sm"
                >
                  Save Changes
                </Button>
                <Button
                  onClick={() => {
                    setModalEditTitle(task.title);
                    setModalEditDescription(task.description || "");
                    setIsEditingInModal(false);
                  }}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setIsEditingInModal(true)}
                variant="outline"
                size="sm"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Task
              </Button>
            )}
            {onDelete && !isEditingInModal && (
              <Button
                onClick={() => {
                  onDelete();
                  setIsModalOpen(false);
                }}
                variant="outline"
                size="sm"
                className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
