/**
 * =============================================================================
 * Constellation – Admin & Enhanced Fraud Scoring Service  (Week 5 – Parts B & C)
 * =============================================================================
 *
 * SCORING METHODOLOGY (Configurable, Rule-Based)
 * ───────────────────────────────────────────────
 * Each indicator adds points to a raw score (0–100).  The raw score is then
 * normalised to 0.0–1.0 and categorised:
 *
 *   Low     : score < LOW_THRESHOLD      (default 0.20)
 *   Medium  : LOW_THRESHOLD ≤ score < HIGH_THRESHOLD (default 0.50)
 *   High    : score ≥ HIGH_THRESHOLD     (default 0.50)
 *
 * THRESHOLD RATIONALE
 * ───────────────────
 * Thresholds are set conservatively to minimise false positives:
 *   • 0.20 (Low): a student must exhibit at least one meaningful anomaly before
 *     leaving the "clean" category.  Very common patterns (e.g. not being in a
 *     club) don't alone reach this.
 *   • 0.50 (Medium/High split): requires two or more strong indicators, e.g.
 *     no academic engagement AND unusual follow ratios.
 * Administrators can override both thresholds via query params.
 *
 * INDICATORS & WEIGHTS
 * ────────────────────
 *   no_courses           → +25  (zero enrolled courses — primary sybil signal)
 *   no_clubs             → +15  (zero club memberships)
 *   no_friends           → +10  (zero accepted friendships)
 *   high_following       → +20  (following > HIGH_FOLLOWING_THRESHOLD peers)
 *   asymmetric_follow    → +15  (following > 3× own followers)
 *   isolated             → +10  (no courses AND no clubs AND no friends)
 *   dense_friend_no_acad → +20  (≥ 4 friends but zero courses — bot-ring signal)
 *   pending_req_flood    → +10  (≥ 5 pending outgoing requests)
 *
 * IMPORTANT: scores are for review purposes only. No automatic action is taken.
 * =============================================================================
 */

import { getDriver } from '../config/neo4j.config.js';
import neo4j from 'neo4j-driver';

const toInt   = (v) => (neo4j.isInt(v) ? v.toNumber() : (v ?? 0));
const toFloat = (v) => (typeof v === 'number' ? v : (v?.toNumber?.() ?? 0));

// ─── Default configurable thresholds ─────────────────────────────────────────
export const DEFAULT_THRESHOLDS = {
  lowRisk           : 0.20,   // 0.0–0.20  = Low
  highRisk          : 0.50,   // 0.50–1.0  = High  (between = Medium)
  highFollowing     : 8,      // following count considered suspicious
  pendingReqFlood   : 5,      // pending outgoing requests considered suspicious
  denseNoAcadFriends: 4,      // friend count with zero courses = suspicious
};

// ─── Indicator definitions (name, points, description) ───────────────────────
const INDICATORS = [
  { key: 'no_courses',           points: 25, label: 'No enrolled courses' },
  { key: 'no_clubs',             points: 15, label: 'No club memberships' },
  { key: 'no_friends',           points: 10, label: 'No confirmed friendships' },
  { key: 'high_following',       points: 20, label: 'Unusually high following count' },
  { key: 'asymmetric_follow',    points: 15, label: 'Follow ratio highly asymmetric (follows >> followers)' },
  { key: 'isolated',             points: 10, label: 'Fully isolated — no courses, clubs, or friends' },
  { key: 'dense_friend_no_acad', points: 20, label: 'High friend count with zero academic engagement (bot-ring pattern)' },
  { key: 'pending_req_flood',    points: 10, label: 'Excessive pending outgoing friend requests' },
];
const MAX_RAW_SCORE = INDICATORS.reduce((s, i) => s + i.points, 0); // 125

// =============================================================================
// ENHANCED RISK SCORING
// =============================================================================

/**
 * Recalculates risk scores for every student and writes them back to Neo4j.
 * Returns a summary of the update.
 */
export const recalculateEnhancedScores = async (thresholds = {}) => {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const driver = getDriver();
  const session = driver.session();
  try {
    // Gather all metrics in a single traversal
    const metricsQuery = `
      MATCH (s:Student)
      OPTIONAL MATCH (s)-[:STUDIES]->(c:Course)
      OPTIONAL MATCH (s)-[:MEMBER_OF]->(cl:Club)
      OPTIONAL MATCH (s)-[:FRIENDS_WITH]-(f:Student)
      OPTIONAL MATCH (s)-[:FOLLOWS]->(out:Student)
      OPTIONAL MATCH (inc:Student)-[:FOLLOWS]->(s)
      OPTIONAL MATCH (s)-[pr:PENDING_FRIEND_REQUEST]->(pending:Student)
      WITH s,
        count(DISTINCT c)       AS courses,
        count(DISTINCT cl)      AS clubs,
        count(DISTINCT f)       AS friends,
        count(DISTINCT out)     AS following,
        count(DISTINCT inc)     AS followers,
        count(DISTINCT pending) AS pendingOut
      RETURN s.studentId AS id, courses, clubs, friends, following, followers, pendingOut
    `;
    const res = await session.run(metricsQuery);

    let updated = 0;
    for (const rec of res.records) {
      const id         = rec.get('id');
      const courses    = toInt(rec.get('courses'));
      const clubs      = toInt(rec.get('clubs'));
      const friends    = toInt(rec.get('friends'));
      const following  = toInt(rec.get('following'));
      const followers  = toInt(rec.get('followers'));
      const pendingOut = toInt(rec.get('pendingOut'));

      const { rawScore, activeIndicators } = computeRawScore(
        { courses, clubs, friends, following, followers, pendingOut }, t
      );
      const normalised = parseFloat(Math.min(rawScore / MAX_RAW_SCORE, 1.0).toFixed(4));
      const category   = categorise(normalised, t);

      await session.run(`
        MATCH (s:Student {studentId: $id})
        SET s.fraudRiskScore       = $score,
            s.riskCategory         = $category,
            s.riskIndicators       = $indicators,
            s.riskMetrics          = $metrics,
            s.lastScoreUpdate      = datetime(),
            s.reviewStatus         = coalesce(s.reviewStatus, 'pending')
        RETURN s
      `, {
        id,
        score     : normalised,
        category,
        indicators: activeIndicators,
        metrics   : JSON.stringify({ courses, clubs, friends, following, followers, pendingOut }),
      });
      updated++;
    }

    return {
      updated,
      thresholdsUsed: t,
      maxPossibleScore: MAX_RAW_SCORE,
    };
  } finally {
    await session.close();
  }
};

/**
 * Returns detailed fraud metrics for a single student.
 */
export const getStudentRiskDetail = async (studentId) => {
  const driver = getDriver();
  const session = driver.session();
  try {
    const res = await session.run(`
      MATCH (s:Student {studentId: $studentId})
      OPTIONAL MATCH (s)-[:STUDIES]->(c:Course)
      OPTIONAL MATCH (s)-[:MEMBER_OF]->(cl:Club)
      OPTIONAL MATCH (s)-[:FRIENDS_WITH]-(f:Student)
      OPTIONAL MATCH (s)-[:FOLLOWS]->(out:Student)
      OPTIONAL MATCH (inc:Student)-[:FOLLOWS]->(s)
      OPTIONAL MATCH (s)-[pr:PENDING_FRIEND_REQUEST]->(pending:Student)
      WITH s,
        count(DISTINCT c)       AS courses,
        count(DISTINCT cl)      AS clubs,
        count(DISTINCT f)       AS friends,
        count(DISTINCT out)     AS following,
        count(DISTINCT inc)     AS followers,
        count(DISTINCT pending) AS pendingOut,
        collect(DISTINCT c.courseName)[0..5]    AS courseNames,
        collect(DISTINCT cl.name)[0..5]         AS clubNames,
        collect(DISTINCT f.name)[0..5]          AS friendNames
      RETURN s, courses, clubs, friends, following, followers, pendingOut,
             courseNames, clubNames, friendNames
    `, { studentId });

    if (!res.records.length) return null;
    const r = res.records[0];

    const courses    = toInt(r.get('courses'));
    const clubs      = toInt(r.get('clubs'));
    const friends    = toInt(r.get('friends'));
    const following  = toInt(r.get('following'));
    const followers  = toInt(r.get('followers'));
    const pendingOut = toInt(r.get('pendingOut'));

    const { rawScore, activeIndicators, indicatorDetails } = computeRawScore(
      { courses, clubs, friends, following, followers, pendingOut },
      DEFAULT_THRESHOLDS,
      true
    );
    const normalised = parseFloat(Math.min(rawScore / MAX_RAW_SCORE, 1.0).toFixed(4));
    const category   = categorise(normalised, DEFAULT_THRESHOLDS);

    const sprops = r.get('s').properties;
    const { passwordHash, ...safeProps } = sprops;
    const storedIndicators = safeProps.riskIndicatorDetails
      ? JSON.parse(safeProps.riskIndicatorDetails)
      : indicatorDetails;
    const storedScore = safeProps.riskScore == null
      ? normalised
      : parseFloat((toFloat(safeProps.riskScore) / 100).toFixed(4));
    const relatedRes = await session.run(`
      MATCH (s:Student {studentId: $studentId})
      CALL {
        WITH s
        OPTIONAL MATCH (s)-[:FRIENDS_WITH]-(related:Student)
        RETURN collect(DISTINCT related {
          .studentId, .name, .department, .riskLevel, .riskScore, .fraudRiskScore
        }) AS friends
      }
      CALL {
        WITH s
        OPTIONAL MATCH (s)-[:FOLLOWS]->(related:Student)
        RETURN collect(DISTINCT related {
          .studentId, .name, .department, .riskLevel, .riskScore, .fraudRiskScore
        }) AS following
      }
      CALL {
        WITH s
        OPTIONAL MATCH (related:Student)-[:FOLLOWS]->(s)
        RETURN collect(DISTINCT related {
          .studentId, .name, .department, .riskLevel, .riskScore, .fraudRiskScore
        }) AS followers
      }
      RETURN friends, following, followers
    `, { studentId });
    const relatedRecord = relatedRes.records[0];
    const reviewHistory = safeProps.reviewHistory
      ? JSON.parse(safeProps.reviewHistory)
      : (safeProps.reviewedAt ? [{
          reviewedAt: typeof safeProps.reviewedAt === 'object' ? safeProps.reviewedAt.toString() : safeProps.reviewedAt,
          reviewerStudentId: safeProps.reviewedBy || null,
          notes: safeProps.reviewNotes || ''
        }] : []);

    return {
      student: safeProps,
      riskScore       : toFloat(safeProps.fraudRiskScore ?? storedScore),
      computedScore   : storedScore,
      riskCategory    : safeProps.riskLevel || safeProps.riskCategory || category,
      reviewStatus    : safeProps.reviewStatus || 'pending',
      lastAnalysed    : safeProps.lastScoreUpdate
        ? (typeof safeProps.lastScoreUpdate === 'object' ? safeProps.lastScoreUpdate.toString() : safeProps.lastScoreUpdate)
        : null,
      metrics: {
        courses, clubs, friends, following, followers, pendingOut,
        courseNames  : r.get('courseNames') || [],
        clubNames    : r.get('clubNames')   || [],
        friendNames  : r.get('friendNames') || [],
      },
      relatedAccounts: {
        friends: (relatedRecord?.get('friends') || []).filter(account => account.studentId),
        following: (relatedRecord?.get('following') || []).filter(account => account.studentId),
        followers: (relatedRecord?.get('followers') || []).filter(account => account.studentId)
      },
      reviewHistory,
      activeIndicators: safeProps.riskIndicators || activeIndicators,
      indicatorDetails: storedIndicators,
      thresholds: DEFAULT_THRESHOLDS,
      scoreBreakdown: {
        rawScore,
        maxScore: MAX_RAW_SCORE,
        percentage: parseFloat(((rawScore / MAX_RAW_SCORE) * 100).toFixed(1)),
      },
    };
  } finally {
    await session.close();
  }
};

/**
 * Returns all students above a risk threshold, with full indicator breakdowns.
 */
export const getFlaggedStudents = async (thresholds = {}) => {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const driver = getDriver();
  const session = driver.session();
  try {
    const res = await session.run(`
      MATCH (s:Student)
      WHERE coalesce(s.riskScore, 0) > 0 OR coalesce(s.fraudRiskScore, 0) >= $minScore
      OPTIONAL MATCH (s)-[:STUDIES]->(c:Course)
      OPTIONAL MATCH (s)-[:MEMBER_OF]->(cl:Club)
      OPTIONAL MATCH (s)-[:FRIENDS_WITH]-(f:Student)
      OPTIONAL MATCH (s)-[:FOLLOWS]->(out:Student)
      OPTIONAL MATCH (inc:Student)-[:FOLLOWS]->(s)
      WITH s,
        count(DISTINCT c)  AS courses,
        count(DISTINCT cl) AS clubs,
        count(DISTINCT f)  AS friends,
        count(DISTINCT out) AS following,
        count(DISTINCT inc) AS followers
      RETURN s, courses, clubs, friends, following, followers
      ORDER BY s.fraudRiskScore DESC
    `, { minScore: t.lowRisk });

    return res.records.map(r => {
      const sp = r.get('s').properties;
      const { passwordHash, ...safe } = sp;
      const score = toFloat(safe.fraudRiskScore ?? 0);
      return {
        ...safe,
        fraudRiskScore : score,
        riskCategory   : safe.riskLevel || safe.riskCategory || categorise(score, t),
        reviewStatus   : safe.reviewStatus || 'pending',
        courseCount    : toInt(r.get('courses')),
        clubCount      : toInt(r.get('clubs')),
        friendCount    : toInt(r.get('friends')),
        followingCount : toInt(r.get('following')),
        followerCount  : toInt(r.get('followers')),
        riskIndicators : safe.riskIndicators || [],
        riskIndicatorDetails: safe.riskIndicatorDetails
          ? JSON.parse(safe.riskIndicatorDetails)
          : [],
      };
    });
  } finally {
    await session.close();
  }
};

/**
 * Marks a student account as reviewed by an admin.
 */
export const markAccountReviewed = async (studentId, reviewerStudentId, notes = '') => {
  const driver = getDriver();
  const session = driver.session();
  try {
    const res = await session.executeWrite(async tx => {
      const existing = await tx.run(`
        MATCH (s:Student {studentId: $studentId})
        RETURN s.reviewHistory AS reviewHistory
      `, { studentId });
      if (!existing.records.length) {
        const err = new Error(`Student '${studentId}' not found.`);
        err.statusCode = 404;
        throw err;
      }
      const history = existing.records[0].get('reviewHistory')
        ? JSON.parse(existing.records[0].get('reviewHistory'))
        : [];
      const reviewedAt = new Date().toISOString();
      history.push({ reviewedAt, reviewerStudentId, notes });
      await tx.run(`
      MATCH (s:Student {studentId: $studentId})
      SET s.reviewStatus     = 'reviewed',
          s.reviewedBy       = $reviewerStudentId,
          s.reviewNotes      = $notes,
          s.reviewedAt       = datetime($reviewedAt),
          s.reviewHistory    = $reviewHistory
      RETURN s.studentId AS id
      `, { studentId, reviewerStudentId, notes, reviewedAt, reviewHistory: JSON.stringify(history) });
      return { reviewedAt };
    });
    return {
      studentId,
      reviewStatus: 'reviewed',
      reviewedBy: reviewerStudentId,
      reviewedAt: res.reviewedAt
    };
  } finally {
    await session.close();
  }
};

// =============================================================================
// ADMIN DASHBOARD STATS
// =============================================================================

export const getAdminDashboardStats = async () => {
  const driver = getDriver();
  const session = driver.session();
  try {
    const studentRes = await session.run('MATCH (s:Student) RETURN count(s) AS count');
    const friendshipRes = await session.run('MATCH ()-[r:FRIENDS_WITH]-() RETURN count(DISTINCT r) AS count');
    const followsRes = await session.run('MATCH ()-[r:FOLLOWS]->() RETURN count(r) AS count');
    const communityRes = await session.run(`
      MATCH (s:Student) WHERE s.communityId IS NOT NULL
      RETURN count(DISTINCT s.communityId) AS count
    `);
    const riskRes = await session.run('MATCH (s:Student) RETURN s.fraudRiskScore AS fraudRiskScore, s.riskScore AS riskScore, s.riskLevel AS riskLevel, s.riskCategory AS riskCategory, s.reviewStatus AS reviewStatus');
    const reviewRes = await session.run(`
      MATCH (s:Student)
      WITH
        count(CASE WHEN s.reviewStatus = 'reviewed' THEN 1 END) AS reviewed,
        count(CASE WHEN s.reviewStatus = 'pending'  OR s.reviewStatus IS NULL THEN 1 END) AS pending
      RETURN reviewed, pending
    `);

    const riskDistribution = { low: 0, medium: 0, high: 0 };
    let flaggedAccounts = 0;
    for (const record of riskRes.records) {
      const riskScore = toFloat(record.get('riskScore'));
      const normalizedScore = toFloat(record.get('fraudRiskScore'));
      const level = record.get('riskLevel') || record.get('riskCategory') || categorise(normalizedScore, DEFAULT_THRESHOLDS);
      const key = level.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(riskDistribution, key)) riskDistribution[key]++;
      if (riskScore > 0 || normalizedScore >= DEFAULT_THRESHOLDS.lowRisk) flaggedAccounts++;
    }

    return {
      totalStudents    : toInt(studentRes.records[0]?.get('count')),
      totalFriendships : toInt(friendshipRes.records[0]?.get('count')),
      totalFollows     : toInt(followsRes.records[0]?.get('count')),
      totalCommunities : toInt(communityRes.records[0]?.get('count')),
      flaggedAccounts,
      riskDistribution,
      reviewStatus: {
        reviewed : toInt(reviewRes.records[0]?.get('reviewed')),
        pending  : toInt(reviewRes.records[0]?.get('pending')),
      },
      thresholds: DEFAULT_THRESHOLDS,
    };
  } finally {
    await session.close();
  }
};

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

function computeRawScore(metrics, t, includeDetails = false) {
  const { courses, clubs, friends, following, followers, pendingOut } = metrics;
  const activeIndicators = [];
  const indicatorDetails = [];

  const check = (key, condition, extraInfo = '') => {
    const def = INDICATORS.find(i => i.key === key);
    if (!def) return;
    if (condition) {
      activeIndicators.push(def.label);
      if (includeDetails) {
        indicatorDetails.push({ key, label: def.label, points: def.points, detail: extraInfo });
      }
    }
  };

  check('no_courses',           courses === 0);
  check('no_clubs',             clubs === 0);
  check('no_friends',           friends === 0);
  check('high_following',       following > t.highFollowing,
        `following ${following} accounts (threshold: ${t.highFollowing})`);
  check('asymmetric_follow',    followers > 0 && following > followers * 3,
        `follows ${following}, only ${followers} follow back`);
  check('asymmetric_follow',    followers === 0 && following > 3,
        `follows ${following} accounts with zero reciprocal followers`);
  check('isolated',             courses === 0 && clubs === 0 && friends === 0);
  check('dense_friend_no_acad', friends >= t.denseNoAcadFriends && courses === 0,
        `${friends} friends but no courses`);
  check('pending_req_flood',    pendingOut >= t.pendingReqFlood,
        `${pendingOut} pending outgoing requests (threshold: ${t.pendingReqFlood})`);

  const rawScore = [...new Set(activeIndicators)].reduce((sum, label) => {
    const def = INDICATORS.find(i => i.label === label);
    return sum + (def?.points ?? 0);
  }, 0);

  return { rawScore, activeIndicators: [...new Set(activeIndicators)], indicatorDetails };
}

function categorise(score, t) {
  if (score >= t.highRisk) return 'High';
  if (score >= t.lowRisk)  return 'Medium';
  return 'Low';
}
