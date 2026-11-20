import * as studentService from '../services/student.service.js';
import * as authService from '../services/auth.service.js';

/**
 * GET /api/students
 * Supports search, department filter, yearOfStudy filter, pagination.
 */
export const getStudents = async (req, res, next) => {
  try {
    const { limit = 20, skip = 0, department, yearOfStudy, search } = req.query;
    const result = await studentService.getAllStudents({ limit, skip, department, yearOfStudy, search });
    return res.status(200).json({
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/students/me
 * Retrieves authenticated student's full profile & graph connections.
 */
export const getMyProfile = async (req, res, next) => {
  try {
    const studentId = req.user.studentId;
    const graphData = await studentService.getStudentDetailGraph(studentId);

    if (!graphData) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Your student profile was not found in the graph.'
      });
    }

    return res.status(200).json({
      data: graphData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/students/:id
 * Retrieves another student's profile & graph connections.
 */
export const getStudentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const graphData = await studentService.getStudentDetailGraph(id);

    if (!graphData) {
      return res.status(404).json({
        error: 'Not found',
        message: `Student with ID '${id}' was not found in the graph.`
      });
    }

    return res.status(200).json({
      data: graphData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/students/:id
 * Updates student profile details.
 * Security enforcement: Users can only update their own profile!
 */
export const updateStudentProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const authenticatedStudentId = req.user.studentId;

    // Strict Authorization Check: User cannot update another student's profile
    if (authenticatedStudentId !== id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Unauthorized: You can only edit your own student profile.'
      });
    }

    const { name, department, yearOfStudy, bio, profileImageUrl, interests } = req.body;

    const updatedProfile = await studentService.updateStudentProfile(id, {
      name,
      department,
      yearOfStudy,
      bio,
      profileImageUrl,
      interests
    });

    return res.status(200).json({
      message: 'Student profile updated successfully in Neo4j.',
      data: updatedProfile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/students
 * Directly creates a student profile (protected or administrative).
 */
export const createStudent = async (req, res, next) => {
  try {
    const { studentId, name, email, department, yearOfStudy, bio, profileImageUrl, password = 'DefaultPassword123!', interests } = req.body;

    const result = await authService.register({
      studentId,
      name,
      email,
      department,
      yearOfStudy,
      bio,
      profileImageUrl,
      password,
      interests
    });

    return res.status(201).json({
      message: 'Student profile created successfully.',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/students/network/overview
 * Network preview for Cytoscape.js.
 */
export const getNetworkOverview = async (req, res, next) => {
  try {
    const { limit = 100 } = req.query;
    const network = await studentService.getNetworkGraph({
      limit,
      includeRiskDetails: false
    });
    return res.status(200).json({
      data: network
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminNetworkOverview = async (req, res, next) => {
  try {
    const { limit = 100 } = req.query;
    const network = await studentService.getNetworkGraph({ limit, includeRiskDetails: true });
    return res.status(200).json({ data: network });
  } catch (error) {
    next(error);
  }
};
