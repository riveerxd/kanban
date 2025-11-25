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
}

export interface ColumnType {
  id: string;
  title: string;
  tasks: Task[];
  position: number;
}

export function KanbanBoard() {
  const { user, logout, isLoading, token } = useAuth();
  const router = useRouter();
  const [columns, setColumns] = useState<ColumnType[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [boardId, setBoardId] = useState<number | null>(null);
  const [boards, setBoards] = useState<api.BoardDto[]>([]);
  const [boardOwnerId, setBoardOwnerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showBoardSelector, setShowBoardSelector] = useState(false);
  const creatingBoardRef = useRef(false);
  const columnsRef = useRef<ColumnType[]>([]);

  // Keep columnsRef in sync with columns state
  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  // WebSocket message handler
  const handleWebSocketMessage = useCallback((message: any) => {
    // Ignore messages from current user (already applied optimistically)
    if (message.userId === user?.id) {
      return;
    }

    console.log('WebSocket message received:', message);

    switch (message.type) {
      case 'task.created': {
        const task = message.payload;
        setColumns(prevColumns => prevColumns.map(col => {
          if (col.id === task.columnId.toString()) {
            return {
              ...col,
              tasks: [...col.tasks, {
                id: task.id.toString(),
                title: task.title,
                description: task.description,
                columnId: task.columnId.toString(),
                position: task.position
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
        // Optionally handle board title updates
        break;
      }

      case 'member.joined':
      case 'member.left': {
        // Optionally show notification
        break;
      }
    }
  }, [user?.id, boardId, token]);

  // Setup WebSocket connection
  const { isConnected } = useWebSocket({
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

  const switchBoard = async (newBoardId: number) => {
    if (!token) return;

    try {
      setLoading(true);
      const board = await api.getBoard(token, newBoardId);
      setBoardId(board.id);
      setBoardOwnerId(board.userId);
      localStorage.setItem("currentBoardId", board.id.toString());
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
      setShowBoardSelector(false);
    } catch (error) {
      console.error("Failed to switch board:", error);
    } finally {
      setLoading(false);
    }
  };

  // Load board data
  useEffect(() => {
    const loadBoard = async () => {
      if (!token) return;

      try {
        const fetchedBoards = await api.getBoards(token);
        setBoards(fetchedBoards);

        if (fetchedBoards.length === 0) {
          // Prevent double creation in React StrictMode
          if (creatingBoardRef.current) return;
          creatingBoardRef.current = true;

          // Create a default board
          const newBoard = await api.createBoard(token, { title: "My Kanban Board" });
          setBoardId(newBoard.id);
          localStorage.setItem("currentBoardId", newBoard.id.toString());

          // Create default columns
          await api.createColumn(token, newBoard.id, { title: "To Do", position: 0 });
          await api.createColumn(token, newBoard.id, { title: "In Progress", position: 1 });
          await api.createColumn(token, newBoard.id, { title: "Done", position: 2 });

          // Reload board
          const updatedBoard = await api.getBoard(token, newBoard.id);
          setBoardId(updatedBoard.id);
          setBoardOwnerId(updatedBoard.userId);
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
              })),
            }))
          );
        } else {
          // Try to load saved board, otherwise load the latest (highest ID)
          const savedBoardId = localStorage.getItem("currentBoardId");
          let board = savedBoardId
            ? fetchedBoards.find(b => b.id === parseInt(savedBoardId))
            : null;

          // If saved board not found, use the one with highest ID (most recent)
          if (!board) {
            board = fetchedBoards.reduce((latest, current) =>
              current.id > latest.id ? current : latest
            );
          }

          setBoardId(board.id);
          setBoardOwnerId(board.userId);
          localStorage.setItem("currentBoardId", board.id.toString());
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
        }
      } catch (error) {
        console.error("Failed to load board:", error);
      } finally {
        setLoading(false);
      }
    };

    if (!isLoading && user && token) {
      loadBoard();
    }
  }, [isLoading, user, token]);

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

    console.log("🎯 DragEnd fired:", { activeId: active.id, overId: over?.id });

    if (!over) {
      console.log("❌ No over element");
      return;
    }

    if (!token) {
      console.log("❌ No token");
      return;
    }

    if (!boardId) {
      console.log("❌ No boardId");
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
      console.log("❌ Target column not found");
      return;
    }

    const taskId = parseInt(activeId);
    const columnId = parseInt(targetColumn.id);
    const taskPosition = targetColumn.tasks.findIndex((t) => t.id === activeId);

    console.log("🚀 Making API call:", { taskId, columnId, taskPosition });

    // Persist to backend - backend handles all position recalculations
    try {
      await api.moveTask(token, taskId, {
        columnId: columnId,
        position: taskPosition,
      });

      console.log("✅ API call successful, reloading board");

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
          })),
        }))
      );
    } catch (error) {
      console.error("❌ Failed to move task:", error);
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

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

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

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo and Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                <svg className="w-6 h-6 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground tracking-tight">
                  Kanban Board
                </h1>
                <p className="text-xs text-muted-foreground">Organize your tasks</p>
              </div>
            </div>

            {/* User Info and Actions */}
            <div className="flex items-center gap-3">
              {/* WebSocket Connection Status */}
              {boardId && (
                isConnected ? (
                  <div className="flex items-center gap-2 text-green-600 text-sm">
                    <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
                    <span className="hidden sm:inline">Live</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-yellow-600 text-sm">
                    <span className="w-2 h-2 bg-yellow-600 rounded-full" />
                    <span className="hidden sm:inline">Reconnecting...</span>
                  </div>
                )
              )}

              {/* Board Selector */}
              {boards.length > 1 && boardId && (
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBoardSelector(!showBoardSelector)}
                    className="min-w-[120px] justify-between"
                  >
                    <span className="truncate">
                      {boards.find(b => b.id === boardId)?.title || "Board"}
                    </span>
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </Button>
                  {showBoardSelector && (
                    <div className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                      <div className="p-2 space-y-1 max-h-[400px] overflow-y-auto">
                        {boards.map((board) => (
                          <button
                            key={board.id}
                            onClick={() => switchBoard(board.id)}
                            className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                              board.id === boardId
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-muted"
                            }`}
                          >
                            <div className="font-medium truncate">{board.title}</div>
                            <div className="text-xs opacity-80">
                              {board.userId === user?.id ? "Owner" : "Shared with you"}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Share Button */}
              {boardId && (
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
              )}

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
      {boardId && boardOwnerId !== null && (
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
