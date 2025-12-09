# Kanban Board Application

**Author:** Lukáš Hrehor
**Email:** lukas.hrehor@gmail.com
**School:** Střední Průmyslová Skola Elektrotechnická Ječná
**Date:** 24.11.2025

---

## Overview

Real-time collaborative Kanban board system with WebSocket support for live updates. Built with Next.js, ASP.NET Core 8.0, and MySQL.

### Key Features

- JWT-based authentication
- Real-time collaborative editing via WebSocket
- Drag-and-drop task management
- Board sharing with multi-user access
- Resource locking to prevent edit conflicts
- Automatic reconnection

### Architecture

- **Frontend**: Next.js + React (port 3000)
- **Backend API**: ASP.NET Core 8.0 (port 5283)
- **WebSocket Server**: Fleck (port 8181)
- **Database**: MySQL 8.0 (port 3306)

---

## Installation

### Prerequisites

- Node.js 20.x+
- .NET 8.0 SDK (or Docker)
- MySQL 8.0 or Docker

### Setup

**1. Clone repository**
```bash
git clone <repository-url>
cd kanban
```

**2. Configure environment**

Copy the example environment files and customize if needed:

```bash
# Linux/Mac
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Windows (PowerShell)
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

**Note:** The defaults work for local development. Only edit if you need custom ports or database credentials.

**3. Start MySQL**
```bash
# Using Docker (recommended)
docker-compose up -d

# Verify running
docker ps | grep kanban-mysql
```

**4. Backend setup**

**Option A: Using .NET SDK (native)**
```bash
cd backend

# Restore packages
dotnet restore

# Apply migrations
dotnet ef database update

# Run backend
dotnet run
```

**Option B: Using Docker wrapper (Linux/Mac)**
```bash
cd backend

# Restore packages
../dotnet-docker/dotnet restore

# Apply migrations
../dotnet-docker/dotnet ef database update

# Run backend
../dotnet-docker/dotnet run
```

**Option C: Using Docker wrapper (Windows)**
```powershell
cd backend

# Restore packages
..\dotnet-docker\dotnet.bat restore

# Apply migrations
..\dotnet-docker\dotnet.bat ef database update

# Run backend
..\dotnet-docker\dotnet.bat run
```

**5. Frontend setup**
```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Application will be available at:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5283`
- WebSocket: `ws://localhost:8181`
- Swagger UI: `http://localhost:5283/swagger`

---

## Configuration

The application uses three separate `.env` files for better organization and cross-platform compatibility:

### Root `.env` (Docker Compose only)
```bash
# MySQL Configuration for Docker Compose
MYSQL_ROOT_PASSWORD=rootpass123
MYSQL_DATABASE=kanban_db
MYSQL_USER=kanbanuser
MYSQL_PASSWORD=kanbanpass123
MYSQL_PORT=3306
```

### `backend/.env` (Backend configuration)
```bash
# Database Configuration
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=kanban_db
MYSQL_USER=kanbanuser
MYSQL_PASSWORD=kanbanpass123

# Server Configuration
BACKEND_HTTP_PORT=5283
WS_PORT=8181

# JWT Configuration
JWT_SECRET=ace8c61b8b7396a4bfc85bfad78c0585
JWT_ISSUER=KanbanAPI
JWT_AUDIENCE=KanbanClient

# CORS Configuration
FRONTEND_PORT=3000
```

### `frontend/.env` (Frontend configuration)
```bash
NEXT_PUBLIC_API_URL=http://localhost:5283
NEXT_PUBLIC_WS_URL=ws://localhost:8181
```

**Security Note:** Change `JWT_SECRET` and `MYSQL_ROOT_PASSWORD` for production use.

---

## Quick Start

1. Open `http://localhost:3000`
2. Register a new account
3. Default board created with columns: To Do, In Progress, Done
4. Create tasks and drag between columns
5. Open second browser window to test real-time sync

---

## Testing

### Backend Unit Tests

The backend includes comprehensive unit tests for controllers and services using xUnit, Moq, and EF Core InMemory.

**Test Coverage:**
- `AuthControllerTests` - User registration and login
- `BoardControllerTests` - Board CRUD and access control
- `TaskMovementTests` - Task movement and positioning
- `LockManagerTests` - Resource locking mechanism
- `BoardAccessServiceTests` - Board access validation
- `JwtServiceTests` - JWT token generation and validation

**Run tests:**
```bash
cd backend.Tests
dotnet test
```

**Run with detailed output:**
```bash
dotnet test --verbosity detailed
```

---

## Database

Tables: Users, Boards, Columns, Tasks, BoardMembers

---

## API Documentation

Full API documentation available at: `http://localhost:5283/swagger`

---

## Technology Stack

**Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS, dnd-kit
**Backend:** .NET 8.0, ASP.NET Core, Entity Framework Core, Fleck WebSocket
**Database:** MySQL 8.0, Pomelo EF Core provider
**Auth:** JWT Bearer, BCrypt password hashing

---

## Logging and Monitoring

The backend uses **Serilog** for structured, color-coded console logging with request tracing. Logs are also written to the `logs/` directory. The application can be monitored by inspecting these logs for HTTP requests, WebSocket connections, and authentication events.

![alt text](image-1.png)

---

## Known Bugs

- Unexpected behaviour when moving task between 2 columns multiple times

---

**Project Type:** School Project
**Status:** In Development
