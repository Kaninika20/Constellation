import { getSession } from '../config/neo4j.config.js';
import { sanitizeStudent } from './student.service.js';
import { syncCourseDepartment } from './department.service.js';

/**
 * -----------------------------------------------------------------------------
 * 1. CLUBS MANAGEMENT (MEMBER_OF)
 * -----------------------------------------------------------------------------
 */

/**
 * Retrieves all clubs with member count and membership state for current student.
 */
export const getAllClubs = async (currentStudentId = null, search = '') => {
  const session = getSession();
  try {
    const searchTerm = search && search.trim() ? search.trim() : '';
    const searchClause = searchTerm
      ? `WHERE toLower(cl.name) CONTAINS toLower($search) OR toLower(cl.category) CONTAINS toLower($search) OR toLower(cl.description) CONTAINS toLower($search)`
      : '';

    const query = `
      MATCH (cl:Club)
      ${searchClause}
      OPTIONAL MATCH (s:Student)-[r:MEMBER_OF]->(cl)
      WITH cl, count(DISTINCT s) AS memberCount
      ${currentStudentId ? `
        OPTIONAL MATCH (me:Student {studentId: $currentStudentId})-[myRel:MEMBER_OF]->(cl)
        WITH cl, memberCount, myRel IS NOT NULL AS isMember, myRel.role AS myRole
      ` : `
        WITH cl, memberCount, false AS isMember, null AS myRole
      `}
      ORDER BY cl.name ASC
      RETURN cl, memberCount, isMember, myRole
    `;

    const params = { currentStudentId };
    if (searchTerm) params.search = searchTerm;
    const res = await session.run(query, params);

    return res.records.map(rec => ({
      ...rec.get('cl').properties,
      memberCount: rec.get('memberCount'),
      isMember: rec.get('isMember'),
      myRole: rec.get('myRole')
    }));
  } finally {
    await session.close();
  }
};

/**
 * Joins a club (creates MEMBER_OF relationship).
 */
export const joinClub = async (studentId, clubId, role = 'Member') => {
  const session = getSession();
  try {
    // 1. Verify club exists
    const checkClubQuery = `MATCH (cl:Club {clubId: $clubId}) RETURN cl`;
    const checkClubRes = await session.run(checkClubQuery, { clubId });
    if (checkClubRes.records.length === 0) {
      const error = new Error(`Club with ID '${clubId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    // 2. Check if already member
    const checkRelQuery = `
      MATCH (s:Student {studentId: $studentId})-[r:MEMBER_OF]->(cl:Club {clubId: $clubId})
      RETURN r
    `;
    const relRes = await session.run(checkRelQuery, { studentId, clubId });
    if (relRes.records.length > 0) {
      const error = new Error('You are already a member of this club.');
      error.statusCode = 400;
      throw error;
    }

    // 3. Create MEMBER_OF relationship
    const joinQuery = `
      MATCH (s:Student {studentId: $studentId})
      MATCH (cl:Club {clubId: $clubId})
      CREATE (s)-[r:MEMBER_OF { role: $role, joinedDate: datetime() }]->(cl)
      RETURN r
    `;
    await session.run(joinQuery, { studentId, clubId, role });

    return {
      message: 'Successfully joined club.',
      studentId,
      clubId,
      role
    };
  } finally {
    await session.close();
  }
};

/**
 * Leaves a club (deletes MEMBER_OF relationship).
 */
export const leaveClub = async (studentId, clubId) => {
  const session = getSession();
  try {
    const query = `
      MATCH (s:Student {studentId: $studentId})-[r:MEMBER_OF]->(cl:Club {clubId: $clubId})
      DELETE r
      RETURN count(r) AS deletedCount
    `;
    const res = await session.run(query, { studentId, clubId });
    const count = res.records[0].get('deletedCount');

    if (count === 0) {
      const error = new Error('You are not a member of this club.');
      error.statusCode = 404;
      throw error;
    }

    return {
      message: 'Successfully left the club.',
      studentId,
      clubId
    };
  } finally {
    await session.close();
  }
};

/**
 * Retrieves members of a specific club.
 */
export const getClubMembers = async (clubId) => {
  const session = getSession();
  try {
    const query = `
      MATCH (s:Student)-[r:MEMBER_OF]->(cl:Club {clubId: $clubId})
      OPTIONAL MATCH (s)-[:HAS_INTEREST]->(i:Interest)
      WITH s, r, collect(DISTINCT i.name) AS interests
      ORDER BY s.name ASC
      RETURN s, r.role AS role, r.joinedDate AS joinedDate, interests
    `;
    const res = await session.run(query, { clubId });

    return res.records.map(rec => ({
      student: sanitizeStudent(rec.get('s').properties),
      role: rec.get('role'),
      joinedDate: rec.get('joinedDate') ? rec.get('joinedDate').toString() : null,
      interests: rec.get('interests')
    }));
  } finally {
    await session.close();
  }
};

/**
 * -----------------------------------------------------------------------------
 * 2. COURSES MANAGEMENT (STUDIES)
 * -----------------------------------------------------------------------------
 */

/**
 * Retrieves all courses with enrollment count and enrollment state for current student.
 */
export const getAllCourses = async (currentStudentId = null, search = '') => {
  const session = getSession();
  try {
    const searchTerm = search && search.trim() ? search.trim() : '';
    const searchClause = searchTerm
      ? `WHERE toLower(c.courseName) CONTAINS toLower($search) OR toLower(c.courseCode) CONTAINS toLower($search) OR toLower(c.department) CONTAINS toLower($search)`
      : '';

    const query = `
      MATCH (c:Course)
      ${searchClause}
      OPTIONAL MATCH (s:Student)-[r:STUDIES]->(c)
      WITH c, count(DISTINCT s) AS studentCount
      ${currentStudentId ? `
        OPTIONAL MATCH (me:Student {studentId: $currentStudentId})-[myRel:STUDIES]->(c)
        WITH c, studentCount, myRel IS NOT NULL AS isEnrolled, myRel.semester AS enrolledSemester
      ` : `
        WITH c, studentCount, false AS isEnrolled, null AS enrolledSemester
      `}
      ORDER BY c.courseCode ASC
      RETURN c, studentCount, isEnrolled, enrolledSemester
    `;

    const params = { currentStudentId };
    if (searchTerm) params.search = searchTerm;
    const res = await session.run(query, params);

    return res.records.map(rec => ({
      ...rec.get('c').properties,
      studentCount: rec.get('studentCount'),
      isEnrolled: rec.get('isEnrolled'),
      enrolledSemester: rec.get('enrolledSemester')
    }));
  } finally {
    await session.close();
  }
};

/**
 * Enrolls student in a course (creates STUDIES relationship).
 */
export const enrollCourse = async (studentId, courseCode, semester = 'Fall 2026') => {
  const session = getSession();
  try {
    // 1. Verify course exists
    const checkCourseQuery = `MATCH (c:Course {courseCode: $courseCode}) RETURN c`;
    const checkCourseRes = await session.run(checkCourseQuery, { courseCode });
    if (checkCourseRes.records.length === 0) {
      const error = new Error(`Course with code '${courseCode}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    // 2. Check if already enrolled
    const checkRelQuery = `
      MATCH (s:Student {studentId: $studentId})-[r:STUDIES]->(c:Course {courseCode: $courseCode})
      RETURN r
    `;
    const relRes = await session.run(checkRelQuery, { studentId, courseCode });
    if (relRes.records.length > 0) {
      const error = new Error('You are already enrolled in this course.');
      error.statusCode = 400;
      throw error;
    }

    // 3. Create STUDIES relationship
    const enrollQuery = `
      MATCH (s:Student {studentId: $studentId})
      MATCH (c:Course {courseCode: $courseCode})
      CREATE (s)-[r:STUDIES { semester: $semester, enrolledAt: datetime() }]->(c)
      RETURN r
    `;
    await session.run(enrollQuery, { studentId, courseCode, semester });

    return {
      message: 'Successfully enrolled in course.',
      studentId,
      courseCode,
      semester
    };
  } finally {
    await session.close();
  }
};

/**
 * Drops a course (deletes STUDIES relationship).
 */
export const dropCourse = async (studentId, courseCode) => {
  const session = getSession();
  try {
    const query = `
      MATCH (s:Student {studentId: $studentId})-[r:STUDIES]->(c:Course {courseCode: $courseCode})
      DELETE r
      RETURN count(r) AS deletedCount
    `;
    const res = await session.run(query, { studentId, courseCode });
    const count = res.records[0].get('deletedCount');

    if (count === 0) {
      const error = new Error('You are not enrolled in this course.');
      error.statusCode = 404;
      throw error;
    }

    return {
      message: 'Successfully dropped course.',
      studentId,
      courseCode
    };
  } finally {
    await session.close();
  }
};

/**
 * Retrieves students enrolled in the same course.
 */
export const getCourseStudents = async (courseCode) => {
  const session = getSession();
  try {
    const query = `
      MATCH (s:Student)-[r:STUDIES]->(c:Course {courseCode: $courseCode})
      OPTIONAL MATCH (s)-[:HAS_INTEREST]->(i:Interest)
      WITH s, r, collect(DISTINCT i.name) AS interests
      ORDER BY s.name ASC
      RETURN s, r.semester AS semester, interests
    `;
    const res = await session.run(query, { courseCode });

    return res.records.map(rec => ({
      student: sanitizeStudent(rec.get('s').properties),
      semester: rec.get('semester'),
      interests: rec.get('interests')
    }));
  } finally {
    await session.close();
  }
};

/**
 * -----------------------------------------------------------------------------
 * 3. SHARED RECORD CREATION (ADMIN) & DETAILS / "MY" VIEWS
 * -----------------------------------------------------------------------------
 */

/**
 * Creates a new shared Course record (admin only).
 * MERGE on courseCode: re-creating an existing course updates it instead of duplicating.
 */
export const createCourse = async ({ courseCode, courseName, department, credits }) => {
  const normalizedCourseCode = typeof courseCode === 'string' ? courseCode.trim() : '';
  const normalizedCourseName = typeof courseName === 'string' ? courseName.trim() : '';
  const normalizedDepartment = typeof department === 'string' ? department.trim() : '';
  const normalizedCredits = credits === undefined || credits === null || credits === ''
    ? 0
    : Number(credits);

  if (!normalizedCourseCode || !normalizedCourseName || !normalizedDepartment) {
    const error = new Error('courseCode, courseName and department are required to create a course.');
    error.statusCode = 400;
    throw error;
  }
  if (!Number.isInteger(normalizedCredits) || normalizedCredits < 0 || normalizedCredits > 30) {
    const error = new Error('credits must be a whole number between 0 and 30.');
    error.statusCode = 400;
    throw error;
  }

  const session = getSession();
  try {
    const query = `
      MERGE (c:Course {courseCode: $courseCode})
      ON CREATE SET c.createdAt = datetime()
      SET c.courseName = $courseName,
          c.department = $department,
          c.credits = toInteger($credits),
          c.updatedAt = datetime()
      RETURN c
    `;
    const res = await session.run(query, {
      courseCode: normalizedCourseCode,
      courseName: normalizedCourseName,
      department: normalizedDepartment,
      credits: normalizedCredits
    });
    await syncCourseDepartment(session, normalizedCourseCode, normalizedDepartment);
    return res.records[0].get('c').properties;
  } finally {
    await session.close();
  }
};

/**
 * Creates a new shared Club record (admin only).
 * MERGE on clubId: re-creating an existing club updates it instead of duplicating.
 */
export const createClub = async ({ clubId, name, description, category }) => {
  const normalizedClubId = typeof clubId === 'string' ? clubId.trim() : '';
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const normalizedCategory = typeof category === 'string' ? category.trim() : '';
  const normalizedDescription = typeof description === 'string' ? description.trim() : '';

  if (!normalizedClubId || !normalizedName || !normalizedCategory) {
    const error = new Error('clubId, name and category are required to create a club.');
    error.statusCode = 400;
    throw error;
  }
  const session = getSession();
  try {
    const query = `
      MERGE (cl:Club {clubId: $clubId})
      ON CREATE SET cl.createdAt = datetime()
      SET cl.name = $name,
          cl.description = $description,
          cl.category = $category,
          cl.updatedAt = datetime()
      RETURN cl
    `;
    const res = await session.run(query, {
      clubId: normalizedClubId,
      name: normalizedName,
      description: normalizedDescription,
      category: normalizedCategory
    });
    return res.records[0].get('cl').properties;
  } finally {
    await session.close();
  }
};

/**
 * Retrieves a single course with its enrolled students (course details).
 */
export const getCourseDetail = async (courseCode) => {
  const session = getSession();
  try {
    const courseRes = await session.run(`MATCH (c:Course {courseCode: $courseCode}) RETURN c`, { courseCode });
    if (courseRes.records.length === 0) {
      const error = new Error(`Course with code '${courseCode}' not found.`);
      error.statusCode = 404;
      throw error;
    }
    const course = courseRes.records[0].get('c').properties;

    const studentsRes = await session.run(`
      MATCH (s:Student)-[r:STUDIES]->(c:Course {courseCode: $courseCode})
      OPTIONAL MATCH (s)-[:HAS_INTEREST]->(i:Interest)
      WITH s, r, collect(DISTINCT i.name) AS interests
      ORDER BY s.name ASC
      RETURN s, r.semester AS semester, interests
    `, { courseCode });
    const students = studentsRes.records.map(rec => ({
      student: sanitizeStudent(rec.get('s').properties),
      semester: rec.get('semester'),
      interests: rec.get('interests') || []
    }));

    return { ...course, studentCount: students.length, students };
  } finally {
    await session.close();
  }
};

/**
 * Retrieves courses the authenticated student is enrolled in ("My Courses").
 */
export const getMyCourses = async (studentId) => {
  const session = getSession();
  try {
    const res = await session.run(`
      MATCH (s:Student {studentId: $studentId})-[r:STUDIES]->(c:Course)
      RETURN c, r.semester AS semester, r.enrolledAt AS enrolledAt
      ORDER BY c.courseCode ASC
    `, { studentId });
    return res.records.map(rec => ({
      ...rec.get('c').properties,
      semester: rec.get('semester'),
      enrolledAt: rec.get('enrolledAt') ? rec.get('enrolledAt').toString() : null,
      isEnrolled: true
    }));
  } finally {
    await session.close();
  }
};

/**
 * Retrieves a single club with its members (club details).
 */
export const getClubDetail = async (clubId) => {
  const session = getSession();
  try {
    const clubRes = await session.run(`MATCH (cl:Club {clubId: $clubId}) RETURN cl`, { clubId });
    if (clubRes.records.length === 0) {
      const error = new Error(`Club with ID '${clubId}' not found.`);
      error.statusCode = 404;
      throw error;
    }
    const club = clubRes.records[0].get('cl').properties;

    const membersRes = await session.run(`
      MATCH (s:Student)-[r:MEMBER_OF]->(cl:Club {clubId: $clubId})
      OPTIONAL MATCH (s)-[:HAS_INTEREST]->(i:Interest)
      WITH s, r, collect(DISTINCT i.name) AS interests
      ORDER BY s.name ASC
      RETURN s, r.role AS role, r.joinedDate AS joinedDate, interests
    `, { clubId });
    const members = membersRes.records.map(rec => ({
      student: sanitizeStudent(rec.get('s').properties),
      role: rec.get('role'),
      joinedDate: rec.get('joinedDate') ? rec.get('joinedDate').toString() : null,
      interests: rec.get('interests') || []
    }));

    return { ...club, memberCount: members.length, members };
  } finally {
    await session.close();
  }
};

/**
 * Retrieves clubs the authenticated student has joined ("My Clubs").
 */
export const getMyClubs = async (studentId) => {
  const session = getSession();
  try {
    const res = await session.run(`
      MATCH (s:Student {studentId: $studentId})-[r:MEMBER_OF]->(cl:Club)
      RETURN cl, r.role AS role, r.joinedDate AS joinedDate
      ORDER BY cl.name ASC
    `, { studentId });
    return res.records.map(rec => ({
      ...rec.get('cl').properties,
      role: rec.get('role'),
      joinedDate: rec.get('joinedDate') ? rec.get('joinedDate').toString() : null,
      isMember: true
    }));
  } finally {
    await session.close();
  }
};

