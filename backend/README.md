# Backend

## Purpose

The backend is the NestJS API service for Cestra, responsible for exposing HTTP endpoints, managing database access via TypeORM and PostgreSQL, and orchestrating off-chain operations such as payment processing and JWT-based authentication. It acts as the L4 Application Services layer, bridging the web frontend and the on-chain Sui Move contracts.

---

## Tech Stack

| Technology | Version |
|------------|---------|
| NestJS     | ^10.x   |
| TypeORM    | ^0.3.x  |
| PostgreSQL | ≥ 15    |

---

## Environment Setup

Copy `.env.example` to `.env` and fill in the values before starting the server.

| Variable      | Description                                      | Default  |
|---------------|--------------------------------------------------|----------|
| `DB_HOST`     | PostgreSQL host (e.g. `localhost` or Docker service name) | —  |
| `DB_PORT`     | PostgreSQL port                                  | `5432`   |
| `DB_NAME`     | Database name to connect to                      | —        |
| `DB_USER`     | PostgreSQL username                              | —        |
| `DB_PASSWORD` | PostgreSQL password                              | —        |
| `JWT_SECRET`  | Secret used to sign and verify JWT tokens        | —        |
| `APP_PORT`    | Port the NestJS HTTP server listens on           | `3000`   |

> **Note:** The application will throw a descriptive error and exit if any of `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, or `DB_PASSWORD` are missing or empty at startup.

---

## Available Scripts

```bash
# Start the development server with file watching
npm run start:dev

# Compile TypeScript to JavaScript (output in dist/)
npm run build

# Run the Jest unit test suite
npm run test
```

---

## Folder Structure

```
src/
├── main.ts                        # Application entry point — bootstraps NestJS and starts HTTP server
├── app.module.ts                  # Root module — imports ConfigModule and DatabaseModule
├── app.controller.ts              # Root controller — handles GET /
├── app.service.ts                 # Root service — returns hello-world response
└── database/
    └── database.module.ts         # DatabaseModule — wires TypeORM to PostgreSQL via ConfigService
```

---

## Quick Start

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and fill in all required values (database credentials, JWT secret, etc.).

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the development server:
   ```bash
   npm run start:dev
   ```

The server will be available at `http://localhost:<APP_PORT>` (default: `http://localhost:3000`).
