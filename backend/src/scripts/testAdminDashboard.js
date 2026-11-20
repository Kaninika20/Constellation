import { EventEmitter } from 'events';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import { closeDriver, getSession } from '../config/neo4j.config.js';

const JWT_SECRET = process.env.JWT_SECRET || 'campusgraph_super_secret_jwt_key_2026_academic_project';
const testIds = {
  student: 'ADMIN_DASHBOARD_TEST',
  related: 'ADMIN_DASHBOARD_RELATED',
  course: 'ADMIN_DASHBOARD_COURSE',
  club: 'ADMIN_DASHBOARD_CLUB',
  event: 'ADMIN_DASHBOARD_EVENT',
  createdEvent: `ADMIN_DASHBOARD_CREATED_EVENT_${Date.now()}`,
  interest: 'ADMIN_DASHBOARD_INTEREST'
};
let existingRiskState = null;
const token = role => jwt.sign({ studentId: testIds.student, email: `${role}@campus.edu`, role }, JWT_SECRET, { expiresIn: '10m' });

const request = ({ method = 'GET', url, role, body }) => new Promise(resolve => {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = { 'content-type': 'application/json' };
  req.connection = {};
  req.socket = {};
  if (role) req.headers.authorization = `Bearer ${token(role)}`;
  if (body !== undefined) req.body = body;

  let statusCode = 200;
  const res = new EventEmitter();
  res.statusCode = statusCode;
  res.status = function (status) { statusCode = status; this.statusCode = status; return this; };
  res.setHeader = () => {};
  res.removeHeader = () => {};
  res.getHeader = () => undefined;
  const finish = responseBody => resolve({ statusCode, body: responseBody });
  res.json = finish;
  res.send = value => finish(value);
  res.end = value => finish(value);
  app.handle(req, res);
  if (body !== undefined) req.emit('data', Buffer.from(JSON.stringify(body)));
  req.emit('end');
});

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
};

const seedGraph = async () => {
  const session = getSession();
  try {
    await session.run(`
      MERGE (s:Student {studentId: $student})
      SET s.name = 'Dashboard Test Student', s.email = 'dashboard-test@campus.edu',
          s.role = 'student', s.department = 'Test', s.fraudRiskScore = 0.8,
          s.riskScore = 80, s.riskLevel = 'High',
          s.riskIndicatorDetails = '[{"rule":"test_indicator","description":"Synthetic test indicator","points":80}]',
          s.communityId = 'ADMIN_DASHBOARD_TEST'
      MERGE (r:Student {studentId: $related})
      SET r.name = 'Dashboard Related Student', r.department = 'Test'
      MERGE (c:Course {courseCode: $course})
      MERGE (cl:Club {clubId: $club})
      MERGE (e:Event {eventId: $event})
      MERGE (i:Interest {name: $interest})
      MERGE (s)-[:FRIENDS_WITH]->(r)
      MERGE (s)-[:FOLLOWS]->(r)
      MERGE (s)-[:STUDIES]->(c)
      MERGE (s)-[:MEMBER_OF]->(cl)
      MERGE (s)-[:PARTICIPATES_IN]->(e)
      MERGE (s)-[:HAS_INTEREST]->(i)
    `, testIds);
  } finally {
    await session.close();
  }
};

const cleanGraph = async () => {
  const session = getSession();
  try {
    await session.run(`
      MATCH (n)
      WHERE n.studentId IN [$student, $related]
        OR n.courseCode = $course OR n.clubId = $club
        OR n.eventId IN [$event, $createdEvent] OR n.name = $interest
      DETACH DELETE n
    `, testIds);
  } finally {
    await session.close();
  }
};

const restoreRiskState = async () => {
  if (!existingRiskState) return;
  const session = getSession();
  try {
    await session.run(`
      UNWIND $rows AS row
      MATCH (s:Student {studentId: row.studentId})
      SET s.riskScore = row.riskScore,
          s.fraudRiskScore = row.fraudRiskScore,
          s.riskLevel = row.riskLevel,
          s.riskIndicators = row.riskIndicators,
          s.riskIndicatorDetails = row.riskIndicatorDetails,
          s.riskConfiguration = row.riskConfiguration,
          s.riskAnalyzedAt = row.riskAnalyzedAt
    `, { rows: existingRiskState });
  } finally {
    await session.close();
  }
};

const run = async () => {
  try {
    await seedGraph();
    const unauthenticated = await request({ url: '/api/admin/dashboard' });
    assert(unauthenticated.statusCode === 401, 'Dashboard rejects requests without authentication');

    const studentDenied = await request({ url: '/api/admin/dashboard', role: 'student' });
    assert(studentDenied.statusCode === 403, 'Dashboard rejects authenticated non-admins');

    const staleAdminDenied = await request({ url: '/api/admin/dashboard', role: 'admin' });
    assert(staleAdminDenied.statusCode === 403, 'Admin role claims are checked against the current Neo4j account role');
    const staleGraphDenied = await request({ url: '/api/admin/graph', role: 'admin' });
    assert(staleGraphDenied.statusCode === 403, 'Admin graph details require a current Neo4j administrator role');
    const unauthenticatedEventCreate = await request({
      method: 'POST', url: '/api/admin/events',
      body: { title: 'Unauthorized event', date: '2026-12-20', location: 'Test Venue' }
    });
    assert(unauthenticatedEventCreate.statusCode === 401, 'Admin event creation rejects unauthenticated requests');
    const studentEventCreate = await request({
      method: 'POST', url: '/api/admin/events', role: 'student',
      body: { title: 'Unauthorized event', date: '2026-12-20', location: 'Test Venue' }
    });
    assert(studentEventCreate.statusCode === 403, 'Admin event creation rejects non-admin students');
    const roleSession = getSession();
    try {
      await roleSession.run('MATCH (s:Student {studentId: $studentId}) SET s.role = $role', { studentId: testIds.student, role: 'admin' });
    } finally {
      await roleSession.close();
    }

    const dashboard = await request({ url: '/api/admin/dashboard', role: 'admin' });
    assert(dashboard.statusCode === 200 && dashboard.body.data.totalStudents >= 2, 'Admin dashboard returns campus totals');
    assert(dashboard.body.data.riskDistribution.high >= 1 && dashboard.body.data.flaggedAccounts >= 1, 'Dashboard includes flagged risk distribution');
    const createdEvent = await request({
      method: 'POST', url: '/api/admin/events', role: 'admin',
      body: {
        eventId: testIds.createdEvent,
        title: 'Admin Catalog Test Event',
        date: '2026-12-20',
        location: 'Test Venue',
        description: 'Created by the admin catalog integration test.',
        category: 'Workshop'
      }
    });
    assert(
      createdEvent.statusCode === 201 && createdEvent.body.data.category === 'Workshop',
      'Admin can create a categorized campus event'
    );

    const flagged = await request({ url: '/api/admin/flagged', role: 'admin' });
    assert(flagged.statusCode === 200 && flagged.body.data.some(student => student.studentId === testIds.student), 'Flagged-account list includes the synthetic high-risk student');

    const detail = await request({ url: `/api/admin/student/${testIds.student}/risk`, role: 'admin' });
    assert(detail.statusCode === 200 && detail.body.data.relatedAccounts.friends.some(student => student.studentId === testIds.related), 'Investigation detail includes related accounts');

    const review = await request({
      method: 'POST', url: `/api/admin/student/${testIds.student}/review`, role: 'admin',
      body: { notes: 'Synthetic dashboard integration test' }
    });
    assert(review.statusCode === 200, 'Admin can mark an account reviewed with notes');
    const reviewedDetail = await request({ url: `/api/admin/student/${testIds.student}/risk`, role: 'admin' });
    assert(reviewedDetail.body.data.reviewHistory.some(entry => entry.notes === 'Synthetic dashboard integration test'), 'Review note persists in account history');

    const invalidNotes = await request({
      method: 'POST', url: `/api/admin/student/${testIds.student}/review`, role: 'admin',
      body: { notes: 'x'.repeat(2001) }
    });
    assert(invalidNotes.statusCode === 400, 'Review notes are length-validated');

    const graphUnauthenticated = await request({ url: '/api/students/network/overview' });
    assert(graphUnauthenticated.statusCode === 401, 'Graph endpoint rejects unauthenticated requests');
    const studentGraph = await request({ url: '/api/students/network/overview?limit=5000', role: 'student' });
    assert(studentGraph.statusCode === 200, 'Authenticated students can load graph data');
    const studentNode = studentGraph.body.data.elements.nodes.find(node => node.data.id === testIds.student);
    assert(studentNode && studentNode.data.riskLevel === undefined, 'Student graph response does not expose risk details');
    const adminGraph = await request({ url: '/api/admin/graph?limit=5000', role: 'admin' });
    const relationshipTypes = new Set(adminGraph.body.data.elements.edges.map(edge => edge.data.label));
    assert(['FRIENDS_WITH', 'FOLLOWS', 'STUDIES', 'MEMBER_OF', 'PARTICIPATES_IN', 'HAS_INTEREST'].every(type => relationshipTypes.has(type)), 'Admin graph returns all supported relationship types');
    assert(adminGraph.body.data.elements.nodes.find(node => node.data.id === testIds.student)?.data.riskLevel === 'High', 'Admin graph includes risk category for visualization');
    const path = await request({
      url: `/api/fraud/path/${testIds.student}/${testIds.related}`,
      role: 'student'
    });
    assert(path.statusCode === 200 && path.body.data.distance === 1, 'Shortest-path API returns the synthetic direct friendship');

    const snapshotSession = getSession();
    try {
      const snapshot = await snapshotSession.run(`
        MATCH (s:Student)
        RETURN s.studentId AS studentId, s.riskScore AS riskScore,
          s.fraudRiskScore AS fraudRiskScore, s.riskLevel AS riskLevel,
          s.riskIndicators AS riskIndicators, s.riskIndicatorDetails AS riskIndicatorDetails,
          s.riskConfiguration AS riskConfiguration, s.riskAnalyzedAt AS riskAnalyzedAt
      `);
      existingRiskState = snapshot.records.map(record => Object.fromEntries(
        ['studentId', 'riskScore', 'fraudRiskScore', 'riskLevel', 'riskIndicators', 'riskIndicatorDetails', 'riskConfiguration', 'riskAnalyzedAt']
          .map(key => [key, record.get(key)])
      ));
    } finally {
      await snapshotSession.close();
    }
    const analysis = await request({ method: 'POST', url: '/api/admin/analyze', role: 'admin', body: {} });
    assert(analysis.statusCode === 200 && analysis.body.data.analyzed > 0, 'Admin can run risk analysis through the protected API');
  } finally {
    try {
      try {
        await restoreRiskState();
      } finally {
        await cleanGraph();
      }
    } finally {
      await closeDriver();
    }
  }
};

run().catch(async error => {
  console.error(error);
  process.exitCode = 1;
});
