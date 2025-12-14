"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import { ShareBoardModal } from "./ShareBoardModal";
import { useWebSocket } from "@/hooks/useWebSocket";
import * as api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export interface Task {
  id: string;
  title: string;
  description?: string;
  columnId: string;
  position: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ColumnType {
  id: string;
  title: string;
  tasks: Task[];
  position: number;
}

interface KanbanBoardProps {
  boardId: number;
}

export function KanbanBoard({ boardId }: KanbanBoardProps) {
  const { user, logout, isLoading, token } = useAuth();
  const router = useRouter();
  const [columns, setColumns] = useState<ColumnType[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [boardOwnerId, setBoardOwnerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isRenamingBoard, setIsRenamingBoard] = useState(false);
  const [boardTitle, setBoardTitle] = useState("");
  const columnsRef = useRef<ColumnType[]>([]);
  const [locks, setLocks] = useState<Record<string, {username: string, mine: boolean}>>({});

  // Keep columnsRef in sync with columns state
  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  // WebSocket message handler
  const handleWebSocketMessage = useCallback((message: any) => {
    // Handle lock messages for current user first (these are personal responses)
    if (message.type === 'lock.granted' || message.type === 'lock.denied') {
      switch (message.type) {
        case 'lock.granted': {
          const { resourceType, resourceId } = message.payload;
          setLocks(prev => ({
            ...prev,
            [`${resourceType}_${resourceId}`]: { username: user?.username || 'You', mine: true }
          }));
          break;
        }
        case 'lock.denied': {
          alert(`Locked by ${message.payload.lockedBy}`);
          break;
        }
      }
      return;
    }

    // Ignore other messages from current user (already applied optimistically)
    if (message.userId === user?.id) {
      return;
    }

    switch (message.type) {
      case 'task.created': {
        const task = message.payload;
        setColumns(prevColumns => prevColumns.map(col => {
          if (col.id === task.columnId.toString()) {
            const taskExists = col.tasks.some(t => t.id === task.id.toString());
            if (taskExists) {
              return col;
            }
            return {
              ...col,
              tasks: [...col.tasks, {
                id: task.id.toString(),
                title: task.title,
                description: task.description,
                columnId: task.columnId.toString(),
                position: task.position,
                createdAt: task.createdAt,
                updatedAt: task.updatedAt
              }]
            };
          }
          return col;
        }));
        break;
      }

      case 'task.updated': {
        const task = message.payload;
        setColumns(prevColumns => prevColumns.map(col => ({
          ...col,
          tasks: col.tasks.map(t =>
            t.id === task.id.toString()
              ? { ...t, title: task.title, description: task.description, position: task.position }
              : t
          )
        })));
        break;
      }

      case 'task.moved': {
        const { id, oldColumnId, newColumnId, newPosition } = message.payload;
        // Reload board to get consistent state after remote move
        if (boardId && token) {
          api.getBoard(token, boardId).then(board => {
            setColumns(
              board.columns.map((col) => ({
                id: col.id.toString(),
                title: col.title,
                position: col.position,
                tasks: col.tasks.map((task) => ({
                  id: task.id.toString(),
                  title: task.title,
                  description: task.description,
                  columnId: col.id.toString(),
                  position: task.position,
                  createdAt: task.createdAt,
                  updatedAt: task.updatedAt,
                })),
              }))
            );
          });
        }
        break;
      }

      case 'task.deleted': {
        const { id } = message.payload;
        setColumns(prevColumns => prevColumns.map(col => ({
          ...col,
          tasks: col.tasks.filter(t => t.id !== id.toString())
        })));
        break;
      }

      case 'column.created': {
        const column = message.payload;
        setColumns(prevColumns => [...prevColumns, {
          id: column.id.toString(),
          title: column.title,
          position: column.position,
          tasks: []
        }]);
        break;
      }

      case 'column.updated': {
        const { id, title, position } = message.payload;
        setColumns(prevColumns => prevColumns.map(col =>
          col.id === id.toString()
            ? { ...col, title, position }
            : col
        ));
        break;
      }

      case 'column.deleted': {
        const { id } = message.payload;
        setColumns(prevColumns => prevColumns.filter(col => col.id !== id.toString()));
        break;
      }

      case 'board.updated': {
        if (message.payload?.title) {
          setBoardTitle(message.payload.title);
        }
        break;
      }

      case 'member.joined':
      case 'member.left': {
        // Optionally show notification
        break;
      }

      case 'lock.acquired': {
        const { resourceType, resourceId, username, userId } = message.payload;
        // Only update if it's not the current user (they already got lock.granted)
        if (userId !== user?.id) {
          setLocks(prev => ({
            ...prev,
            [`${resourceType}_${resourceId}`]: { username, mine: false }
          }));
        }
        break;
      }

      case 'lock.released': {
        const { resourceType, resourceId } = message.payload;
        setLocks(prev => {
          const newLocks = { ...prev };
          delete newLocks[`${resourceType}_${resourceId}`];
          return newLocks;
        });
        break;
      }
    }
  }, [user?.id, user?.username, boardId, token]);

  // Setup WebSocket connection
  const { isConnected, requestLock, releaseLock } = useWebSocket({
    boardId,
    token,
    onMessage: handleWebSocketMessage
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Load board data
  useEffect(() => {
    const loadBoard = async () => {
      if (!token || !boardId) return;

      try {
        const board = await api.getBoard(token, boardId);
        setBoardOwnerId(board.userId);
        setBoardTitle(board.title);
        setColumns(
          board.columns.map((col) => ({
            id: col.id.toString(),
            title: col.title,
            position: col.position,
            tasks: col.tasks.map((task) => ({
              id: task.id.toString(),
              title: task.title,
              description: task.description,
              columnId: col.id.toString(),
              position: task.position,
              createdAt: task.createdAt,
              updatedAt: task.updatedAt,
            })),
          }))
        );
      } catch (error) {
        console.error("Failed to load board:", error);
        router.push("/dashboard");
      } finally {
        setLoading(false);
      }
    };

    if (!isLoading && user && token) {
      loadBoard();
    }
  }, [isLoading, user, token, boardId, router]);

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

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    setColumns((prevColumns) => {
      // Find source column and task
      const sourceColumn = prevColumns.find((col) =>
        col.tasks.some((task) => task.id === activeId)
      );
      if (!sourceColumn) return prevColumns;

      const taskIndex = sourceColumn.tasks.findIndex((t) => t.id === activeId);
      const draggedTask = sourceColumn.tasks[taskIndex];

      // Find target column
      let targetColumn = prevColumns.find((col) => col.id === overId);
      if (!targetColumn) {
        targetColumn = prevColumns.find((col) =>
          col.tasks.some((task) => task.id === overId)
        );
      }
      if (!targetColumn) return prevColumns;

      // Same column reordering
      if (sourceColumn.id === targetColumn.id) {
        const overIndex = sourceColumn.tasks.findIndex((t) => t.id === overId);
        if (overIndex === -1) return prevColumns;

        const reorderedTasks = [...sourceColumn.tasks];
        reorderedTasks.splice(taskIndex, 1);
        reorderedTasks.splice(overIndex, 0, draggedTask);

        return prevColumns.map((col) =>
          col.id === sourceColumn.id
            ? { ...col, tasks: reorderedTasks }
            : col
        );
      }

      // Cross-column move
      const newSourceTasks = sourceColumn.tasks.filter((t) => t.id !== activeId);

      const overTaskIndex = targetColumn.tasks.findIndex((t) => t.id === overId);
      const insertPosition = overTaskIndex !== -1 ? overTaskIndex : targetColumn.tasks.length;

      const newTargetTasks = [...targetColumn.tasks];
      newTargetTasks.splice(insertPosition, 0, {
        ...draggedTask,
        columnId: targetColumn.id,
      });

      return prevColumns.map((col) => {
        if (col.id === sourceColumn.id) {
          return { ...col, tasks: newSourceTasks };
        }
        if (col.id === targetColumn.id) {
          return { ...col, tasks: newTargetTasks };
        }
        return col;
      });
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;

    if (!over) {
      return;
    }

    if (!token) {
      return;
    }

    if (!boardId) {
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Get final state from ref (after handleDragOver updated it)
    const finalColumns = columnsRef.current;

    // Find the column containing the moved task
    const targetColumn = finalColumns.find((col) =>
      col.tasks.some((task) => task.id === activeId)
    );

    if (!targetColumn) {
      return;
    }

    const taskId = parseInt(activeId);
    const columnId = parseInt(targetColumn.id);
    const taskPosition = targetColumn.tasks.findIndex((t) => t.id === activeId);

    // Persist to backend - backend handles all position recalculations
    try {
      await api.moveTask(token, taskId, {
        columnId: columnId,
        position: taskPosition,
      });

      // Reload board to get consistent state from backend
      const updatedBoard = await api.getBoard(token, boardId);
      setColumns(
        updatedBoard.columns.map((col) => ({
          id: col.id.toString(),
          title: col.title,
          position: col.position,
          tasks: col.tasks.map((task) => ({
            id: task.id.toString(),
            title: task.title,
            description: task.description,
            columnId: col.id.toString(),
            position: task.position,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
          })),
        }))
      );
    } catch (error) {
      console.error("Failed to move task:", error);
      // Reload board on error to revert to consistent state
      try {
        const board = await api.getBoard(token, boardId);
        setColumns(
          board.columns.map((col) => ({
            id: col.id.toString(),
            title: col.title,
            position: col.position,
            tasks: col.tasks.map((task) => ({
              id: task.id.toString(),
              title: task.title,
              description: task.description,
              columnId: col.id.toString(),
              position: task.position,
            })),
          }))
        );
      } catch (reloadError) {
        console.error("Failed to reload board:", reloadError);
      }
    }
  };

  const handleAddColumn = async (title: string) => {
    if (!title.trim() || !token || !boardId) return;

    try {
      const newColumn = await api.createColumn(token, boardId, {
        title: title.trim(),
        position: columns.length,
      });

      setColumns([
        ...columns,
        {
          id: newColumn.id.toString(),
          title: newColumn.title,
          position: newColumn.position,
          tasks: [],
        },
      ]);
      setNewColumnTitle("");
      setIsAddingColumn(false);
    } catch (error) {
      console.error("Failed to create column:", error);
    }
  };

  const handleCancelAddColumn = () => {
    setNewColumnTitle("");
    setIsAddingColumn(false);
  };

  const handleAddTask = async (columnId: string, title: string, description: string) => {
    if (!token) return;

    try {
      const numericColumnId = parseInt(columnId);
      const column = columns.find((col) => col.id === columnId);
      if (!column) return;

      const newTask = await api.createTask(token, numericColumnId, {
        title,
        description: description || undefined,
        position: column.tasks.length,
      });

      setColumns(
        columns.map((col) => {
          if (col.id === columnId) {
            return {
              ...col,
              tasks: [
                ...col.tasks,
                {
                  id: newTask.id.toString(),
                  title: newTask.title,
                  description: newTask.description,
                  columnId: col.id,
                  position: newTask.position,
                  createdAt: newTask.createdAt,
                  updatedAt: newTask.updatedAt,
                },
              ],
            };
          }
          return col;
        })
      );
    } catch (error) {
      console.error("Failed to create task:", error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!token) return;

    try {
      await api.deleteTask(token, parseInt(taskId));
      setColumns(
        columns.map((col) => ({
          ...col,
          tasks: col.tasks.filter((task) => task.id !== taskId),
        }))
      );
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  };

  const handleEditTask = async (taskId: string, title: string, description: string) => {
    if (!token) return;

    try {
      const task = columns.flatMap((col) => col.tasks).find((t) => t.id === taskId);
      if (!task) return;

      await api.updateTask(token, parseInt(taskId), {
        title,
        description,
        position: task.position,
      });

      setColumns(
        columns.map((col) => ({
          ...col,
          tasks: col.tasks.map((t) =>
            t.id === taskId ? { ...t, title, description } : t
          ),
        }))
      );

      // Release lock after edit and clear local lock state immediately
      releaseLock('task', parseInt(taskId));
      setLocks(prev => {
        const newLocks = { ...prev };
        delete newLocks[`task_${taskId}`];
        return newLocks;
      });
      setEditingTaskId(null);
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!token || !boardId) return;

    try {
      await api.deleteColumn(token, boardId, parseInt(columnId));
      setColumns(columns.filter((col) => col.id !== columnId));
    } catch (error) {
      console.error("Failed to delete column:", error);
    }
  };

  const handleEditColumn = async (columnId: string, title: string) => {
    if (!token || !boardId) return;

    try {
      const column = columns.find((col) => col.id === columnId);
      if (!column) return;

      await api.updateColumn(token, boardId, parseInt(columnId), {
        title,
        position: column.position,
      });

      setColumns(
        columns.map((col) =>
          col.id === columnId ? { ...col, title } : col
        )
      );
    } catch (error) {
      console.error("Failed to update column:", error);
    }
  };

  // Redirect to dashboard if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  const handleBack = () => {
    router.push("/dashboard");
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleRenameBoard = async () => {
    if (!token || !boardId || !boardTitle.trim()) return;

    try {
      await api.updateBoard(token, boardId, { title: boardTitle.trim() });
      setIsRenamingBoard(false);
    } catch (error) {
      console.error("Failed to rename board:", error);
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Back Button and Title */}
            <div className="flex items-center gap-3">
              <Button
                onClick={handleBack}
                variant="ghost"
                size="sm"
                className="h-10 w-10 p-0 hover:bg-muted"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Button>
              <div>
                {isRenamingBoard ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={boardTitle}
                      onChange={(e) => setBoardTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameBoard();
                        if (e.key === "Escape") {
                          setIsRenamingBoard(false);
                        }
                      }}
                      className="h-8 text-xl font-bold"
                      autoFocus
                    />
                    <Button onClick={handleRenameBoard} size="sm" variant="ghost">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </Button>
                    <Button onClick={() => setIsRenamingBoard(false)} size="sm" variant="ghost">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-foreground tracking-tight">
                      {boardTitle || "Kanban Board"}
                    </h1>
                    <Button
                      onClick={() => setIsRenamingBoard(true)}
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 hover:bg-muted"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Organize your tasks</p>
              </div>
            </div>

            {/* User Info and Actions */}
            <div className="flex items-center gap-3">
              {/* WebSocket Connection Status */}
              {isConnected ? (
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
                  <span className="hidden sm:inline">Live</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-yellow-600 text-sm">
                  <span className="w-2 h-2 bg-yellow-600 rounded-full" />
                  <span className="hidden sm:inline">Reconnecting...</span>
                </div>
              )}

              {/* Share Button */}
              <Button
                onClick={() => setIsShareModalOpen(true)}
                variant="outline"
                size="sm"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Share
              </Button>

              <div className="hidden sm:flex items-center gap-3 px-4 py-2 rounded-lg bg-muted/50">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{user.username}</span>
                  <span className="text-xs text-muted-foreground">{user.email}</span>
                </div>
              </div>
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="p-8">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {columns.map((column) => (
              <Column
                key={column.id}
                column={column}
                onAddTask={handleAddTask}
                editingTaskId={editingTaskId}
                onEditingChange={setEditingTaskId}
                onDeleteColumn={() => handleDeleteColumn(column.id)}
                onEditColumn={(title) => handleEditColumn(column.id, title)}
                onDeleteTask={handleDeleteTask}
                onEditTask={handleEditTask}
                locks={locks}
                onRequestLock={requestLock}
                onReleaseLock={releaseLock}
                onClearLock={(resourceType, resourceId) => {
                  setLocks(prev => {
                    const newLocks = { ...prev };
                    delete newLocks[`${resourceType}_${resourceId}`];
                    return newLocks;
                  });
                }}
              />
            ))}

            {isAddingColumn ? (
              <Card className="flex-shrink-0 min-w-[320px] p-4 border-2 border-primary">
                <Input
                  type="text"
                  value={newColumnTitle}
                  onChange={(e) => setNewColumnTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddColumn(newColumnTitle);
                    if (e.key === "Escape") handleCancelAddColumn();
                  }}
                  placeholder="Column title"
                  autoFocus
                  className="font-semibold text-lg mb-3"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleAddColumn(newColumnTitle)}
                    size="sm"
                  >
                    Save
                  </Button>
                  <Button
                    onClick={handleCancelAddColumn}
                    variant="outline"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </Card>
            ) : (
              <Button
                onClick={() => setIsAddingColumn(true)}
                variant="outline"
                className="flex-shrink-0 min-w-[320px] h-fit border-2 border-dashed hover:border-primary p-8 flex flex-col items-center justify-center gap-2 hover:text-primary"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-sm font-medium">Add column</span>
              </Button>
            )}
          </div>
          <DragOverlay>
            {activeTask ? (
              <TaskCard task={activeTask} isDragging />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Share Board Modal */}
      {boardOwnerId !== null && (
        <ShareBoardModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          boardId={boardId}
          ownerId={boardOwnerId}
        />
      )}
    </div>
  );
}
