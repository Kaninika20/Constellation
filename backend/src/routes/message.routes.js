import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { getConversation, reportMessage, sendMessage } from '../controllers/message.controller.js';

const router = Router();
router.use(authenticateJWT);

router.get('/:friendId', getConversation);
router.post('/:friendId', sendMessage);
router.post('/:friendId/:messageId/report', reportMessage);

export default router;
