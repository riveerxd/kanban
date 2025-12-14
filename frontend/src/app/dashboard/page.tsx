"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { BoardCard } from "@/components/BoardCard";
import { CreateBoardModal } from "@/components/CreateBoardModal";

export default function DashboardPage() {
  const { user, logout, isLoading, token } = useAuth();
  const router = useRouter();
  const [boards, setBoards] = useState<api.BoardDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    const loadBoards = async () => {
      if (!token) return;

      try {
        const fetchedBoards = await api.getBoards(token);
        setBoards(fetchedBoards);
      } catch (error) {
        console.error("Failed to load boards:", error);
      } finally {
        setLoading(false);
      }
    };

    if (!isLoading && user && token) {
      loadBoards();
    }
  }, [isLoading, user, token]);

  const handleCreateBoard = async (title: string) => {
    if (!token) return;

    try {
      const newBoard = await api.createBoard(token, { title });
      // Create default columns
      await api.createColumn(token, newBoard.id, { title: "To Do", position: 0 });
      await api.createColumn(token, newBoard.id, { title: "In Progress", position: 1 });
      await api.createColumn(token, newBoard.id, { title: "Done", position: 2 });

      // Navigate to the new board
      router.push(`/board/${newBoard.id}`);
    } catch (error) {
      console.error("Failed to create board:", error);
      throw error;
    }
  };

  const handleDeleteBoard = async (boardId: number) => {
    if (!token) return;

    try {
      await api.deleteBoard(token, boardId);
      setBoards(boards.filter(b => b.id !== boardId));
    } catch (error) {
      console.error("Failed to delete board:", error);
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
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

  const myBoards = boards.filter(b => b.userId === user.id);
  const sharedBoards = boards.filter(b => b.userId !== user.id);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                <svg className="w-6 h-6 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground tracking-tight">My Boards</h1>
                <p className="text-xs text-muted-foreground">Select a board to get started</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
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

      <main className="p-8">
        {/* My Boards Section */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-foreground">My Boards</h2>
            <Button onClick={() => setIsCreateModalOpen(true)} size="sm">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Board
            </Button>
          </div>

          {myBoards.length === 0 ? (
            <div className="border-2 border-dashed border-border rounded-xl p-12 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No boards yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Create your first board to start organizing tasks</p>
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Board
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {myBoards.map((board) => (
                <BoardCard
                  key={board.id}
                  board={board}
                  isOwner={true}
                  onDelete={() => handleDeleteBoard(board.id)}
                  onClick={() => router.push(`/board/${board.id}`)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Shared With Me Section */}
        {sharedBoards.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-6">Shared With Me</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sharedBoards.map((board) => (
                <BoardCard
                  key={board.id}
                  board={board}
                  isOwner={false}
                  onClick={() => router.push(`/board/${board.id}`)}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <CreateBoardModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateBoard}
      />
    </div>
  );
}
