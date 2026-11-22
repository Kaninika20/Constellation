const asString = value => (value == null ? null : typeof value === 'string' ? value : value.toString());
const asNumber = value => value == null ? 0 : typeof value === 'number' ? value : value.toNumber();

export const loadGraphSnapshot = async session => {
  const studentResult = await session.run(`
    MATCH (s:Student)
    CALL {
      WITH s
      OPTIONAL MATCH (s)-[:STUDIES]->(c:Course)
      RETURN count(DISTINCT c) AS courseCount
    }
    CALL {
      WITH s
      OPTIONAL MATCH (s)-[:MEMBER_OF]->(cl:Club)
      RETURN count(DISTINCT cl) AS clubCount
    }
    CALL {
      WITH s
      OPTIONAL MATCH (s)-[:HAS_INTEREST]->(i:Interest)
      RETURN count(DISTINCT i) AS interestCount
    }
    RETURN s.studentId AS studentId, s.name AS name, s.department AS department,
      s.profileImageUrl AS profileImageUrl, s.createdAt AS createdAt,
      courseCount, clubCount, interestCount
    ORDER BY studentId
  `);
  const students = studentResult.records.map(record => ({
    studentId: record.get('studentId'),
    name: record.get('name'),
    department: record.get('department'),
    profileImageUrl: record.get('profileImageUrl'),
    createdAt: asString(record.get('createdAt')),
    courseCount: asNumber(record.get('courseCount')),
    clubCount: asNumber(record.get('clubCount')),
    interestCount: asNumber(record.get('interestCount'))
  }));

  const friendshipResult = await session.run(`
    MATCH (a:Student)-[r:FRIENDS_WITH]-(b:Student)
    WHERE elementId(a) < elementId(b)
    RETURN a.studentId AS source, b.studentId AS target,
      r.createdAt AS createdAt, r.since AS since
  `);
  const friendships = friendshipResult.records.map(record => ({
    source: record.get('source'),
    target: record.get('target'),
    createdAt: asString(record.get('createdAt')),
    since: asString(record.get('since'))
  }));

  const followResult = await session.run(`
    MATCH (a:Student)-[:FOLLOWS]->(b:Student)
    RETURN a.studentId AS source, b.studentId AS target
  `);
  const follows = followResult.records.map(record => ({
    source: record.get('source'),
    target: record.get('target')
  }));

  const sharedRelationshipResult = await session.run(`
    MATCH (a:Student)-[r:STUDIES|MEMBER_OF|PARTICIPATES_IN|HAS_INTEREST|BELONGS_TO]->(shared)
          <-[:STUDIES|MEMBER_OF|PARTICIPATES_IN|HAS_INTEREST|BELONGS_TO]-(b:Student)
    WHERE a.studentId < b.studentId
    RETURN a.studentId AS source, b.studentId AS target,
      type(r) AS type
  `);
  const sharedRelationships = sharedRelationshipResult.records.map(record => ({
    source: record.get('source'),
    target: record.get('target'),
    type: record.get('type')
  }));
  const communityEdges = [
    ...friendships.map(edge => ({ ...edge, type: 'FRIENDS_WITH' })),
    ...follows.map(edge => ({ ...edge, type: 'FOLLOWS' })),
    ...sharedRelationships
  ];

  return { students, friendships, follows, communityEdges };
};
