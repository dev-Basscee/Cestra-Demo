# Web Workspace

## Purpose

The `web/` workspace is the Next.js frontend for the Cestra platform. It serves the consumer web dashboard and the business portal, providing the user interface layer (L5) through which senders initiate cross-border stablecoin payments and businesses manage their accounts.

## Tech Stack

| Technology | Version |
|---|---|
| Next.js | 15.x |
| React | 19.x |
| Tailwind CSS | 3.x |

## Environment Setup

Copy `.env.example` to `.env` and fill in the values before starting the development server.

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Base URL of the backend API (no trailing slash), e.g. `http://localhost:3000` |
| `NEXT_PUBLIC_ENV` | Environment name used for runtime configuration: `development`, `staging`, or `production` |

> Both variables use the `NEXT_PUBLIC_` prefix so Next.js inlines them into the client bundle at build time.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js development server with hot reload at http://localhost:3000 |
| `npm run build` | Compile and optimise the application for production |
| `npm run start` | Start the production server (requires a prior `npm run build`) |
| `npm run lint` | Run ESLint across the project using the Next.js ESLint config |

## Folder Structure

```
web/
├── app/
│   ├── globals.css    ← Tailwind CSS directives (@tailwind base/components/utilities)
│   ├── layout.tsx     ← Root layout: <html>, <body>, and global metadata
│   └── page.tsx       ← Home page — renders "Cestra — Coming Soon"
├── public/            ← Static assets served at the root path
├── .env.example       ← Environment variable template
├── next.config.ts     ← Next.js configuration
├── tailwind.config.ts ← Tailwind CSS content paths and theme
├── postcss.config.mjs ← PostCSS plugins (tailwindcss, autoprefixer)
├── tsconfig.json      ← TypeScript compiler options
└── package.json       ← Dependencies and npm scripts
```

## Quick Start

1. Copy the environment template and fill in your values:
   ```bash
   cp .env.example .env
   # Edit .env and set NEXT_PUBLIC_API_BASE_URL and NEXT_PUBLIC_ENV
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000 in your browser — you should see the "Cestra — Coming Soon" page.
