import * as relService from '../services/relationship.service.js';

/**
 * Relationship controller - Following system & relationship status.
 * Friend request / friendship handlers live in friendship.controller.js (Phase 3A).
 */

export const followStudent = async (req, res, next) => {
  try {
    const followerId = req.user.studentId;
    const { targetId } = req.params;

    const result = await relService.followStudent(followerId, targetId);
    return res.status(201).json({
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const unfollowStudent = async (req, res, next) => {
  try {
    const followerId = req.user.studentId;
    const { targetId } = req.params;

    const result = await relService.unfollowStudent(followerId, targetId);
    return res.status(200).json({
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getFollowers = async (req, res, next) => {
  try {
    const studentId = req.params.studentId || req.user.studentId;
    const followers = await relService.getFollowers(studentId);
    return res.status(200).json({
      data: followers
    });
  } catch (error) {
    next(error);
  }
};

export const getFollowing = async (req, res, next) => {
  try {
    const studentId = req.params.studentId || req.user.studentId;
    const following = await relService.getFollowing(studentId);
    return res.status(200).json({
      data: following
    });
  } catch (error) {
    next(error);
  }
};

export const getFollowCounts = async (req, res, next) => {
  try {
    const studentId = req.params.studentId || req.user.studentId;
    const counts = await relService.getFollowCounts(studentId);
    return res.status(200).json({
      data: counts
    });
  } catch (error) {
    next(error);
  }
};

export const getRelationshipStatus = async (req, res, next) => {
  try {
    const currentId = req.user.studentId;
    const { targetId } = req.params;

    const status = await relService.getRelationshipStatus(currentId, targetId);
    return res.status(200).json({
      data: status
    });
  } catch (error) {
    next(error);
  }
};
