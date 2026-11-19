import { Router } from 'express';
import { searchInterests, getPopularInterests, getStudentsByInterest } from '../controllers/interest.controller.js';

const router = Router();

// Browse / search available interests (optionally ?search=&limit=)
router.get('/', searchInterests);

// Popular interests — must be registered before /:name
router.get('/popular', getPopularInterests);

// Students sharing a specific interest
router.get('/:name/students', getStudentsByInterest);

export default router;
