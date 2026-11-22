import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getSession } from '../config/neo4j.config.js';

const JWT_SECRET = process.env.JWT_SECRET || 'campusgraph_super_secret_jwt_key_2026_academic_project';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Normalizes a Neo4j Student node record into a standard safe JS object.
 * Strictly removes passwordHash to prevent exposing credential data.
 */
export const formatStudentNode = (nodeProperties) => {
  if (!nodeProperties) return null;
  const { passwordHash, ...safeStudent } = nodeProperties;
  return safeStudent;
};

/**
 * Generates a clean institutional student ID if none provided.
 */
const generateStudentId = () => {
  return `STU${Math.floor(100000 + Math.random() * 900000)}`;
};

/**
 * Registers a new student in the Neo4j graph.
 */
export const register = async ({
  studentId,
  name,
  email,
  department,
  yearOfStudy,
  bio = '',
  profileImageUrl = '',
  password,
  interests = []
}) => {
  const session = getSession();
  try {
    const finalStudentId = studentId && studentId.trim() !== '' ? studentId.trim() : generateStudentId();
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check if studentId or email already exists
    const checkQuery = `
      MATCH (s:Student)
      WHERE s.studentId = $finalStudentId OR s.email = $normalizedEmail
      RETURN s.studentId AS existingId, s.email AS existingEmail
    `;
    const checkResult = await session.run(checkQuery, { finalStudentId, normalizedEmail });

    if (checkResult.records.length > 0) {
      const match = checkResult.records[0];
      if (match.get('existingEmail') === normalizedEmail) {
        const error = new Error(`Email address '${normalizedEmail}' is already registered.`);
        error.statusCode = 409;
        throw error;
      }
      if (match.get('existingId') === finalStudentId) {
        const error = new Error(`Student ID '${finalStudentId}' is already registered.`);
        error.statusCode = 409;
        throw error;
      }
    }

    // 2. Hash password with bcrypt
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Default avatar if none provided
    const avatar = profileImageUrl && profileImageUrl.trim() !== ''
      ? profileImageUrl.trim()
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name.trim())}`;

    // 3. Create Student node & relate interests via Cypher
    const createQuery = `
      CREATE (s:Student {
        studentId: $finalStudentId,
        name: $name,
        email: $normalizedEmail,
        department: $department,
        yearOfStudy: toInteger($yearOfStudy),
        bio: $bio,
        profileImageUrl: $profileImageUrl,
        passwordHash: $passwordHash,
        role: 'student',
        status: 'active',
        fraudRiskScore: 0.0,
        createdAt: datetime(),
        updatedAt: datetime()
      })
      WITH s
      MERGE (d:Department {name: $department})
      MERGE (s)-[:BELONGS_TO]->(d)
      WITH s
      FOREACH (interestName IN $interests |
        MERGE (i:Interest {name: trim(interestName)})
        ON CREATE SET i.category = 'General'
        MERGE (s)-[:HAS_INTEREST {assignedAt: datetime(), level: 'General'}]->(i)
      )
      RETURN s
    `;

    const createResult = await session.run(createQuery, {
      finalStudentId,
      name: name.trim(),
      normalizedEmail,
      department: department.trim(),
      yearOfStudy: parseInt(yearOfStudy, 10),
      bio: bio ? bio.trim() : '',
      profileImageUrl: avatar,
      passwordHash,
      interests: Array.isArray(interests) ? interests : []
    });

    const studentRecord = createResult.records[0].get('s').properties;
    const safeStudent = formatStudentNode(studentRecord);

    // 4. Generate JWT
    const token = jwt.sign(
      {
        studentId: safeStudent.studentId,
        email: safeStudent.email,
        role: safeStudent.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return {
      student: {
        ...safeStudent,
        interests: Array.isArray(interests) ? interests : []
      },
      token
    };
  } finally {
    await session.close();
  }
};

/**
 * Authenticates a student via email & password.
 */
export const login = async (email, password) => {
  const session = getSession();
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const query = `
      MATCH (s:Student {email: $normalizedEmail})
      OPTIONAL MATCH (s)-[:HAS_INTEREST]->(i:Interest)
      RETURN s, collect(DISTINCT i.name) AS interests
    `;
    const result = await session.run(query, { normalizedEmail });

    if (result.records.length === 0) {
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      throw error;
    }

    const record = result.records[0];
    const studentProps = record.get('s').properties;
    const isMatch = await bcrypt.compare(password, studentProps.passwordHash);

    if (!isMatch) {
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      throw error;
    }

    const safeStudent = formatStudentNode(studentProps);
    const interests = record.get('interests') || [];

    const token = jwt.sign(
      {
        studentId: safeStudent.studentId,
        email: safeStudent.email,
        role: safeStudent.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return {
      student: {
        ...safeStudent,
        interests
      },
      token
    };
  } finally {
    await session.close();
  }
};

/**
 * Gets student profile by studentId.
 */
export const getStudentByStudentId = async (studentId) => {
  const session = getSession();
  try {
    const query = `
      MATCH (s:Student {studentId: $studentId})
      OPTIONAL MATCH (s)-[:HAS_INTEREST]->(i:Interest)
      OPTIONAL MATCH (s)-[:STUDIES]->(c:Course)
      OPTIONAL MATCH (s)-[:MEMBER_OF]->(cl:Club)
      OPTIONAL MATCH (s)-[:PARTICIPATES_IN]->(e:Event)
      OPTIONAL MATCH (s)-[:FRIENDS_WITH]-(f:Student)
      RETURN s,
             collect(DISTINCT i.name) AS interests,
             collect(DISTINCT c.courseName) AS courses,
             collect(DISTINCT cl.name) AS clubs,
             collect(DISTINCT e.title) AS events,
             count(DISTINCT f) AS friendsCount
    `;
    const result = await session.run(query, { studentId });

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    const studentProps = record.get('s').properties;
    const safeStudent = formatStudentNode(studentProps);

    return {
      ...safeStudent,
      interests: (record.get('interests') || []).filter(Boolean),
      courses: (record.get('courses') || []).filter(Boolean),
      clubs: (record.get('clubs') || []).filter(Boolean),
      events: (record.get('events') || []).filter(Boolean),
      friendsCount: record.get('friendsCount') || 0
    };
  } finally {
    await session.close();
  }
};
