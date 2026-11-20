import * as authService from '../services/auth.service.js';

export const register = async (req, res, next) => {
  try {
    const { studentId, name, email, department, yearOfStudy, bio, profileImageUrl, password, interests } = req.body;

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
      message: 'Student successfully registered into Constellation.',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const result = await authService.login(email, password);

    return res.status(200).json({
      message: 'Student authenticated successfully.',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser = async (req, res, next) => {
  try {
    const student = await authService.getStudentByStudentId(req.user.studentId);

    if (!student) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Student profile not found in Neo4j.'
      });
    }

    return res.status(200).json({
      data: student
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res) => {
  return res.status(200).json({
    message: 'Logged out successfully.'
  });
};
