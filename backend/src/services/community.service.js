import { getSession } from '../config/neo4j.config.js';
import { detectCommunities as groupStudents } from './graph-analysis.js';
import { loadGraphSnapshot } from './graph-analysis-data.service.js';

const classifyCohesion = density => {
  if (density >= 0.8) return 'tight-knit';
  if (density >= 0.4) return 'moderate';
  return 'loosely-connected';
};

export const detectCommunities = async () => {
  const session = getSession();
  try {
    const { students, friendships, communityEdges } = await loadGraphSnapshot(session);
    const result = groupStudents(students, friendships, 30, communityEdges);
    const detectedAt = new Date().toISOString();
    const memberships = result.communities.flatMap(community =>
      community.members.map(member => ({ studentId: member.studentId, communityId: community.communityId }))
    );

    await session.run(`
      UNWIND $memberships AS row
      MATCH (s:Student {studentId: row.studentId})
      SET s.communityId = row.communityId,
          s.communityAlgorithm = $algorithm,
          s.communityDetectedAt = datetime($detectedAt)
    `, { memberships, algorithm: result.algorithm, detectedAt });

    const communities = result.communities.map((community, index) => ({
      communityId: community.communityId,
      communityLabel: `Community ${index + 1}`,
      size: community.size,
      internalEdges: community.internalEdges,
      density: community.density,
      cohesion: community.size === 1 ? 'isolated' : classifyCohesion(community.density),
      members: community.members.map(({ studentId, name, department, profileImageUrl }) => ({
        studentId, name, department, profileImageUrl
      }))
    }));
    const communityByStudent = new Map(
      communities.flatMap(community => community.members.map(member => [member.studentId, community.communityId]))
    );
    const nodes = students.map(student => ({
      id: student.studentId,
      studentId: student.studentId,
      name: student.name,
      department: student.department,
      profileImageUrl: student.profileImageUrl,
      communityId: communityByStudent.get(student.studentId)
    }));
    const edges = result.edges.map(({ source, target, types }) => ({ source, target, types }));

    return {
      communities,
      algorithm: result.algorithm,
      algorithmDescription: result.description,
      iterations: result.iterations,
      detectedAt,
      total: communities.length,
      graph: { nodes, edges }
    };
  } finally {
    await session.close();
  }
};

export const getCommunityMembers = async communityId => {
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (s:Student {communityId: $communityId})
      OPTIONAL MATCH (s)-[:HAS_INTEREST]->(i:Interest)
      OPTIONAL MATCH (s)-[:FRIENDS_WITH]-(f:Student)
      WITH s, collect(DISTINCT i.name) AS interests, count(DISTINCT f) AS friendCount
      ORDER BY s.name ASC
      RETURN s { .studentId, .name, .department, .yearOfStudy, .profileImageUrl } AS student,
        interests, friendCount
    `, { communityId });
    return result.records.map(record => ({
      student: record.get('student'),
      interests: record.get('interests') || [],
      friendCount: record.get('friendCount')
    }));
  } finally {
    await session.close();
  }
};

export const getCommunityStats = async () => {
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (s:Student)
      WHERE s.communityId IS NOT NULL
      WITH s.communityId AS communityId, count(s) AS size
      RETURN count(communityId) AS totalCommunities,
        sum(size) AS labelledStudents,
        min(size) AS minSize,
        max(size) AS maxSize,
        avg(size) AS avgSize
    `);
    const record = result.records[0];
    if (!record) {
      return { totalCommunities: 0, labelledStudents: 0, minSize: 0, maxSize: 0, avgSize: 0, algorithm: 'none' };
    }

    const algorithmResult = await session.run(`
      MATCH (s:Student)
      WHERE s.communityAlgorithm IS NOT NULL
      RETURN s.communityAlgorithm AS algorithm
      LIMIT 1
    `);
    const algorithm = algorithmResult.records[0]?.get('algorithm') || 'unknown';
    const asNumber = value => value == null ? 0 : typeof value === 'number' ? value : value.toNumber();
    return {
      totalCommunities: asNumber(record.get('totalCommunities')),
      labelledStudents: asNumber(record.get('labelledStudents')),
      minSize: asNumber(record.get('minSize')),
      maxSize: asNumber(record.get('maxSize')),
      avgSize: Number(asNumber(record.get('avgSize')).toFixed(2)),
      algorithm
    };
  } finally {
    await session.close();
  }
};
