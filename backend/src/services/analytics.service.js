import { getDriver } from '../config/neo4j.config.js';
import neo4j from 'neo4j-driver';

const toInt = (val) => (neo4j.isInt(val) ? val.toNumber() : (val ?? 0));
const toFloat = (val) => (typeof val === 'number' ? val : (val?.toNumber?.() ?? 0));

export const getGraphStats = async () => {
  const driver = getDriver();
  const session = driver.session();
  try {
    const nodeResult = await session.run(`
      CALL {
        MATCH (s:Student)  RETURN 'Student'  AS label, count(s) AS cnt
        UNION ALL
        MATCH (c:Course)   RETURN 'Course'   AS label, count(c) AS cnt
        UNION ALL
        MATCH (cl:Club)    RETURN 'Club'     AS label, count(cl) AS cnt
        UNION ALL
        MATCH (e:Event)    RETURN 'Event'    AS label, count(e) AS cnt
        UNION ALL
        MATCH (i:Interest) RETURN 'Interest' AS label, count(i) AS cnt
      }
      RETURN label, cnt
    `);

    const relResult = await session.run(`
      CALL {
        MATCH ()-[r:FRIENDS_WITH]->()    RETURN 'FRIENDS_WITH'    AS type, count(r) AS cnt
        UNION ALL
        MATCH ()-[r:FOLLOWS]->()         RETURN 'FOLLOWS'         AS type, count(r) AS cnt
        UNION ALL
        MATCH ()-[r:PENDING_FRIEND_REQUEST]->()  RETURN 'PENDING_FRIEND_REQUEST'  AS type, count(r) AS cnt
        UNION ALL
        MATCH ()-[r:MEMBER_OF]->()       RETURN 'MEMBER_OF'       AS type, count(r) AS cnt
        UNION ALL
        MATCH ()-[r:STUDIES]->()         RETURN 'STUDIES'         AS type, count(r) AS cnt
        UNION ALL
        MATCH ()-[r:PARTICIPATES_IN]->() RETURN 'PARTICIPATES_IN' AS type, count(r) AS cnt
        UNION ALL
        MATCH ()-[r:HAS_INTEREST]->()    RETURN 'HAS_INTEREST'    AS type, count(r) AS cnt
      }
      RETURN type, cnt
    `);

    const nodeCounts = {};
    nodeResult.records.forEach(r => { nodeCounts[r.get('label')] = toInt(r.get('cnt')); });

    const relCounts = {};
    relResult.records.forEach(r => { relCounts[r.get('type')] = toInt(r.get('cnt')); });

    const totalNodes = Object.values(nodeCounts).reduce((a, b) => a + b, 0);
    const totalRels  = Object.values(relCounts).reduce((a, b) => a + b, 0);

    return { nodeCounts, relCounts, totalNodes, totalRelationships: totalRels };
  } finally {
    await session.close();
  }
};

export const getMostConnectedStudents = async (limit = 10) => {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (s:Student)
      OPTIONAL MATCH (s)-[:FRIENDS_WITH]-(friend:Student)
      OPTIONAL MATCH (s)-[:FOLLOWS]->(out:Student)
      OPTIONAL MATCH (in:Student)-[:FOLLOWS]->(s)
      OPTIONAL MATCH (s)-[:MEMBER_OF]->(cl:Club)
      OPTIONAL MATCH (s)-[:STUDIES]->(c:Course)
      WITH s,
        count(DISTINCT friend)  AS friendCount,
        count(DISTINCT out)     AS followingCount,
        count(DISTINCT in)      AS followerCount,
        count(DISTINCT cl)      AS clubCount,
        count(DISTINCT c)       AS courseCount
      WITH s, friendCount, followingCount, followerCount, clubCount, courseCount,
        (friendCount + followingCount + followerCount) AS connectionScore
      RETURN s { .studentId, .name, .department, .yearOfStudy, .profileImageUrl } AS student,
        friendCount, followingCount, followerCount, clubCount, courseCount, connectionScore
      ORDER BY connectionScore DESC
      LIMIT $limit
    `, { limit: neo4j.int(limit) });
    return result.records.map(r => ({
      ...r.get('student'),
      friendCount: toInt(r.get('friendCount')),
      followingCount: toInt(r.get('followingCount')),
      followerCount: toInt(r.get('followerCount')),
      clubCount: toInt(r.get('clubCount')),
      courseCount: toInt(r.get('courseCount')),
      connectionScore: toInt(r.get('connectionScore'))
    }));
  } finally {
    await session.close();
  }
};

export const getDepartmentDensity = async () => {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (a:Student)-[:FRIENDS_WITH]-(b:Student)
      WHERE a.department IS NOT NULL AND b.department IS NOT NULL
      WITH a.department AS deptA, b.department AS deptB, count(*) AS connections
      WHERE deptA <= deptB
      RETURN deptA, deptB, connections
      ORDER BY connections DESC
      LIMIT 20
    `);
    return result.records.map(r => ({
      deptA: r.get('deptA'),
      deptB: r.get('deptB'),
      connections: toInt(r.get('connections'))
    }));
  } finally {
    await session.close();
  }
};

export const getPopularClubs = async () => {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (cl:Club)
      OPTIONAL MATCH (s:Student)-[:MEMBER_OF]->(cl)
      WITH cl, count(DISTINCT s) AS memberCount
      RETURN cl { .clubId, .name, .description, .category } AS club, memberCount
      ORDER BY memberCount DESC
    `);
    return result.records.map(r => ({
      ...r.get('club'),
      memberCount: toInt(r.get('memberCount'))
    }));
  } finally {
    await session.close();
  }
};

export const getTrendingEvents = async () => {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (e:Event)
      OPTIONAL MATCH (s:Student)-[:PARTICIPATES_IN]->(e)
      WITH e, count(DISTINCT s) AS participantCount
      RETURN e { .eventId, .title, .description, .date, .location, .category } AS event, participantCount
      ORDER BY participantCount DESC
      LIMIT 10
    `);
    return result.records.map(r => ({
      ...r.get('event'),
      participantCount: toInt(r.get('participantCount'))
    }));
  } finally {
    await session.close();
  }
};
