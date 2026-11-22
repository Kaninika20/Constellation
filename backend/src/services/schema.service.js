import { getSession } from '../config/neo4j.config.js';

/**
 * Cypher definitions for Constellation schema constraints and indexes.
 * Supports Neo4j 5.x syntax with IF NOT EXISTS.
 */
export const SCHEMA_DEFINITIONS = {
  constraints: [
    {
      name: 'student_id_unique',
      label: 'Student',
      property: 'studentId',
      cypher: `CREATE CONSTRAINT student_id_unique IF NOT EXISTS FOR (s:Student) REQUIRE s.studentId IS UNIQUE`
    },
    {
      name: 'student_email_unique',
      label: 'Student',
      property: 'email',
      cypher: `CREATE CONSTRAINT student_email_unique IF NOT EXISTS FOR (s:Student) REQUIRE s.email IS UNIQUE`
    },
    {
      name: 'course_code_unique',
      label: 'Course',
      property: 'courseCode',
      cypher: `CREATE CONSTRAINT course_code_unique IF NOT EXISTS FOR (c:Course) REQUIRE c.courseCode IS UNIQUE`
    },
    {
      name: 'club_id_unique',
      label: 'Club',
      property: 'clubId',
      cypher: `CREATE CONSTRAINT club_id_unique IF NOT EXISTS FOR (cl:Club) REQUIRE cl.clubId IS UNIQUE`
    },
    {
      name: 'event_id_unique',
      label: 'Event',
      property: 'eventId',
      cypher: `CREATE CONSTRAINT event_id_unique IF NOT EXISTS FOR (e:Event) REQUIRE e.eventId IS UNIQUE`
    },
    {
      name: 'interest_name_unique',
      label: 'Interest',
      property: 'name',
      cypher: `CREATE CONSTRAINT interest_name_unique IF NOT EXISTS FOR (i:Interest) REQUIRE i.name IS UNIQUE`
    },
    {
      name: 'department_name_unique',
      label: 'Department',
      property: 'name',
      cypher: `CREATE CONSTRAINT department_name_unique IF NOT EXISTS FOR (d:Department) REQUIRE d.name IS UNIQUE`
    },
    {
      name: 'message_id_unique',
      label: 'Message',
      property: 'messageId',
      cypher: `CREATE CONSTRAINT message_id_unique IF NOT EXISTS FOR (m:Message) REQUIRE m.messageId IS UNIQUE`
    },
    {
      name: 'message_report_key_unique',
      label: 'MessageReport',
      property: 'reportKey',
      cypher: `CREATE CONSTRAINT message_report_key_unique IF NOT EXISTS FOR (r:MessageReport) REQUIRE r.reportKey IS UNIQUE`
    }
  ],
  indexes: [
    {
      name: 'student_department_idx',
      label: 'Student',
      property: 'department',
      cypher: `CREATE INDEX student_department_idx IF NOT EXISTS FOR (s:Student) ON (s.department)`
    },
    {
      name: 'student_year_idx',
      label: 'Student',
      property: 'yearOfStudy',
      cypher: `CREATE INDEX student_year_idx IF NOT EXISTS FOR (s:Student) ON (s.yearOfStudy)`
    },
    {
      name: 'student_name_idx',
      label: 'Student',
      property: 'name',
      cypher: `CREATE INDEX student_name_idx IF NOT EXISTS FOR (s:Student) ON (s.name)`
    },
    {
      name: 'course_dept_idx',
      label: 'Course',
      property: 'department',
      cypher: `CREATE INDEX course_dept_idx IF NOT EXISTS FOR (c:Course) ON (c.department)`
    },
    {
      name: 'event_date_idx',
      label: 'Event',
      property: 'date',
      cypher: `CREATE INDEX event_date_idx IF NOT EXISTS FOR (e:Event) ON (e.date)`
    }
  ]
};

/**
 * Initializes and validates all constraints and indexes in the Neo4j database.
 */
export const initializeSchema = async () => {
  const session = getSession();
  const results = {
    constraintsApplied: [],
    indexesApplied: [],
    errors: []
  };

  try {
    // 1. Create uniqueness constraints
    for (const constraint of SCHEMA_DEFINITIONS.constraints) {
      try {
        await session.run(constraint.cypher);
        results.constraintsApplied.push({
          name: constraint.name,
          label: constraint.label,
          property: constraint.property,
          status: 'applied_or_verified'
        });
      } catch (err) {
        results.errors.push({
          target: constraint.name,
          type: 'constraint',
          error: err.message
        });
      }
    }

    // 2. Create indexes
    for (const index of SCHEMA_DEFINITIONS.indexes) {
      try {
        await session.run(index.cypher);
        results.indexesApplied.push({
          name: index.name,
          label: index.label,
          property: index.property,
          status: 'applied_or_verified'
        });
      } catch (err) {
        results.errors.push({
          target: index.name,
          type: 'index',
          error: err.message
        });
      }
    }

    await synchronizeDepartmentRelationships(session);
    return results;
  } finally {
    await session.close();
  }
};

export const synchronizeDepartmentRelationships = async (session) => {
  await session.run(`
    MATCH (:Student)-[r:BELONGS_TO]->(:Department)
    DELETE r
  `);
  await session.run(`
    MATCH (:Course)-[r:OFFERED_BY]->(:Department)
    DELETE r
  `);
  await session.run(`
    MATCH (s:Student)
    WHERE s.department IS NOT NULL AND trim(s.department) <> ''
    WITH s, trim(s.department) AS name
    MERGE (d:Department {name: name})
    MERGE (s)-[:BELONGS_TO]->(d)
  `);
  await session.run(`
    MATCH (c:Course)
    WHERE c.department IS NOT NULL AND trim(c.department) <> ''
    WITH c, trim(c.department) AS name
    MERGE (d:Department {name: name})
    MERGE (c)-[:OFFERED_BY]->(d)
  `);
};

/**
 * Returns current database schema summary:
 * - List of active constraints
 * - List of active indexes
 * - Node counts by label
 * - Relationship counts by type
 */
export const getSchemaStatus = async () => {
  const session = getSession();
  try {
    // Fetch constraints
    let constraints = [];
    try {
      const constraintRes = await session.run('SHOW CONSTRAINTS');
      constraints = constraintRes.records.map(r => ({
        name: r.get('name'),
        type: r.get('type'),
        entityType: r.get('entityType'),
        labelsOrTypes: r.get('labelsOrTypes'),
        properties: r.get('properties')
      }));
    } catch {
      // Fallback if SHOW CONSTRAINTS is restricted or older
    }

    // Fetch indexes
    let indexes = [];
    try {
      const indexRes = await session.run('SHOW INDEXES');
      indexes = indexRes.records.map(r => ({
        name: r.get('name'),
        type: r.get('type'),
        entityType: r.get('entityType'),
        labelsOrTypes: r.get('labelsOrTypes'),
        properties: r.get('properties'),
        state: r.get('state')
      }));
    } catch {
      // Fallback
    }

    // Fetch Node Counts by Label
    const nodeCounts = {};
    const labels = ['Student', 'Course', 'Department', 'Club', 'Event', 'Interest', 'Message', 'MessageReport'];
    for (const label of labels) {
      try {
        const countRes = await session.run(`MATCH (n:\`${label}\`) RETURN count(n) AS total`);
        nodeCounts[label] = countRes.records[0].get('total');
      } catch {
        nodeCounts[label] = 0;
      }
    }

    // Fetch Relationship Counts by Type
    const relCounts = {};
    const relTypes = ['STUDIES', 'FRIENDS_WITH', 'PENDING_FRIEND_REQUEST', 'FOLLOWS', 'MEMBER_OF', 'PARTICIPATES_IN', 'HAS_INTEREST', 'BELONGS_TO', 'OFFERED_BY', 'SENT_MESSAGE', 'MESSAGE_TO', 'SUBMITTED_REPORT', 'ABOUT_MESSAGE', 'REPORTS_STUDENT'];
    for (const rel of relTypes) {
      try {
        const countRes = await session.run(`MATCH ()-[r:\`${rel}\`]->() RETURN count(r) AS total`);
        relCounts[rel] = countRes.records[0].get('total');
      } catch {
        relCounts[rel] = 0;
      }
    }

    return {
      success: true,
      constraints,
      indexes,
      nodeCounts,
      relCounts,
      schemaBlueprint: {
        nodeTypes: labels,
        relationshipTypes: [
          { type: 'BELONGS_TO', from: 'Student', to: 'Department' },
          { type: 'OFFERED_BY', from: 'Course', to: 'Department' },
          { type: 'STUDIES', from: 'Student', to: 'Course' },
          { type: 'FRIENDS_WITH', from: 'Student', to: 'Student' },
          { type: 'PENDING_FRIEND_REQUEST', from: 'Student', to: 'Student' },
          { type: 'FOLLOWS', from: 'Student', to: 'Student' },
          { type: 'SENT_MESSAGE', from: 'Student', to: 'Message' },
          { type: 'MESSAGE_TO', from: 'Message', to: 'Student' },
          { type: 'SUBMITTED_REPORT', from: 'Student', to: 'MessageReport' },
          { type: 'ABOUT_MESSAGE', from: 'MessageReport', to: 'Message' },
          { type: 'REPORTS_STUDENT', from: 'MessageReport', to: 'Student' },
          { type: 'MEMBER_OF', from: 'Student', to: 'Club' },
          { type: 'PARTICIPATES_IN', from: 'Student', to: 'Event' },
          { type: 'HAS_INTEREST', from: 'Student', to: 'Interest' }
        ]
      }
    };
  } finally {
    await session.close();
  }
};

