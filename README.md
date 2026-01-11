# TrustiChain Backend (Clean Setup)

This is a clean Node.js + TypeScript backend API project using Express. It includes type augmentation for custom Request properties (userId, user), and is ready for code migration.

## Features
- Express API server
- TypeScript configuration
- Type augmentation for Express Request
- Scripts for build, dev, lint, and test
- Organized src/ structure: controllers, middleware, routes, services, types, utils

## Getting Started
1. Install dependencies:
   ```sh
   npm install
   ```
2. Run in development mode:
   ```sh
   npm run dev
   ```
3. Build the project:
   ```sh
   npm run build
   ```
4. Run tests:
   ```sh
   npm test
   ```

## Health Check
- GET `/health` returns `{ status: 'ok' }`

## Type Augmentation
Custom properties (userId, user) are available on Express Request via src/types/global.d.ts.

---
Replace placeholder code and migrate your business logic as needed.
