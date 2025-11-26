const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5283";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const text = await response.text();
      if (text) {
        try {
          const json = JSON.parse(text);
          errorMessage = json.message || json.error || text;
        } catch {
          errorMessage = text;
        }
      }
    } catch {
      // Ignore
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
}

export interface AuthResponse {
  userId: number;
  token: string;
  email: string;
  username: string;
  expiresAt: string;
}

export interface TaskDto {
  id: number;
  columnId: number;
  title: string;
  description?: string;
  position: number;
  createdAt: string;
  updatedAt?: string;
}

export interface ColumnDto {
  id: number;
  boardId: number;
  title: string;
  position: number;
  createdAt: string;
  updatedAt?: string;
  tasks: TaskDto[];
}

export interface BoardDto {
  id: number;
  userId: number;
  title: string;
  createdAt: string;
  updatedAt?: string;
  columns: ColumnDto[];
}

export interface CreateBoardRequest {
  title: string;
}

export interface UpdateBoardRequest {
  title: string;
}

export interface CreateColumnRequest {
  title: string;
  position: number;
}

export interface UpdateColumnRequest {
  title: string;
  position: number;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  position: number;
}

export interface UpdateTaskRequest {
  title: string;
  description?: string;
  position: number;
}

export interface MoveTaskRequest {
  columnId: number;
  position: number;
}

export interface BoardMemberDto {
  id: number;
  userId: number;
  username: string;
  email: string;
  joinedAt: string;
}

export interface BoardMembersResponse {
  boardId: number;
  boardTitle: string;
  ownerId: number;
  members: BoardMemberDto[];
}

export interface InviteUserRequest {
  email: string;
}

function getAuthHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function registerUser(data: RegisterData): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  return handleResponse<AuthResponse>(response);
}

// Board API
export async function getBoards(token: string): Promise<BoardDto[]> {
  const response = await fetch(`${API_URL}/api/board`, {
    headers: getAuthHeaders(token),
  });

  return handleResponse<BoardDto[]>(response);
}

export async function getBoard(token: string, id: number): Promise<BoardDto> {
  const response = await fetch(`${API_URL}/api/board/${id}`, {
    headers: getAuthHeaders(token),
  });

  return handleResponse<BoardDto>(response);
}

export async function createBoard(
  token: string,
  data: CreateBoardRequest
): Promise<BoardDto> {
  const response = await fetch(`${API_URL}/api/board`, {
    method: "POST",
    headers: getAuthHeaders(token),
    body: JSON.stringify(data),
  });

  return handleResponse<BoardDto>(response);
}

export async function updateBoard(
  token: string,
  id: number,
  data: UpdateBoardRequest
): Promise<void> {
  const response = await fetch(`${API_URL}/api/board/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(token),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    await handleResponse(response);
  }
}

export async function deleteBoard(token: string, id: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/board/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    await handleResponse(response);
  }
}

// Column API
export async function getColumns(
  token: string,
  boardId: number
): Promise<ColumnDto[]> {
  const response = await fetch(`${API_URL}/api/boards/${boardId}/column`, {
    headers: getAuthHeaders(token),
  });

  return handleResponse<ColumnDto[]>(response);
}

export async function createColumn(
  token: string,
  boardId: number,
  data: CreateColumnRequest
): Promise<ColumnDto> {
  const response = await fetch(`${API_URL}/api/boards/${boardId}/column`, {
    method: "POST",
    headers: getAuthHeaders(token),
    body: JSON.stringify(data),
  });

  return handleResponse<ColumnDto>(response);
}

export async function updateColumn(
  token: string,
  boardId: number,
  id: number,
  data: UpdateColumnRequest
): Promise<void> {
  const response = await fetch(`${API_URL}/api/boards/${boardId}/column/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(token),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    await handleResponse(response);
  }
}

export async function deleteColumn(
  token: string,
  boardId: number,
  id: number
): Promise<void> {
  const response = await fetch(`${API_URL}/api/boards/${boardId}/column/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    await handleResponse(response);
  }
}

// Task API
export async function getTasks(
  token: string,
  columnId: number
): Promise<TaskDto[]> {
  const response = await fetch(`${API_URL}/api/task/column/${columnId}`, {
    headers: getAuthHeaders(token),
  });

  return handleResponse<TaskDto[]>(response);
}

export async function createTask(
  token: string,
  columnId: number,
  data: CreateTaskRequest
): Promise<TaskDto> {
  const response = await fetch(`${API_URL}/api/task/column/${columnId}`, {
    method: "POST",
    headers: getAuthHeaders(token),
    body: JSON.stringify(data),
  });

  return handleResponse<TaskDto>(response);
}

export async function updateTask(
  token: string,
  id: number,
  data: UpdateTaskRequest
): Promise<void> {
  const response = await fetch(`${API_URL}/api/task/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(token),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    await handleResponse(response);
  }
}

export async function moveTask(
  token: string,
  id: number,
  data: MoveTaskRequest
): Promise<void> {
  const response = await fetch(`${API_URL}/api/task/${id}/move`, {
    method: "PATCH",
    headers: getAuthHeaders(token),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    await handleResponse(response);
  }
}

export async function deleteTask(token: string, id: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/task/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    await handleResponse(response);
  }
}

// Board Sharing API
export async function getBoardMembers(
  token: string,
  boardId: number
): Promise<BoardMembersResponse> {
  const response = await fetch(`${API_URL}/api/board/${boardId}/members`, {
    headers: getAuthHeaders(token),
  });

  return handleResponse<BoardMembersResponse>(response);
}

export async function inviteBoardMember(
  token: string,
  boardId: number,
  data: InviteUserRequest
): Promise<void> {
  const response = await fetch(`${API_URL}/api/board/${boardId}/invite`, {
    method: "POST",
    headers: getAuthHeaders(token),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    await handleResponse(response);
  }
}

export async function removeBoardMember(
  token: string,
  boardId: number,
  memberId: number
): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/board/${boardId}/members/${memberId}`,
    {
      method: "DELETE",
      headers: getAuthHeaders(token),
    }
  );

  if (!response.ok) {
    await handleResponse(response);
  }
}
