import { getSession } from '../config/neo4j.config.js';

/**
 * Strips sensitive fields (like passwordHash) from node properties.
 */
export const sanitizeStudent = (props) => {
  if (!props) return null;
  const { passwordHash, ...safe } = props;
  return safe;
};

/**
 * Retrieves a paginated list of students with their interests and friends count.
 * Supports filtering by department, yearOfStudy, and searching by name.
 */
export const getAllStudents = async ({ limit = 20, skip = 0, department = null, yearOfStudy = null, search = '' }) => {
  const session = getSession();
  try {
    let whereClauses = [];
    const params = {
      limit: parseInt(limit, 10),
      skip: parseInt(skip, 10)
    };

    if (department && department !== 'All' && department.trim() !== '') {
      whereClauses.push('toLower(s.department) = toLower($department)');
      params.department = department.trim();
    }

    if (yearOfStudy && yearOfStudy !== 'All' && yearOfStudy !== '') {
      whereClauses.push('s.yearOfStudy = toInteger($yearOfStudy)');
      params.yearOfStudy = parseInt(yearOfStudy, 10);
    }

    if (search && search.trim() !== '') {
      whereClauses.push('(toLower(s.name) CONTAINS toLower($search) OR toLower(s.studentId) CONTAINS toLower($search) OR toLower(s.email) CONTAINS toLower($search))');
      params.search = search.trim();
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      MATCH (s:Student)
      ${whereStr}
      OPTIONAL MATCH (s)-[:HAS_INTEREST]->(i:Interest)
      OPTIONAL MATCH (s)-[:FRIENDS_WITH]-(f:Student)
      WITH s, collect(DISTINCT i.name) AS interests, count(DISTINCT f) AS friendsCount
      ORDER BY s.name ASC
      SKIP toInteger($skip)
      LIMIT toInteger($limit)
      RETURN s, interests, friendsCount
    `;

    const countQuery = `
      MATCH (s:Student)
      ${whereStr}
      RETURN count(s) AS total
    `;

    // Run sequentially on the same session: a Neo4j JS driver session is not
    // safe for concurrent queries (would throw "Queries cannot be run directly
    // on a session with an open transaction").
    const result = await session.run(query, params);
    const countResult = await session.run(countQuery, params);

    const total = countResult.records[0].get('total');
    const students = result.records.map(r => {
      const studentProps = sanitizeStudent(r.get('s').properties);
      return {
        ...studentProps,
        interests: r.get('interests') || [],
        friendsCount: r.get('friendsCount') || 0
      };
    });

    return {
      total,
      limit: params.limit,
      skip: params.skip,
      students
    };
  } finally {
    await session.close();
  }
};

/**
 * Retrieves a detailed student profile with all their graph connections:
 * - STUDIES -> Course
 * - FRIENDS_WITH <-> Student
 * - FOLLOWS -> Student
 * - MEMBER_OF -> Club
 * - PARTICIPATES_IN -> Event
 * - HAS_INTEREST -> Interest
 */
export const getStudentDetailGraph = async (studentId) => {
  const session = getSession();
  try {
    const query = `
      MATCH (s:Student {studentId: $studentId})
      
      // Courses
      OPTIONAL MATCH (s)-[r_studies:STUDIES]->(c:Course)
      WITH s, collect(DISTINCT {
        courseCode: c.courseCode,
        courseName: c.courseName,
        department: c.department,
        credits: c.credits,
        semester: r_studies.semester
      }) AS courses
      
      // Clubs
      OPTIONAL MATCH (s)-[r_member:MEMBER_OF]->(cl:Club)
      WITH s, courses, collect(DISTINCT {
        clubId: cl.clubId,
        name: cl.name,
        category: cl.category,
        role: r_member.role
      }) AS clubs

      // Events
      OPTIONAL MATCH (s)-[r_part:PARTICIPATES_IN]->(e:Event)
      WITH s, courses, clubs, collect(DISTINCT {
        eventId: e.eventId,
        title: e.title,
        date: e.date,
        location: e.location
      }) AS events

      // Interests
      OPTIONAL MATCH (s)-[:HAS_INTEREST]->(i:Interest)
      WITH s, courses, clubs, events, collect(DISTINCT i.name) AS interests

      // Friends
      OPTIONAL MATCH (s)-[:FRIENDS_WITH]-(f:Student)
      WITH s, courses, clubs, events, interests, collect(DISTINCT {
        studentId: f.studentId,
        name: f.name,
        department: f.department,
        yearOfStudy: f.yearOfStudy,
        profileImageUrl: f.profileImageUrl
      }) AS friends

      // Following
      OPTIONAL MATCH (s)-[:FOLLOWS]->(target:Student)
      WITH s, courses, clubs, events, interests, friends, collect(DISTINCT {
        studentId: target.studentId,
        name: target.name,
        department: target.department
      }) AS following

      RETURN s, courses, clubs, events, interests, friends, following
    `;

    const result = await session.run(query, { studentId });

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    const studentProps = sanitizeStudent(record.get('s').properties);

    // Filter out null collected objects when relationships don't exist
    const cleanList = (list, key) => (list || []).filter(item => item && item[key] !== null);

    // Follower / following counts (run sequentially on the same session)
    const countRes = await session.run(`
      MATCH (s:Student {studentId: $studentId})
      OPTIONAL MATCH (s)-[:FOLLOWS]->(fo:Student)
      OPTIONAL MATCH (fr:Student)-[:FOLLOWS]->(s)
      RETURN count(DISTINCT fo) AS followingCount, count(DISTINCT fr) AS followersCount
    `, { studentId });
    const cRec = countRes.records[0];

    return {
      student: studentProps,
      courses: cleanList(record.get('courses'), 'courseCode'),
      clubs: cleanList(record.get('clubs'), 'clubId'),
      events: cleanList(record.get('events'), 'eventId'),
      interests: (record.get('interests') || []).filter(Boolean),
      friends: cleanList(record.get('friends'), 'studentId'),
      following: cleanList(record.get('following'), 'studentId'),
      followersCount: cRec.get('followersCount') || 0,
      followingCount: cRec.get('followingCount') || 0
    };
  } finally {
    await session.close();
  }
};

/**
 * Updates a student's profile information and interests graph relationships.
 */
export const updateStudentProfile = async (studentId, { name, department, yearOfStudy, bio, profileImageUrl, interests }) => {
  const session = getSession();
  try {
    // 1. Verify student exists first
    const checkQuery = `
      MATCH (s:Student {studentId: $studentId})
      RETURN s
    `;
    const checkRes = await session.run(checkQuery, { studentId });
    if (checkRes.records.length === 0) {
      const error = new Error(`Student with ID '${studentId}' was not found.`);
      error.statusCode = 404;
      throw error;
    }

    // 2. Build dynamic SET statements for provided properties
    let setClauses = ['s.updatedAt = datetime()'];
    const params = { studentId };

    if (name !== undefined) {
      setClauses.push('s.name = $name');
      params.name = name.trim();
    }
    if (department !== undefined) {
      setClauses.push('s.department = $department');
      params.department = department.trim();
    }
    if (yearOfStudy !== undefined) {
      setClauses.push('s.yearOfStudy = toInteger($yearOfStudy)');
      params.yearOfStudy = parseInt(yearOfStudy, 10);
    }
    if (bio !== undefined) {
      setClauses.push('s.bio = $bio');
      params.bio = bio;
    }
    if (profileImageUrl !== undefined) {
      setClauses.push('s.profileImageUrl = $profileImageUrl');
      params.profileImageUrl = profileImageUrl;
    }

    const updateQuery = `
      MATCH (s:Student {studentId: $studentId})
      SET ${setClauses.join(', ')}
      RETURN s
    `;

    const updateRes = await session.run(updateQuery, params);
    const updatedStudentProps = sanitizeStudent(updateRes.records[0].get('s').properties);

    // 3. Update Interests relationships if provided
    if (Array.isArray(interests)) {
      // Remove old HAS_INTEREST relationships
      const clearInterestsQuery = `
        MATCH (s:Student {studentId: $studentId})-[r:HAS_INTEREST]->(:Interest)
        DELETE r
      `;
      await session.run(clearInterestsQuery, { studentId });

      // Add new HAS_INTEREST relationships
      if (interests.length > 0) {
        const addInterestsQuery = `
          MATCH (s:Student {studentId: $studentId})
          UNWIND $interests AS interestName
          MERGE (i:Interest {name: trim(interestName)})
          ON CREATE SET i.category = 'General'
          MERGE (s)-[:HAS_INTEREST {assignedAt: datetime(), level: 'General'}]->(i)
        `;
        await session.run(addInterestsQuery, { studentId, interests });
      }
    }

    // Return the updated full detail graph
    return await getStudentDetailGraph(studentId);
  } finally {
    await session.close();
  }
};

/**
 * Returns Cytoscape / graph-ready nodes and edges for visualizing the campus graph.
 */
export const getNetworkGraph = async ({ limit = 60 } = {}) => {
  const session = getSession();
  try {
    const query = `
      MATCH (s:Student)
      OPTIONAL MATCH (s)-[r]->(target)
      WHERE type(r) IN ['FRIENDS_WITH', 'FOLLOWS', 'STUDIES', 'MEMBER_OF', 'PARTICIPATES_IN', 'HAS_INTEREST']
      WITH s, r, target
      LIMIT $limit
      RETURN s, r, target
    `;

    const result = await session.run(query, { limit: parseInt(limit, 10) });

    const nodesMap = new Map();
    const edges = [];

    result.records.forEach(record => {
      const sourceNode = record.get('s');
      const rel = record.get('r');
      const targetNode = record.get('target');

      if (sourceNode) {
        const id = sourceNode.properties.studentId;
        if (!nodesMap.has(id)) {
          nodesMap.set(id, {
            data: {
              id,
              label: sourceNode.properties.name,
              type: 'Student',
              department: sourceNode.properties.department,
              yearOfStudy: sourceNode.properties.yearOfStudy,
              riskScore: sourceNode.properties.fraudRiskScore || 0
            }
          });
        }
      }

      if (targetNode && rel) {
        const targetLabel = targetNode.labels[0] || 'Entity';
        const targetId = targetNode.properties.studentId ||
                         targetNode.properties.courseCode ||
                         targetNode.properties.clubId ||
                         targetNode.properties.eventId ||
                         targetNode.properties.name;

        if (targetId && !nodesMap.has(targetId)) {
          nodesMap.set(targetId, {
            data: {
              id: targetId,
              label: targetNode.properties.name || targetNode.properties.title || targetNode.properties.courseName || targetId,
              type: targetLabel,
              category: targetNode.properties.category || targetNode.properties.department || ''
            }
          });
        }

        if (sourceNode && targetId) {
          edges.push({
            data: {
              id: `edge_${rel.identity.toString()}`,
              source: sourceNode.properties.studentId,
              target: targetId,
              label: rel.type
            }
          });
        }
      }
    });

    return {
      elements: {
        nodes: Array.from(nodesMap.values()),
        edges
      },
      stats: {
        nodeCount: nodesMap.size,
        edgeCount: edges.length
      }
    };
  } finally {
    await session.close();
  }
};
