/**
 * API Server Entry Point
 *
 * Starts the Express API server for the Knowledge Base Web UI.
 */

import 'dotenv/config';

import { startServer } from './server';

const PORT = parseInt(process.env.API_PORT || '3001', 10);

startServer(PORT);
