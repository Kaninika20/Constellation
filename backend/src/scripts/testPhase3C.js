/**
 * =============================================================================
 * Constellation - Phase 3C Course, Club & Interest Management Tests
 * =============================================================================
 * Verifies STUDIES / MEMBER_OF / HAS_INTEREST management through the real
 * Express API against a live Neo4j instance:
 *   1.  Enrollment + duplicate prevention + drop + drop-again
 *   2.  Club join + duplicate prevention + leave + leave-again
 *   3.  Course & club search
 *   4.  Course & club details (node + members/enrolled)
 *   5.  "My Courses" / "My Clubs"
 *   6.  Interests: search, popular, students-sharing, no duplicate Interest nodes
 *   7.  Authorization: admin-only record creation; students manage own enrollments;
 *       unauthorized access blocked
 *
 * Run with: node src/scripts/testPhase3C.js
 * =============================================================================
 */
import { EventEmitter } from 'events';
import app from '../app.js';
import jwt from 'jsonwebtoken';
import { getSession, closeDriver } from '../config/neo4j.config.js';

const JWT_SECRET = process.env.JWT_SECRET || 'campusgraph_super_secret_jwt_key_2026_academic_project';

const mockRequest = ({ method = 'GET', url = '/', headers = {}, body = null }) =>
  new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = method; req.url = url;
    req.headers = { 'content-type': 'application/json', ...headers };
    req.connection = {}; req.socket = {};
    if (body !== null) req.body = body;
    let status = 200; const res = new EventEmitter();
    res.statusCode = 200;
    res.status = function (c) { this.statusCode = c; status = c; return this; };
    res.setHeader = () => {}; res.removeHeader = () => {}; res.getHeader = () => undefined;
    const done = (b) => resolve({ statusCode: status, body: b });
    res.json = function (o) { done(o); };
    res.send = function (d) { try { done(JSON.parse(d)); } catch { done(d); } };
    res.end = function (d) { done(d || ''); };
    app.handle(req, res);
    if (body !== null) req.emit('data', Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)));
    req.emit('end');
  });

let passed = 0, failed = 0;
const failures = [];
const assert = (cond, title, details = '') => {
  if (cond) { console.log(`  PASS: ${title}`); passed++; }
  else { console.error(`  FAIL: ${title}`); if (details) console.error(`        -> ${details}`); failures.push(title); failed++; }
};

const tokenFor = (studentId, email, role = 'student') =>
  jwt.sign({ studentId, email, role }, JWT_SECRET, { expiresIn: '1h' });

const A = { id: 'STU2026001', email: 'aarav.sharma@campus.edu' };
const authA = { authorization: `Bearer ${tokenFor(A.id, A.email, 'student')}` };
const adminToken = { authorization: `Bearer ${tokenFor('STU2026001', 'admin@campus.edu', 'admin')}` };
let originalRole;

const setAccountRole = async role => {
  const session = getSession();
  try {
    await session.run(
      'MATCH (s:Student {studentId: $studentId}) SET s.role = $role',
      { studentId: A.id, role }
    );
  } finally {
    await session.close();
  }
};

// Reset A's enrollments/memberships to seed + remove leftover test nodes
const resetState = async () => {
  const session = getSession();
  try {
    await session.run(`MATCH (s:Student {studentId:'STU2026001'})-[r:STUDIES]->() DELETE r`);
    await session.run(`MATCH (s:Student {studentId:'STU2026001'})-[r:MEMBER_OF]->() DELETE r`);
    for (const cc of ['CS302', 'DS201']) {
      await session.run(
        `MATCH (s:Student {studentId:'STU2026001'}),(c:Course {courseCode:$cc}) MERGE (s)-[:STUDIES {semester:'Fall 2026', enrolledAt: datetime()}]->(c)`,
        { cc }
      );
    }
    await session.run(
      `MATCH (s:Student {studentId:'STU2026001'}),(cl:Club {clubId:'CLUB_ACM'}) MERGE (s)-[:MEMBER_OF {role:'Vice Lead', joinedDate: datetime()}]->(cl)`
    );
    await session.run(`MATCH (c:Course {courseCode:'TEST999'}) DETACH DELETE c`);
    await session.run(`MATCH (cl:Club {clubId:'CLUB_TEST999'}) DETACH DELETE cl`);
  } finally {
    await session.close();
  }
};

const countNodes = async (label, prop, value) => {
  const session = getSession();
  try {
    const res = await session.run(
      `MATCH (n:${label} {${prop}: $value}) RETURN count(n) AS c`, { value }
    );
    return res.records[0].get('c');
  } finally { await session.close(); }
};

const runTests = async () => {
  console.log('===============================================================');
  console.log(' Constellation Phase 3C - Course, Club & Interest Management Tests');
  console.log('===============================================================');

  const roleSession = getSession();
  try {
    const roleResult = await roleSession.run(
      'MATCH (s:Student {studentId: $studentId}) RETURN s.role AS role',
      { studentId: A.id }
    );
    originalRole = roleResult.records[0]?.get('role') || 'student';
  } finally {
    await roleSession.close();
  }
  await resetState();
  await setAccountRole('admin');
  console.log('  (reset enrollments/memberships to seed, cleared test nodes)');

  // 1. Unauthorized access ---------------------------------------------------
  console.log('\n-- 1. Unauthorized access (no token) --');
  {
    const cases = [
      { method: 'POST', url: '/api/courses/CS101/enroll' },
      { method: 'POST', url: '/api/courses/CS101/drop' },
      { method: 'GET', url: '/api/courses/enrolled' },
      { method: 'POST', url: '/api/clubs/CLUB_ROBO/join' },
      { method: 'POST', url: '/api/clubs/CLUB_ROBO/leave' },
      { method: 'GET', url: '/api/clubs/joined' },
      { method: 'POST', url: '/api/admin/courses', body: { courseCode: 'X' } },
      { method: 'POST', url: '/api/admin/clubs', body: { clubId: 'X' } }
    ];
    for (const c of cases) {
      const r = await mockRequest({ method: c.method, url: c.url, body: c.body || null });
      assert(r.statusCode === 401, `${c.method} ${c.url} without token -> 401`, JSON.stringify(r.body));
    }
  }

  // 2. Authorization: admin-only record creation -----------------------------
  console.log('\n-- 2. Authorization: admin-only record creation --');
  {
    const studentCreateCourse = await mockRequest({
      method: 'POST', url: '/api/admin/courses',
      headers: authA,
      body: { courseCode: 'NOPE1', courseName: 'Nope', department: 'CS', credits: 3 }
    });
    assert(studentCreateCourse.statusCode === 403,
      'Student cannot create a shared course record (403)', JSON.stringify(studentCreateCourse.body));

    const studentCreateClub = await mockRequest({
      method: 'POST', url: '/api/admin/clubs',
      headers: authA,
      body: { clubId: 'NOPE1', name: 'Nope', category: 'X' }
    });
    assert(studentCreateClub.statusCode === 403,
      'Student cannot create a shared club record (403)', JSON.stringify(studentCreateClub.body));

    // Admin creates a course
    const adminCreate = await mockRequest({
      method: 'POST', url: '/api/admin/courses',
      headers: adminToken,
      body: { courseCode: 'TEST999', courseName: 'Phase 3C Test Course', department: 'Computer Science', credits: 3 }
    });
    assert(adminCreate.statusCode === 201 && adminCreate.body?.data?.courseCode === 'TEST999',
      'Admin creates a course record -> 201', JSON.stringify(adminCreate.body));

    // Re-create same course (MERGE) -> no duplicate node
    const adminRecreate = await mockRequest({
      method: 'POST', url: '/api/admin/courses',
      headers: adminToken,
      body: { courseCode: 'TEST999', courseName: 'Phase 3C Test Course (renamed)', department: 'Computer Science', credits: 3 }
    });
    assert(adminRecreate.statusCode === 201, 'Re-creating an existing course is accepted (MERGE)', JSON.stringify(adminRecreate.body));
    const dupCount = await countNodes('Course', 'courseCode', 'TEST999');
    assert(dupCount === 1, 'No duplicate Course node created (MERGE)', `count=${dupCount}`);

    // Admin creates a club
    const adminClub = await mockRequest({
      method: 'POST', url: '/api/admin/clubs',
      headers: adminToken,
      body: { clubId: 'CLUB_TEST999', name: 'Phase 3C Test Club', description: 'temp', category: 'Technical' }
    });
    assert(adminClub.statusCode === 201 && adminClub.body?.data?.clubId === 'CLUB_TEST999',
      'Admin creates a club record -> 201', JSON.stringify(adminClub.body));
    const clubCount = await countNodes('Club', 'clubId', 'CLUB_TEST999');
    assert(clubCount === 1, 'No duplicate Club node created (MERGE)', `count=${clubCount}`);
  }

  // 3. Course & club search --------------------------------------------------
  console.log('\n-- 3. Course & club search --');
  {
    const dataSearch = await mockRequest({ method: 'GET', url: '/api/courses?search=Data', headers: authA });
    const dataCourses = dataSearch.body?.data || [];
    assert(dataSearch.statusCode === 200 && dataCourses.some((c) => c.courseCode === 'DS201'),
      'Course search "Data" returns the Data Mining course', JSON.stringify(dataCourses.map((c) => c.courseCode)));

    const noneSearch = await mockRequest({ method: 'GET', url: '/api/courses?search=ZZZNOTHING', headers: authA });
    assert(noneSearch.statusCode === 200 && (noneSearch.body?.data || []).length === 0,
      'Course search with no match returns empty list', JSON.stringify(noneSearch.body));

    const roboSearch = await mockRequest({ method: 'GET', url: '/api/clubs?search=Robotics', headers: authA });
    const roboClubs = roboSearch.body?.data || [];
    assert(roboSearch.statusCode === 200 && roboClubs.some((cl) => cl.clubId === 'CLUB_ROBO'),
      'Club search "Robotics" returns the Robotics club', JSON.stringify(roboClubs.map((cl) => cl.clubId)));
  }

  // 4. Course & club details -------------------------------------------------
  console.log('\n-- 4. Course & club details --');
  {
    const courseDetail = await mockRequest({ method: 'GET', url: '/api/courses/CS302', headers: authA });
    assert(courseDetail.statusCode === 200 && courseDetail.body?.data?.courseCode === 'CS302' &&
      Array.isArray(courseDetail.body?.data?.students),
      'Course details return course node + enrolled students', JSON.stringify(courseDetail.body?.data));

    const missingCourse = await mockRequest({ method: 'GET', url: '/api/courses/ZZZNONE', headers: authA });
    assert(missingCourse.statusCode === 404, 'Missing course details -> 404', JSON.stringify(missingCourse.body));

    const clubDetail = await mockRequest({ method: 'GET', url: '/api/clubs/CLUB_ACM', headers: authA });
    assert(clubDetail.statusCode === 200 && clubDetail.body?.data?.clubId === 'CLUB_ACM' &&
      Array.isArray(clubDetail.body?.data?.members),
      'Club details return club node + members', JSON.stringify(clubDetail.body?.data));
  }

  // 5. My Courses / My Clubs -------------------------------------------------
  console.log('\n-- 5. My Courses / My Clubs --');
  {
    const myCourses = await mockRequest({ method: 'GET', url: '/api/courses/enrolled', headers: authA });
    const myCodes = (myCourses.body?.data || []).map((c) => c.courseCode);
    assert(myCourses.statusCode === 200 && myCodes.includes('CS302') && myCodes.includes('DS201'),
      'My Courses returns enrolled courses (CS302, DS201)', JSON.stringify(myCodes));

    const myClubs = await mockRequest({ method: 'GET', url: '/api/clubs/joined', headers: authA });
    const myClubIds = (myClubs.body?.data || []).map((cl) => cl.clubId);
    assert(myClubs.statusCode === 200 && myClubIds.includes('CLUB_ACM'),
      'My Clubs returns joined clubs (CLUB_ACM)', JSON.stringify(myClubIds));
  }

  // 6. Enrollment lifecycle -------------------------------------------------
  console.log('\n-- 6. Enrollment lifecycle (A -> CS101) --');
  {
    const enroll = await mockRequest({ method: 'POST', url: '/api/courses/CS101/enroll', headers: authA, body: { semester: 'Fall 2026' } });
    assert(enroll.statusCode === 201, 'Enroll in a new course -> 201', JSON.stringify(enroll.body));

    const dup = await mockRequest({ method: 'POST', url: '/api/courses/CS101/enroll', headers: authA, body: { semester: 'Fall 2026' } });
    assert(dup.statusCode === 400, 'Duplicate enrollment blocked (400)', JSON.stringify(dup.body));

    const enrolledCheck = await mockRequest({ method: 'GET', url: '/api/courses/enrolled', headers: authA });
    assert((enrolledCheck.body?.data || []).some((c) => c.courseCode === 'CS101'),
      'My Courses now includes CS101', JSON.stringify((enrolledCheck.body?.data || []).map((c) => c.courseCode)));

    const drop = await mockRequest({ method: 'POST', url: '/api/courses/CS101/drop', headers: authA });
    assert(drop.statusCode === 200, 'Drop course -> 200', JSON.stringify(drop.body));

    const dropAgain = await mockRequest({ method: 'POST', url: '/api/courses/CS101/drop', headers: authA });
    assert(dropAgain.statusCode === 404, 'Drop when not enrolled -> 404', JSON.stringify(dropAgain.body));
  }

  // 7. Club membership lifecycle --------------------------------------------
  console.log('\n-- 7. Club membership lifecycle (A -> CLUB_ROBO) --');
  {
    const join = await mockRequest({ method: 'POST', url: '/api/clubs/CLUB_ROBO/join', headers: authA, body: { role: 'Member' } });
    assert(join.statusCode === 201, 'Join a new club -> 201', JSON.stringify(join.body));

    const dup = await mockRequest({ method: 'POST', url: '/api/clubs/CLUB_ROBO/join', headers: authA, body: { role: 'Member' } });
    assert(dup.statusCode === 400, 'Duplicate club join blocked (400)', JSON.stringify(dup.body));

    const joinedCheck = await mockRequest({ method: 'GET', url: '/api/clubs/joined', headers: authA });
    assert((joinedCheck.body?.data || []).some((cl) => cl.clubId === 'CLUB_ROBO'),
      'My Clubs now includes CLUB_ROBO', JSON.stringify((joinedCheck.body?.data || []).map((cl) => cl.clubId)));

    const leave = await mockRequest({ method: 'POST', url: '/api/clubs/CLUB_ROBO/leave', headers: authA });
    assert(leave.statusCode === 200, 'Leave club -> 200', JSON.stringify(leave.body));

    const leaveAgain = await mockRequest({ method: 'POST', url: '/api/clubs/CLUB_ROBO/leave', headers: authA });
    assert(leaveAgain.statusCode === 404, 'Leave when not a member -> 404', JSON.stringify(leaveAgain.body));
  }

  // 8. Interest management ---------------------------------------------------
  console.log('\n-- 8. Interest management --');
  {
    const all = await mockRequest({ method: 'GET', url: '/api/interests', headers: authA });
    assert(all.statusCode === 200 && (all.body?.data || []).length > 0,
      'Browse interests returns a non-empty list', JSON.stringify((all.body?.data || []).map((i) => i.name)));

    const graphSearch = await mockRequest({ method: 'GET', url: '/api/interests?search=Graph', headers: authA });
    const graphHits = graphSearch.body?.data || [];
    assert(graphSearch.statusCode === 200 && graphHits.length === 1 && graphHits[0].name === 'Graph Databases',
      'Interest search "Graph" returns exactly one Graph Databases node (no duplicates)', JSON.stringify(graphHits.map((i) => i.name)));

    const popular = await mockRequest({ method: 'GET', url: '/api/interests/popular', headers: authA });
    const popularList = popular.body?.data || [];
    assert(popular.statusCode === 200 && popularList.length > 0,
      'Popular interests returns a ranked list', JSON.stringify(popularList.map((i) => `${i.name}=${i.studentCount}`)));

    const sharing = await mockRequest({ method: 'GET', url: '/api/interests/Cybersecurity/students', headers: authA });
    const sharingStudents = sharing.body?.data || [];
    assert(sharing.statusCode === 200 && sharingStudents.some((s) => s.student?.studentId === 'STU2026003'),
      'Students sharing "Cybersecurity" includes the Cybersecurity student', JSON.stringify(sharingStudents.map((s) => s.student?.studentId)));
  }

  // -------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(` Phase 3C Summary: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) { console.log(' Failed:'); failures.forEach((f) => console.log(`   - ${f}`)); }
  console.log('===============================================================');

  // Clean up test-created shared records
  await resetState();
  await setAccountRole(originalRole);

  await closeDriver();
  process.exit(failed > 0 ? 1 : 0);
};

runTests().catch(async (err) => {
  console.error('[Test Runner] Fatal error:', err);
  try {
    if (originalRole !== undefined) await setAccountRole(originalRole);
  } finally {
    await closeDriver();
  }
  process.exit(1);
});
