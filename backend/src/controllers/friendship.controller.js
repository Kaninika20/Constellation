import * as friendshipService from '../services/friendship.service.js';

/**
 * POST /api/relationships/friend-requests
 * Body: { targetStudentId }
 * Sends a friend request from the authenticated student to targetStudentId.
 */
export const sendFriendRequest = async (req, res, next) => {
  try {
    const senderId = req.user.studentId;
    const { targetStudentId } = req.body;

    if (!targetStudentId) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'targetStudentId is required to send a friend request.'
      });
    }

    const result = await friendshipService.sendFriendRequest(senderId, targetStudentId);
    return res.status(201).json({
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/relationships/friend-requests/:senderId/accept
 * The authenticated student (receiver) accepts a request from :senderId.
 */
export const acceptFriendRequest = async (req, res, next) => {
  try {
    const receiverId = req.user.studentId;
    const { senderId } = req.params;

    const result = await friendshipService.acceptFriendRequest(receiverId, senderId);
    return res.status(200).json({
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/relationships/friend-requests/:senderId/reject
 * The authenticated student (receiver) rejects a request from :senderId.
 */
export const rejectFriendRequest = async (req, res, next) => {
  try {
    const receiverId = req.user.studentId;
    const { senderId } = req.params;

    const result = await friendshipService.rejectFriendRequest(receiverId, senderId);
    return res.status(200).json({
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/relationships/friend-requests/:receiverId
 * The authenticated student (sender) cancels their outgoing request to :receiverId.
 */
export const cancelFriendRequest = async (req, res, next) => {
  try {
    const senderId = req.user.studentId;
    const { receiverId } = req.params;

    const result = await friendshipService.cancelFriendRequest(senderId, receiverId);
    return res.status(200).json({
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/relationships/friend-requests/incoming
 * Lists pending friend requests addressed to the authenticated student.
 */
export const getIncomingRequests = async (req, res, next) => {
  try {
    const studentId = req.user.studentId;
    const requests = await friendshipService.getIncomingFriendRequests(studentId);
    return res.status(200).json({
      data: requests
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/relationships/friend-requests/outgoing
 * Lists pending friend requests sent by the authenticated student.
 */
export const getOutgoingRequests = async (req, res, next) => {
  try {
    const studentId = req.user.studentId;
    const requests = await friendshipService.getOutgoingFriendRequests(studentId);
    return res.status(200).json({
      data: requests
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/relationships/friends          -> authenticated student's friends
 * GET /api/relationships/friends/:studentId -> a specific student's friends
 */
export const getFriends = async (req, res, next) => {
  try {
    const studentId = req.params.studentId || req.user.studentId;
    const friends = await friendshipService.getFriends(studentId);
    return res.status(200).json({
      data: friends
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/relationships/friends/:friendId
 * Removes an existing friendship between the authenticated student and :friendId.
 */
export const removeFriend = async (req, res, next) => {
  try {
    const studentId = req.user.studentId;
    const { friendId } = req.params;

    const result = await friendshipService.removeFriendship(studentId, friendId);
    return res.status(200).json({
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};
