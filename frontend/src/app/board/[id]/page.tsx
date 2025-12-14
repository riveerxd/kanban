"use client";

import { use } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";

interface BoardPageProps {
  params: Promise<{ id: string }>;
}

export default function BoardPage({ params }: BoardPageProps) {
  const { id } = use(params);
  return <KanbanBoard boardId={parseInt(id)} />;
}
