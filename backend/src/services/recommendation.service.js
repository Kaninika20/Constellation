/**
 * =============================================================================
 * CampusGraph – Graph-Based Recommendation Engine  (Week 4)
 * =============================================================================
 *
 * All recommendations are derived purely from Neo4j graph relationships.
 * No external AI/ML API is used.
 *
 * SCORING WEIGHTS (configurable via the `weights` parameter):
 *   Common friends   : 5 pts each   – mutual FRIENDS_WITH connections
 *   Shared courses   : 3 pts each   – both STUDIES the same Course
 *   Shared interests : 3 pts each   – both HAS_INTEREST the same Interest
 *   Shared clubs     : 2 pts each   – both MEMBER_OF the same Club
 *   Common events    : 1 pt  each   – both PARTICIPATES_IN the same Event
 *
 * FILTERS applied automatically:
 *   - Exclude the requesting student themselves
 *   - Exclude already-confirmed friends (FRIENDS_WITH)
 *   - Exclude students with a pending PENDING_FRIEND_REQUEST in either direction
 *   - Only return students with totalScore > 0  (at least one common factor)
 * =============================================================================
 */

import { getSession } from '../config/neo4j.config.js';
import { sanitizeStudent } from './student.service.js';

// Default scoring weights
const DEFAULT_WEIGHTS = {
  commonFriends : 5,
  sharedCourses : 3,
  sharedInterests: 3,
  sharedClubs   : 2,
  commonEvents  : 1,
};

/**
 * Returns a list of recommended students for `studentId` with their scores
 * and the breakdown of reasons behind each recommendation.
 *
 * @param {string} studentId   - The ID of the requesting student
 * @param {object} [weights]   - Optional weight overrides
 * @param {number} [limit=20]  - Max number of results
 */
export const getRecommendations = async (studentId, weights = {}, limit = 20) => {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  const session = getSession();

  try {
    /**
     * Strategy:
     *  1. For each candidate (not self, not friend, no pending request):
     *     a. Count common friends  via FRIENDS_WITH paths of length 2
     *     b. Count shared courses  via STUDIES -> Course <- STUDIES
     *     c. Count shared interests via HAS_INTEREST -> Interest <- HAS_INTEREST
     *     d. Count shared clubs    via MEMBER_OF -> Club <- MEMBER_OF
     *     e. Count common events   via PARTICIPATES_IN -> Event <- PARTICIPATES_IN
     *  2. Compute weighted score = (cf*wf) + (sc*wc) + (si*wi) + (scl*wcl) + (ce*we)
     *  3. Return sorted by score DESC, include names of each common item.
     */
    const query = `
      // Start from the current student
      MATCH (me:Student {studentId: $studentId})

      // Candidate: any student who is not me, not already a friend,
      //            and has no pending friend request in either direction
      MATCH (candidate:Student)
      WHERE candidate.studentId <> $studentId
        AND NOT (me)-[:FRIENDS_WITH]-(candidate)
        AND NOT (me)-[:PENDING_FRIEND_REQUEST]->(candidate)
        AND NOT (candidate)-[:PENDING_FRIEND_REQUEST]->(me)

      // ── 1. Common friends (friends of my friends) ──────────────────────────
      OPTIONAL MATCH (me)-[:FRIENDS_WITH]-(mutual:Student)-[:FRIENDS_WITH]-(candidate)
      WHERE mutual.studentId <> $studentId
        AND mutual.studentId <> candidate.studentId
      WITH me, candidate, collect(DISTINCT mutual.name) AS mutualFriendNames

      // ── 2. Shared courses ──────────────────────────────────────────────────
      OPTIONAL MATCH (me)-[:STUDIES]->(c:Course)<-[:STUDIES]-(candidate)
      WITH me, candidate, mutualFriendNames, collect(DISTINCT c.courseName) AS sharedCourseNames

      // ── 3. Shared interests ────────────────────────────────────────────────
      OPTIONAL MATCH (me)-[:HAS_INTEREST]->(i:Interest)<-[:HAS_INTEREST]-(candidate)
      WITH me, candidate, mutualFriendNames, sharedCourseNames,
           collect(DISTINCT i.name) AS sharedInterestNames

      // ── 4. Shared clubs ────────────────────────────────────────────────────
      OPTIONAL MATCH (me)-[:MEMBER_OF]->(cl:Club)<-[:MEMBER_OF]-(candidate)
      WITH me, candidate, mutualFriendNames, sharedCourseNames, sharedInterestNames,
           collect(DISTINCT cl.name) AS sharedClubNames

      // ── 5. Common events ───────────────────────────────────────────────────
      OPTIONAL MATCH (me)-[:PARTICIPATES_IN]->(e:Event)<-[:PARTICIPATES_IN]-(candidate)
      WITH candidate, mutualFriendNames, sharedCourseNames,
           sharedInterestNames, sharedClubNames, collect(DISTINCT e.title) AS sharedEventNames

      // ── Score calculation ──────────────────────────────────────────────────
      WITH candidate,
           mutualFriendNames, sharedCourseNames, sharedInterestNames,
           sharedClubNames, sharedEventNames,
           size(mutualFriendNames)  AS cf,
           size(sharedCourseNames)  AS sc,
           size(sharedInterestNames) AS si,
           size(sharedClubNames)    AS scl,
           size(sharedEventNames)   AS ce

      WITH candidate,
           mutualFriendNames, sharedCourseNames, sharedInterestNames,
           sharedClubNames, sharedEventNames, cf, sc, si, scl, ce,
           (cf * $wf + sc * $wc + si * $wi + scl * $wcl + ce * $we) AS totalScore

      // ── Filter: must have at least some affinity ──────────────────────────
      WHERE totalScore > 0

      // ── Collect interests for the candidate card ──────────────────────────
      OPTIONAL MATCH (candidate)-[:HAS_INTEREST]->(anyInterest:Interest)
      WITH candidate, mutualFriendNames, sharedCourseNames, sharedInterestNames,
           sharedClubNames, sharedEventNames, cf, sc, si, scl, ce, totalScore,
           collect(DISTINCT anyInterest.name) AS candidateInterests

      RETURN candidate,
             candidateInterests,
             mutualFriendNames,
             sharedCourseNames,
             sharedInterestNames,
             sharedClubNames,
             sharedEventNames,
             cf, sc, si, scl, ce,
             totalScore
      ORDER BY totalScore DESC
      LIMIT toInteger($limit)
    `;

    const res = await session.run(query, {
      studentId,
      wf  : w.commonFriends,
      wc  : w.sharedCourses,
      wi  : w.sharedInterests,
      wcl : w.sharedClubs,
      we  : w.commonEvents,
      limit: parseInt(limit, 10),
    });

    return res.records.map(rec => {
      const cf  = safeNum(rec.get('cf'));
      const sc  = safeNum(rec.get('sc'));
      const si  = safeNum(rec.get('si'));
      const scl = safeNum(rec.get('scl'));
      const ce  = safeNum(rec.get('ce'));

      return {
        student: sanitizeStudent(rec.get('candidate').properties),
        interests: rec.get('candidateInterests') || [],
        score: {
          total: safeNum(rec.get('totalScore')),
          breakdown: {
            commonFriends   : cf,
            sharedCourses   : sc,
            sharedInterests : si,
            sharedClubs     : scl,
            commonEvents    : ce,
          },
          points: {
            fromFriends   : cf  * w.commonFriends,
            fromCourses   : sc  * w.sharedCourses,
            fromInterests : si  * w.sharedInterests,
            fromClubs     : scl * w.sharedClubs,
            fromEvents    : ce  * w.commonEvents,
          },
        },
        reasons: {
          mutualFriends  : rec.get('mutualFriendNames')  || [],
          sharedCourses  : rec.get('sharedCourseNames')  || [],
          sharedInterests: rec.get('sharedInterestNames') || [],
          sharedClubs    : rec.get('sharedClubNames')    || [],
          commonEvents   : rec.get('sharedEventNames')   || [],
        },
      };
    });
  } finally {
    await session.close();
  }
};

/**
 * Returns all common connections between two students across five dimensions:
 *   - mutual friends, shared courses, shared clubs, shared interests, common events.
 *
 * @param {string} studentIdA
 * @param {string} studentIdB
 */
export const getMutualConnections = async (studentIdA, studentIdB) => {
  if (studentIdA === studentIdB) {
    return {
      mutualFriends: [], sharedCourses: [], sharedClubs: [], sharedInterests: [], commonEvents: [],
      counts: { mutualFriends: 0, sharedCourses: 0, sharedClubs: 0, sharedInterests: 0, commonEvents: 0 },
      message: 'Same student'
    };
  }

  const session = getSession();
  try {
    const query = `
      MATCH (a:Student {studentId: $studentIdA}),
            (b:Student {studentId: $studentIdB})

      // Mutual friends (length-2 FRIENDS_WITH path through a third student)
      OPTIONAL MATCH (a)-[:FRIENDS_WITH]-(mutual:Student)-[:FRIENDS_WITH]-(b)
      WHERE mutual.studentId <> $studentIdA AND mutual.studentId <> $studentIdB
      WITH a, b, collect(DISTINCT mutual) AS mutuals

      // Shared courses
      OPTIONAL MATCH (a)-[:STUDIES]->(c:Course)<-[:STUDIES]-(b)
      WITH a, b, mutuals, collect(DISTINCT c) AS courses

      // Shared clubs
      OPTIONAL MATCH (a)-[:MEMBER_OF]->(cl:Club)<-[:MEMBER_OF]-(b)
      WITH a, b, mutuals, courses, collect(DISTINCT cl) AS clubs

      // Shared interests
      OPTIONAL MATCH (a)-[:HAS_INTEREST]->(i:Interest)<-[:HAS_INTEREST]-(b)
      WITH a, b, mutuals, courses, clubs, collect(DISTINCT i) AS interests

      // Common events
      OPTIONAL MATCH (a)-[:PARTICIPATES_IN]->(e:Event)<-[:PARTICIPATES_IN]-(b)
      WITH mutuals, courses, clubs, interests, collect(DISTINCT e) AS events

      RETURN mutuals, courses, clubs, interests, events
    `;

    const res = await session.run(query, { studentIdA, studentIdB });
    if (res.records.length === 0) {
      return {
        mutualFriends: [], sharedCourses: [], sharedClubs: [], sharedInterests: [], commonEvents: [],
        counts: { mutualFriends: 0, sharedCourses: 0, sharedClubs: 0, sharedInterests: 0, commonEvents: 0 }
      };
    }

    const rec = res.records[0];

    const mutualFriends = (rec.get('mutuals') || []).map(n => sanitizeStudent(n.properties));
    const sharedCourses = (rec.get('courses') || []).map(n => n.properties);
    const sharedClubs   = (rec.get('clubs')   || []).map(n => n.properties);
    const sharedInterests = (rec.get('interests') || []).map(n => n.properties);
    const commonEvents  = (rec.get('events')  || []).map(n => n.properties);

    return {
      mutualFriends,
      sharedCourses,
      sharedClubs,
      sharedInterests,
      commonEvents,
      counts: {
        mutualFriends : mutualFriends.length,
        sharedCourses : sharedCourses.length,
        sharedClubs   : sharedClubs.length,
        sharedInterests: sharedInterests.length,
        commonEvents  : commonEvents.length,
      }
    };
  } finally {
    await session.close();
  }
};

/**
 * Returns the mutual friends between two students with their profiles.
 * Kept for backwards-compatibility with the existing route/frontend.
 * @param {string} studentIdA
 * @param {string} studentIdB
 */
export const getMutualFriends = async (studentIdA, studentIdB) => {
  if (studentIdA === studentIdB) {
    return { count: 0, mutualFriends: [], message: 'Same student' };
  }

  const session = getSession();
  try {
    const query = `
      MATCH (a:Student {studentId: $studentIdA})-[:FRIENDS_WITH]-(mutual:Student)-[:FRIENDS_WITH]-(b:Student {studentId: $studentIdB})
      WHERE mutual.studentId <> $studentIdA AND mutual.studentId <> $studentIdB
      OPTIONAL MATCH (mutual)-[:HAS_INTEREST]->(i:Interest)
      WITH mutual, collect(DISTINCT i.name) AS interests
      ORDER BY mutual.name ASC
      RETURN mutual, interests
    `;

    const res = await session.run(query, { studentIdA, studentIdB });

    const mutualFriends = res.records.map(rec => ({
      student: sanitizeStudent(rec.get('mutual').properties),
      interests: rec.get('interests') || [],
    }));

    return { count: mutualFriends.length, mutualFriends };
  } finally {
    await session.close();
  }
};

/**
 * Finds the shortest connection path between two students across all
 * relationship types: FRIENDS_WITH, STUDIES (via shared Course),
 * MEMBER_OF (via shared Club), PARTICIPATES_IN (via shared Event).
 *
 * Returns detailed path with node types and relationship labels.
 *
 * @param {string} studentIdA
 * @param {string} studentIdB
 * @param {number} [maxHops=6]
 */
export const getConnectionPath = async (studentIdA, studentIdB, maxHops = 6) => {
  if (studentIdA === studentIdB) {
    return { found: false, distance: 0, path: [], message: 'Same student – no path needed.' };
  }

  const session = getSession();
  try {
    /**
     * shortestPath() in Neo4j does not accept a parameterized upper bound
     * (*1..$maxHops). We use a fixed literal maximum of 10 hops (the absolute
     * ceiling enforced by the controller) and apply the user-requested cap with
     * a WHERE filter on the returned path length.
     */
    const query = `
      MATCH (a:Student {studentId: $studentIdA}),
            (b:Student {studentId: $studentIdB})
      MATCH path = shortestPath(
        (a)-[:FRIENDS_WITH|STUDIES|MEMBER_OF|PARTICIPATES_IN|HAS_INTEREST*1..10]-(b)
      )
      WHERE length(path) <= $maxHops
      RETURN
        [n IN nodes(path) |
          CASE
            WHEN n:Student  THEN {id: n.studentId, label: n.name, type: 'Student', department: n.department}
            WHEN n:Course   THEN {id: n.courseCode, label: n.courseName, type: 'Course'}
            WHEN n:Club     THEN {id: n.clubId, label: n.name, type: 'Club'}
            WHEN n:Event    THEN {id: n.eventId, label: n.title, type: 'Event'}
            WHEN n:Interest THEN {id: n.name, label: n.name, type: 'Interest'}
            ELSE {id: 'unknown', label: 'Unknown', type: 'Unknown'}
          END
        ] AS pathNodes,
        [r IN relationships(path) | type(r)] AS relTypes,
        length(path) AS distance
      LIMIT 1
    `;

    const res = await session.run(query, {
      studentIdA,
      studentIdB,
      maxHops: parseInt(maxHops, 10),
    });

    if (res.records.length === 0) {
      return {
        found: false,
        distance: -1,
        path: [],
        message: `No connection found within ${maxHops} hops. Try increasing the hop limit.`,
      };
    }

    const rec = res.records[0];
    const pathNodes = rec.get('pathNodes');
    const relTypes  = rec.get('relTypes');
    const distance  = safeNum(rec.get('distance'));

    // Interleave nodes and relationship labels for display
    const pathWithRels = [];
    pathNodes.forEach((node, idx) => {
      pathWithRels.push({ kind: 'node', ...node });
      if (idx < relTypes.length) {
        pathWithRels.push({ kind: 'rel', label: relTypes[idx] });
      }
    });

    return {
      found: true,
      distance,
      path: pathWithRels,
      pathNodes,
      relTypes,
      message: `Connected in ${distance} hop${distance === 1 ? '' : 's'}.`,
    };
  } finally {
    await session.close();
  }
};

/**
 * Returns the default scoring weights so the frontend can display them.
 */
export const getScoringWeights = () => ({ ...DEFAULT_WEIGHTS });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const safeNum = (val) => {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  if (typeof val.toNumber === 'function') return val.toNumber();
  return Number(val) || 0;
};
