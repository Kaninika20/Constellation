import { getSession } from '../config/neo4j.config.js';
import { sanitizeStudent } from './student.service.js';

/**
 * =============================================================================
 *  Relationship Management - Following System & Relationship Status
 * =============================================================================
 *  Friend request & friendship management lives in friendship.service.js
 *  (Phase 3A model: PENDING_FRIEND_REQUEST + FRIENDS_WITH, transactional accept).
 *  This module retains the following (FOLLOWS) subsystem and the combined
 *  relationship-status resolver used by the directory/profile UI.
 * =============================================================================
 */

/**
 * -----------------------------------------------------------------------------
 * FOLLOWING SYSTEM
 * -----------------------------------------------------------------------------
 */

/**
 * Follows another student.
 * Validates self-following and duplicate following.
 */
export const followStudent = async (followerId, targetId) => {
  if (followerId === targetId) {
    const error = new Error('You cannot follow yourself.');
    error.statusCode = 400;
    throw error;
  }

  const session = getSession();
  try {
    // 1. Verify target exists
    const checkQuery = `
      MATCH (target:Student {studentId: $targetId})
      RETURN target
    `;
    const checkRes = await session.run(checkQuery, { targetId });
    if (checkRes.records.length === 0) {
      const error = new Error(`Student with ID '${targetId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    // 2. Check duplicate follow
    const checkFollowQuery = `
      MATCH (s1:Student {studentId: $followerId})-[r:FOLLOWS]->(s2:Student {studentId: $targetId})
      RETURN r
    `;
    const followRes = await session.run(checkFollowQuery, { followerId, targetId });
    if (followRes.records.length > 0) {
      const error = new Error('You are already following this student.');
      error.statusCode = 400;
      throw error;
    }

    // 3. Create FOLLOWS relationship
    const createQuery = `
      MATCH (s1:Student {studentId: $followerId})
      MATCH (s2:Student {studentId: $targetId})
      CREATE (s1)-[r:FOLLOWS { createdAt: datetime() }]->(s2)
      RETURN r
    `;
    await session.run(createQuery, { followerId, targetId });

    return {
      message: 'Successfully followed student.',
      followerId,
      targetId
    };
  } finally {
    await session.close();
  }
};

/**
 * Unfollows a student.
 */
export const unfollowStudent = async (followerId, targetId) => {
  const session = getSession();
  try {
    const query = `
      MATCH (s1:Student {studentId: $followerId})-[r:FOLLOWS]->(s2:Student {studentId: $targetId})
      DELETE r
      RETURN count(r) AS deletedCount
    `;
    const res = await session.run(query, { followerId, targetId });
    const count = res.records[0].get('deletedCount');

    if (count === 0) {
      const error = new Error('You are not following this student.');
      error.statusCode = 404;
      throw error;
    }

    return {
      message: 'Successfully unfollowed student.',
      followerId,
      targetId
    };
  } finally {
    await session.close();
  }
};

/**
 * Retrieves followers of a student.
 */
export const getFollowers = async (studentId) => {
  const session = getSession();
  try {
    const query = `
      MATCH (follower:Student)-[r:FOLLOWS]->(target:Student {studentId: $studentId})
      OPTIONAL MATCH (follower)-[:HAS_INTEREST]->(i:Interest)
      WITH follower, r, collect(DISTINCT i.name) AS interests
      ORDER BY follower.name ASC
      RETURN follower, r.createdAt AS createdAt, interests
    `;
    const res = await session.run(query, { studentId });

    return res.records.map(rec => ({
      follower: sanitizeStudent(rec.get('follower').properties),
      createdAt: rec.get('createdAt') ? rec.get('createdAt').toString() : null,
      interests: rec.get('interests')
    }));
  } finally {
    await session.close();
  }
};

/**
 * Retrieves students that this student is following.
 */
export const getFollowing = async (studentId) => {
  const session = getSession();
  try {
    const query = `
      MATCH (s:Student {studentId: $studentId})-[r:FOLLOWS]->(followed:Student)
      OPTIONAL MATCH (followed)-[:HAS_INTEREST]->(i:Interest)
      WITH followed, r, collect(DISTINCT i.name) AS interests
      ORDER BY followed.name ASC
      RETURN followed, r.createdAt AS createdAt, interests
    `;
    const res = await session.run(query, { studentId });

    return res.records.map(rec => ({
      followed: sanitizeStudent(rec.get('followed').properties),
      createdAt: rec.get('createdAt') ? rec.get('createdAt').toString() : null,
      interests: rec.get('interests')
    }));
  } finally {
    await session.close();
  }
};

/**
 * Returns follower and following counts for a student.
 * Followers = students who FOLLOWS this student; Following = students this student FOLLOWS.
 */
export const getFollowCounts = async (studentId) => {
  const session = getSession();
  try {
    const query = `
      MATCH (s:Student {studentId: $studentId})
      OPTIONAL MATCH (s)-[:FOLLOWS]->(fo:Student)
      OPTIONAL MATCH (fr:Student)-[:FOLLOWS]->(s)
      RETURN count(DISTINCT fo) AS followingCount, count(DISTINCT fr) AS followersCount
    `;
    const res = await session.run(query, { studentId });
    if (res.records.length === 0) {
      return { followersCount: 0, followingCount: 0 };
    }
    const rec = res.records[0];
    return {
      followersCount: rec.get('followersCount') || 0,
      followingCount: rec.get('followingCount') || 0
    };
  } finally {
    await session.close();
  }
};

/**
 * Resolves full relationship status between current logged-in student and a target student.
 */
export const getRelationshipStatus = async (currentId, targetId) => {
  if (currentId === targetId) {
    return {
      isSelf: true,
      isFriend: false,
      isFollowing: false,
      isFollowedBy: false,
      hasPendingIncoming: false,
      hasPendingOutgoing: false
    };
  }

  const session = getSession();
  try {
    const query = `
      MATCH (c:Student {studentId: $currentId})
      MATCH (t:Student {studentId: $targetId})
      
      OPTIONAL MATCH (c)-[rf:FRIENDS_WITH]-(t)
      OPTIONAL MATCH (c)-[ro:PENDING_FRIEND_REQUEST]->(t)
      OPTIONAL MATCH (t)-[ri:PENDING_FRIEND_REQUEST]->(c)
      OPTIONAL MATCH (c)-[rfol:FOLLOWS]->(t)
      OPTIONAL MATCH (t)-[rfby:FOLLOWS]->(c)

      RETURN
        rf IS NOT NULL AS isFriend,
        ro IS NOT NULL AS hasPendingOutgoing,
        ri IS NOT NULL AS hasPendingIncoming,
        rfol IS NOT NULL AS isFollowing,
        rfby IS NOT NULL AS isFollowedBy
    `;

    const res = await session.run(query, { currentId, targetId });
    if (res.records.length === 0) {
      return {
        isSelf: false,
        isFriend: false,
        isFollowing: false,
        isFollowedBy: false,
        hasPendingIncoming: false,
        hasPendingOutgoing: false
      };
    }

    const rec = res.records[0];
    return {
      isSelf: false,
      isFriend: rec.get('isFriend'),
      hasPendingOutgoing: rec.get('hasPendingOutgoing'),
      hasPendingIncoming: rec.get('hasPendingIncoming'),
      isFollowing: rec.get('isFollowing'),
      isFollowedBy: rec.get('isFollowedBy')
    };
  } finally {
    await session.close();
  }
};
