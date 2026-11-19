import { Router } from 'express';
import {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  getIncomingRequests,
  getOutgoingRequests,
  getFriends,
  removeFriend
} from '../controllers/friendship.controller.js';
import {
  followStudent,
  unfollowStudent,
  getFollowers,
  getFollowing,
  getFollowCounts,
  getRelationshipStatus
} from '../controllers/relationship.controller.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';

const router = Router();

// All relationship routes require authenticated user
router.use(authenticateJWT);

// Friend Request management
router.post('/friend-requests', sendFriendRequest);
router.get('/friend-requests/incoming', getIncomingRequests);
router.get('/friend-requests/outgoing', getOutgoingRequests);
router.post('/friend-requests/:senderId/accept', acceptFriendRequest);
router.post('/friend-requests/:senderId/reject', rejectFriendRequest);
router.delete('/friend-requests/:receiverId', cancelFriendRequest);

// Friendship management
router.get('/friends', getFriends);
router.get('/friends/:studentId', getFriends);
router.delete('/friends/:friendId', removeFriend);

// Follow management
router.post('/follow/:targetId', followStudent);
router.delete('/follow/:targetId', unfollowStudent);
router.get('/followers', getFollowers);
router.get('/followers/:studentId', getFollowers);
router.get('/following', getFollowing);
router.get('/following/:studentId', getFollowing);

// Follow counts (followers + following in one response)
router.get('/follow-counts', getFollowCounts);
router.get('/follow-counts/:studentId', getFollowCounts);

// Status check between current student and target
router.get('/status/:targetId', getRelationshipStatus);

export default router;

