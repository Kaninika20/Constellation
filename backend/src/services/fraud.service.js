import { getDriver, getSession } from '../config/neo4j.config.js';
import neo4j from 'neo4j-driver';
import { DEFAULT_RISK_CONFIG, scoreSuspiciousActivity, validateRiskConfig } from './graph-analysis.js';
import { loadGraphSnapshot } from './graph-analysis-data.service.js';

// Helper to safely convert Neo4j integers
const toInt = (val) => (neo4j.isInt(val) ? val.toNumber() : (val ?? 0));
const toFloat = (val) => (typeof val === 'number' ? val : (val?.toNumber?.() ?? 0));

export const updateFraudRiskScores = async () => {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (s:Student)
      OPTIONAL MATCH (s)-[:STUDIES]->(c:Course)
      OPTIONAL MATCH (s)-[:MEMBER_OF]->(cl:Club)
      OPTIONAL MATCH (s)-[:FRIENDS_WITH]-(f:Student)
      OPTIONAL MATCH (s)-[:FOLLOWS]->(out:Student)
      WITH s,
        count(DISTINCT c) AS courses,
        count(DISTINCT cl) AS clubs,
        count(DISTINCT f) AS friends,
        count(DISTINCT out) AS following
      SET s.fraudRiskScore = CASE
        WHEN courses = 0 AND clubs = 0 AND following > 10 THEN 0.90
        WHEN courses = 0 AND clubs = 0 AND following > 5  THEN 0.75
        WHEN courses = 0 AND clubs = 0                   THEN 0.50
        WHEN courses = 0 AND following > 5               THEN 0.35
        ELSE 0.05
      END,
      s.lastScoreUpdate = datetime()
      RETURN count(s) AS updated
    `);
    return { updated: toInt(result.records[0]?.get('updated')) };
  } finally {
    await session.close();
  }
};

export const getHighRiskStudents = async (threshold = 0.4) => {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (s:Student)
      WHERE s.fraudRiskScore >= $threshold
      OPTIONAL MATCH (s)-[:STUDIES]->(c:Course)
      OPTIONAL MATCH (s)-[:MEMBER_OF]->(cl:Club)
      OPTIONAL MATCH (s)-[:FRIENDS_WITH]-(f:Student)
      OPTIONAL MATCH (s)-[:FOLLOWS]->(out:Student)
      WITH s,
        count(DISTINCT c) AS courseCount,
        count(DISTINCT cl) AS clubCount,
        count(DISTINCT f) AS friendCount,
        count(DISTINCT out) AS followingCount
      RETURN s {
        .studentId, .name, .email, .department, .yearOfStudy,
        .profileImageUrl, .fraudRiskScore
      } AS student,
        courseCount, clubCount, friendCount, followingCount
      ORDER BY s.fraudRiskScore DESC
    `, { threshold });
    return result.records.map(r => ({
      ...r.get('student'),
      fraudRiskScore: toFloat(r.get('student').fraudRiskScore),
      courseCount: toInt(r.get('courseCount')),
      clubCount: toInt(r.get('clubCount')),
      friendCount: toInt(r.get('friendCount')),
      followingCount: toInt(r.get('followingCount'))
    }));
  } finally {
    await session.close();
  }
};

export const getSybilCandidates = async () => {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (s:Student)
      OPTIONAL MATCH (s)-[:STUDIES]->(c:Course)
      OPTIONAL MATCH (s)-[:MEMBER_OF]->(cl:Club)
      OPTIONAL MATCH (s)-[:FOLLOWS]->(out:Student)
      OPTIONAL MATCH (in:Student)-[:FOLLOWS]->(s)
      OPTIONAL MATCH (s)-[:FRIENDS_WITH]-(f:Student)
      WITH s,
        count(DISTINCT c) AS courseCount,
        count(DISTINCT cl) AS clubCount,
        count(DISTINCT out) AS followingCount,
        count(DISTINCT in) AS followerCount,
        count(DISTINCT f) AS friendCount
      WHERE courseCount = 0 OR (clubCount = 0 AND followingCount > 3)
      RETURN s {
        .studentId, .name, .email, .department, .yearOfStudy,
        .profileImageUrl, .fraudRiskScore
      } AS student,
        courseCount, clubCount, followingCount, followerCount, friendCount
      ORDER BY followingCount DESC
      LIMIT 20
    `);
    return result.records.map(r => ({
      ...r.get('student'),
      fraudRiskScore: toFloat(r.get('student').fraudRiskScore ?? 0),
      courseCount: toInt(r.get('courseCount')),
      clubCount: toInt(r.get('clubCount')),
      followingCount: toInt(r.get('followingCount')),
      followerCount: toInt(r.get('followerCount')),
      friendCount: toInt(r.get('friendCount')),
      anomalyIndicators: buildAnomalyIndicators({
        courseCount: toInt(r.get('courseCount')),
        clubCount: toInt(r.get('clubCount')),
        followingCount: toInt(r.get('followingCount')),
        followerCount: toInt(r.get('followerCount')),
        friendCount: toInt(r.get('friendCount'))
      })
    }));
  } finally {
    await session.close();
  }
};

const buildAnomalyIndicators = ({ courseCount, clubCount, followingCount, followerCount, friendCount }) => {
  const indicators = [];
  if (courseCount === 0) indicators.push('No enrolled courses');
  if (clubCount === 0) indicators.push('No club memberships');
  if (followingCount > 10) indicators.push(`Follows ${followingCount} accounts`);
  if (followerCount === 0 && followingCount > 5) indicators.push('Zero reciprocal follows');
  if (friendCount === 0 && followingCount > 3) indicators.push('No confirmed friendships');
  return indicators;
};

export const getSuspiciousCliques = async () => {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (s:Student)-[:FRIENDS_WITH]-(friend:Student)
      WITH s, collect(DISTINCT friend.studentId) AS friendIds, count(DISTINCT friend) AS degree
      WHERE degree >= 3
      OPTIONAL MATCH (s)-[:STUDIES]->(c:Course)
      OPTIONAL MATCH (s)-[:MEMBER_OF]->(cl:Club)
      WITH s, friendIds, degree,
        count(DISTINCT c) AS courseCount,
        count(DISTINCT cl) AS clubCount
      WHERE courseCount = 0 AND clubCount = 0
      RETURN s { .studentId, .name, .department, .fraudRiskScore } AS student,
        friendIds, degree, courseCount, clubCount
      ORDER BY degree DESC
      LIMIT 10
    `);
    return result.records.map(r => ({
      student: {
        ...r.get('student'),
        fraudRiskScore: toFloat(r.get('student').fraudRiskScore ?? 0)
      },
      friendIds: r.get('friendIds'),
      degree: toInt(r.get('degree')),
      courseCount: toInt(r.get('courseCount')),
      clubCount: toInt(r.get('clubCount')),
      suspicionReason: 'Heavily connected but no academic engagement'
    }));
  } finally {
    await session.close();
  }
};

export const getStudentFraudMetrics = async (studentId) => {
  const driver = getDriver();
  const session = driver.session();
  try {
    // Degree centrality
    const centralityResult = await session.run(`
      MATCH (s:Student {studentId: $studentId})
      OPTIONAL MATCH (s)-[:FRIENDS_WITH]-(friend:Student)
      OPTIONAL MATCH (s)-[:FOLLOWS]->(out:Student)
      OPTIONAL MATCH (in:Student)-[:FOLLOWS]->(s)
      RETURN s { .studentId, .name, .email, .department, .fraudRiskScore } AS student,
        count(DISTINCT friend) AS friendDegree,
        count(DISTINCT out)    AS followingCount,
        count(DISTINCT in)     AS followerCount
    `, { studentId });

    if (!centralityResult.records.length) return null;
    const cr = centralityResult.records[0];

    // Local clustering coefficient
    const clusterResult = await session.run(`
      MATCH (s:Student {studentId: $studentId})-[:FRIENDS_WITH]-(friend:Student)
      WITH s, collect(DISTINCT friend) AS friends
      UNWIND friends AS f1
      UNWIND friends AS f2
      WITH s, friends, f1, f2
      WHERE id(f1) < id(f2) AND (f1)-[:FRIENDS_WITH]-(f2)
      WITH s, friends, count(*) AS triangles
      WITH s, friends, triangles, size(friends) AS degree
      RETURN degree, triangles,
        CASE WHEN degree > 1
          THEN toFloat(triangles) / (toFloat(degree) * toFloat(degree - 1) / 2.0)
          ELSE 0.0
        END AS clusteringCoeff
    `, { studentId });

    const clr = clusterResult.records[0];
    const friendDegree = toInt(cr.get('friendDegree'));
    const followingCount = toInt(cr.get('followingCount'));
    const followerCount = toInt(cr.get('followerCount'));
    const totalDegree = friendDegree + followingCount + followerCount;

    return {
      student: {
        ...cr.get('student'),
        fraudRiskScore: toFloat(cr.get('student').fraudRiskScore ?? 0.05)
      },
      centrality: {
        friendDegree,
        followingCount,
        followerCount,
        totalDegree,
        normalizedDegree: totalDegree > 0 ? parseFloat((totalDegree / 100).toFixed(4)) : 0
      },
      clustering: {
        degree: clr ? toInt(clr.get('degree')) : 0,
        triangles: clr ? toInt(clr.get('triangles')) : 0,
        clusteringCoeff: clr ? parseFloat(toFloat(clr.get('clusteringCoeff')).toFixed(4)) : 0
      }
    };
  } finally {
    await session.close();
  }
};

export const getPathBetween = async (studentIdA, studentIdB) => {
  if (studentIdA === studentIdB) {
    return { distance: 0, path: [], message: 'Same student' };
  }
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH path = shortestPath(
        (s1:Student {studentId: $studentIdA})-[:FRIENDS_WITH|FOLLOWS*..8]-(s2:Student {studentId: $studentIdB})
      )
      RETURN [node IN nodes(path) | node { .studentId, .name, .department }] AS pathNodes,
        length(path) AS distance
    `, { studentIdA, studentIdB });

    if (!result.records.length) {
      return { distance: -1, path: [], message: 'No path found within 8 hops' };
    }
    const rec = result.records[0];
    return {
      distance: toInt(rec.get('distance')),
      path: rec.get('pathNodes'),
      message: `Connected in ${toInt(rec.get('distance'))} hop(s)`
    };
  } finally {
    await session.close();
  }
};

export const analyzeSuspiciousActivity = async configOverrides => {
  const config = validateRiskConfig(configOverrides);
  const session = getSession();
  try {
    const snapshot = await loadGraphSnapshot(session);
    const analyzedAt = new Date().toISOString();
    const students = scoreSuspiciousActivity({ ...snapshot, config, now: analyzedAt });
    const persistenceRows = students.map(student => ({
      studentId: student.studentId,
      riskScore: student.riskScore,
      fraudRiskScore: student.fraudRiskScore,
      riskLevel: student.riskLevel,
      indicators: student.riskIndicators.map(indicator => indicator.description),
      indicatorDetails: JSON.stringify(student.riskIndicators)
    }));

    await session.run(`
      UNWIND $rows AS row
      MATCH (s:Student {studentId: row.studentId})
      SET s.riskScore = row.riskScore,
          s.fraudRiskScore = row.fraudRiskScore,
          s.riskLevel = row.riskLevel,
          s.riskIndicators = row.indicators,
          s.riskIndicatorDetails = row.indicatorDetails,
          s.riskConfiguration = $configuration,
          s.riskAnalyzedAt = datetime($analyzedAt)
    `, {
      rows: persistenceRows,
      configuration: JSON.stringify(config),
      analyzedAt
    });

    return {
      analyzedAt,
      config,
      analyzed: students.length,
      riskLevelCounts: students.reduce((counts, student) => {
        counts[student.riskLevel] += 1;
        return counts;
      }, { Low: 0, Medium: 0, High: 0 }),
      students
    };
  } finally {
    await session.close();
  }
};

export const getSuspiciousActivityAnalysis = async () => {
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (s:Student)
      WHERE s.riskScore IS NOT NULL
      RETURN s.studentId AS studentId, s.name AS name, s.department AS department,
        s.profileImageUrl AS profileImageUrl, s.riskScore AS riskScore,
        s.fraudRiskScore AS fraudRiskScore, s.riskLevel AS riskLevel,
        s.riskIndicatorDetails AS riskIndicatorDetails,
        s.riskAnalyzedAt AS riskAnalyzedAt, s.riskConfiguration AS riskConfiguration,
        s.friendCount AS friendCount
      ORDER BY riskScore DESC, studentId
    `);
    const students = result.records.map(record => ({
      studentId: record.get('studentId'),
      name: record.get('name'),
      department: record.get('department'),
      profileImageUrl: record.get('profileImageUrl'),
      riskScore: toInt(record.get('riskScore')),
      fraudRiskScore: toFloat(record.get('fraudRiskScore')),
      riskLevel: record.get('riskLevel'),
      riskIndicators: JSON.parse(record.get('riskIndicatorDetails') || '[]'),
      riskAnalyzedAt: record.get('riskAnalyzedAt')?.toString() || null
    }));
    const timestamp = result.records[0]?.get('riskAnalyzedAt');
    const storedConfig = result.records[0]?.get('riskConfiguration');
    const config = storedConfig ? validateRiskConfig(JSON.parse(storedConfig)) : DEFAULT_RISK_CONFIG;
    return {
      analyzedAt: timestamp?.toString() || null,
      config,
      analyzed: students.length,
      riskLevelCounts: students.reduce((counts, student) => {
        counts[student.riskLevel] += 1;
        return counts;
      }, { Low: 0, Medium: 0, High: 0 }),
      students
    };
  } finally {
    await session.close();
  }
};
