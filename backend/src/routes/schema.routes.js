import { Router } from 'express';
import { runSchemaInit, getSchemaOverview } from '../controllers/schema.controller.js';

const router = Router();

// Endpoint to run or verify constraints and indexes
router.post('/init', runSchemaInit);

// Endpoint to inspect schema status (node counts, relationship counts, active constraints)
router.get('/status', getSchemaOverview);

export default router;

