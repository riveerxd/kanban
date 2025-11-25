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
- .NET 8.0 SDK
- MySQL 8.0 or Docker

### Setup

**1. Clone repository**
```bash
git clone <repository-url>
cd kanban
```

**2. Configure environment**
```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your settings (optional - defaults work for local development)
```

**3. Start MySQL**
```bash
# Using Docker (recommended)
docker-compose up -d

# Verify running
docker ps | grep kanban-mysql
```

**4. Backend setup**
```bash
cd backend

# Apply migrations
dotnet ef database update

# Run backend
dotnet run
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

All services are configured via the root `.env` file:

```bash
# MySQL Configuration
MYSQL_ROOT_PASSWORD=rootpass123
MYSQL_DATABASE=kanban_db
MYSQL_USER=kanbanuser
MYSQL_PASSWORD=kanbanpass123
MYSQL_PORT=3306

# Backend Configuration
BACKEND_HTTP_PORT=5283
BACKEND_HTTPS_PORT=7283
BACKEND_HOST=localhost
WS_PORT=8181
WS_HOST=0.0.0.0

# Frontend Configuration
FRONTEND_PORT=3000
```

**Note:** JWT settings are configured in `backend/appsettings.json`. Change the `JwtSettings:Secret` for production use.

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

**Project Type:** School Project
**Status:** In Development
