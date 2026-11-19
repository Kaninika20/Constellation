import * as clubService from '../services/clubCourse.service.js';

export const getClubs = async (req, res, next) => {
  try {
    const currentStudentId = req.user ? req.user.studentId : null;
    const clubs = await clubService.getAllClubs(currentStudentId, req.query.search);
    return res.status(200).json({
      data: clubs
    });
  } catch (error) {
    next(error);
  }
};

export const joinClub = async (req, res, next) => {
  try {
    const studentId = req.user.studentId;
    const { clubId } = req.params;
    const { role = 'Member' } = req.body;

    const result = await clubService.joinClub(studentId, clubId, role);
    return res.status(201).json({
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const leaveClub = async (req, res, next) => {
  try {
    const studentId = req.user.studentId;
    const { clubId } = req.params;

    const result = await clubService.leaveClub(studentId, clubId);
    return res.status(200).json({
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getClubMembers = async (req, res, next) => {
  try {
    const { clubId } = req.params;
    const members = await clubService.getClubMembers(clubId);
    return res.status(200).json({
      data: members
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/clubs  (admin only) — create a shared Club record.
 */
export const createClub = async (req, res, next) => {
  try {
    const { clubId, name, description, category } = req.body;
    const club = await clubService.createClub({ clubId, name, description, category });
    return res.status(201).json({
      message: 'Club created successfully.',
      data: club
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/clubs/:clubId — club details (club + members).
 */
export const getClubDetail = async (req, res, next) => {
  try {
    const { clubId } = req.params;
    const detail = await clubService.getClubDetail(clubId);
    return res.status(200).json({
      data: detail
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/clubs/joined — clubs the authenticated student has joined.
 */
export const getMyClubs = async (req, res, next) => {
  try {
    const clubs = await clubService.getMyClubs(req.user.studentId);
    return res.status(200).json({
      data: clubs
    });
  } catch (error) {
    next(error);
  }
};

