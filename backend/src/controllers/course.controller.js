import * as courseService from '../services/clubCourse.service.js';

export const getCourses = async (req, res, next) => {
  try {
    const currentStudentId = req.user ? req.user.studentId : null;
    const courses = await courseService.getAllCourses(currentStudentId, req.query.search);
    return res.status(200).json({
      data: courses
    });
  } catch (error) {
    next(error);
  }
};

export const enrollCourse = async (req, res, next) => {
  try {
    const studentId = req.user.studentId;
    const { courseCode } = req.params;
    const { semester = 'Fall 2026' } = req.body;

    const result = await courseService.enrollCourse(studentId, courseCode, semester);
    return res.status(201).json({
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const dropCourse = async (req, res, next) => {
  try {
    const studentId = req.user.studentId;
    const { courseCode } = req.params;

    const result = await courseService.dropCourse(studentId, courseCode);
    return res.status(200).json({
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getCourseStudents = async (req, res, next) => {
  try {
    const { courseCode } = req.params;
    const students = await courseService.getCourseStudents(courseCode);
    return res.status(200).json({
      data: students
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/courses  (admin only) — create a shared Course record.
 */
export const createCourse = async (req, res, next) => {
  try {
    const { courseCode, courseName, department, credits } = req.body;
    const course = await courseService.createCourse({ courseCode, courseName, department, credits });
    return res.status(201).json({
      message: 'Course created successfully.',
      data: course
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/courses/:courseCode — course details (course + enrolled students).
 */
export const getCourseDetail = async (req, res, next) => {
  try {
    const { courseCode } = req.params;
    const detail = await courseService.getCourseDetail(courseCode);
    return res.status(200).json({
      data: detail
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/courses/enrolled — courses the authenticated student is enrolled in.
 */
export const getMyCourses = async (req, res, next) => {
  try {
    const courses = await courseService.getMyCourses(req.user.studentId);
    return res.status(200).json({
      data: courses
    });
  } catch (error) {
    next(error);
  }
};

