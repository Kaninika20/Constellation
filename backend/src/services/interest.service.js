import { getSession } from '../config/neo4j.config.js';
import { sanitizeStudent } from './student.service.js';

/**
 * =============================================================================
 *  Interest Management (Phase 3C)
 * =============================================================================
 *  Interests are unique Interest nodes (uniqueness constraint on name), linked
 *  to students via (Student)-[:HAS_INTEREST]->(Interest). This module exposes
 *  browse/search, students-sharing, and popularity queries.
 * =============================================================================
 */

/**
 * Searches available Interest nodes, optionally filtered by name.
 * Returns each interest with its category and the number of students sharing it.
 */
export const searchInterests = async (search = '', limit = 50) => {
  const session = getSession();
  try {
    const searchTerm = search && search.trim() ? search.trim() : '';
    const searchClause = searchTerm ? 'WHERE toLower(i.name) CONTAINS toLower($search)' : '';
    const query = `
      MATCH (i:Interest)
      ${searchClause}
      OPTIONAL MATCH (s:Student)-[:HAS_INTEREST]->(i)
      WITH i, count(DISTINCT s) AS studentCount
      ORDER BY studentCount DESC, i.name ASC
      LIMIT toInteger($limit)
      RETURN i, studentCount
    `;
    const params = { limit: parseInt(limit, 10) || 50 };
    if (searchTerm) params.search = searchTerm;
    const res = await session.run(query, params);
    return res.records.map(rec => ({
      ...rec.get('i').properties,
      studentCount: rec.get('studentCount')
    }));
  } finally {
    await session.close();
  }
};

/**
 * Returns students sharing a given interest, each with their full interest list.
 */
export const getStudentsByInterest = async (name) => {
  const session = getSession();
  try {
    const query = `
      MATCH (s:Student)-[:HAS_INTEREST]->(i:Interest {name: $name})
      OPTIONAL MATCH (s)-[:HAS_INTEREST]->(i2:Interest)
      WITH s, collect(DISTINCT i2.name) AS interests
      ORDER BY s.name ASC
      RETURN s, interests
    `;
    const res = await session.run(query, { name });
    return res.records.map(rec => ({
      student: sanitizeStudent(rec.get('s').properties),
      interests: rec.get('interests') || []
    }));
  } finally {
    await session.close();
  }
};

/**
 * Returns the most popular interests ranked by the number of students sharing them.
 */
export const getPopularInterests = async (limit = 10) => {
  const session = getSession();
  try {
    const query = `
      MATCH (s:Student)-[:HAS_INTEREST]->(i:Interest)
      WITH i, count(DISTINCT s) AS studentCount
      ORDER BY studentCount DESC, i.name ASC
      LIMIT toInteger($limit)
      RETURN i, studentCount
    `;
    const res = await session.run(query, { limit: parseInt(limit, 10) || 10 });
    return res.records.map(rec => ({
      ...rec.get('i').properties,
      studentCount: rec.get('studentCount')
    }));
  } finally {
    await session.close();
  }
};
