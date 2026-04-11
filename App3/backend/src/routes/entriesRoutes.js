import { Router } from 'express';

import { createEntry, deleteEntry, getEntries, updateEntry } from '../controllers/entriesController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.route('/').get(protect, getEntries).post(protect, createEntry);
router.route('/:id').put(protect, updateEntry).delete(protect, deleteEntry);

export default router;
