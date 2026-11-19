/**
 * =============================================================================
 * CampusGraph - Week 3 Social Networking & Relationship Management Tests
 * =============================================================================
 * Covers:
 *   1.  Unauthenticated access blocks
 *   2.  Friend Request: self-request, duplicate, auth guards, lifecycle
 *   3.  Following: self-follow, duplicate follow, unfollow
 *   4.  Clubs: join, duplicate, leave, member listing
 *   5.  Courses: enroll, duplicate, drop, classmate listing
 *   6.  Events: create (validation), register, duplicate, cancel, participants
 *   7.  Request lists (incoming / outgoing)
 *   8.  Relationship status endpoint
 *
 * Tests that only need JWT validation pass without Neo4j.
 * Tests that query Neo4j are skipped gracefully when the DB is offline.
 * =============================================================================
 */

import { EventEmitter } from 'events';
import app from '../app.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET =
  process.env.JWT_SECRET || 'campusgraph_super_secret_jwt_key_2026_academic_project';

// ---------------------------------------------------------------------------
// Minimal in-process HTTP mock (no real network, body parsing via req.body)
// ---------------------------------------------------------------------------
const mockRequest = ({ method = 'GET', url = '/', headers = {}, body = null }) => {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = url;
    req.headers = { 'content-type': 'application/json', ...headers };
    req.connection = {};
    req.socket = {};

    if (body !== null) req.body = body;

    let responseStatus = 200;
    const responseHeaders = {};

    const res = new EventEmitter();
    res.statusCode = 200;

    res.status  = function (code) { this.statusCode = code; responseStatus = code; return this; };
    res.setHeader = (n, v) => { responseHeaders[n.toLowerCase()] = v; };
    res.removeHeader = (n) => { delete responseHeaders[n.toLowerCase()]; };
    res.getHeader  = (n) => responseHeaders[n.toLowerCase()];

    const done = (b) => resolve({ statusCode: responseStatus, body: b, headers: responseHeaders });

    res.json = function (obj)  { done(obj); };
    res.send = function (data) { try { done(JSON.parse(data)); } catch { done(data); } };
    res.end  = function (data) { done(data || ''); };

    app.handle(req, res);

    if (body !== null) {
      const str = typeof body === 'string' ? body : JSON.stringify(body);
      req.emit('data', Buffer.from(str));
    }
    req.emit('end');
  });
};

// ---------------------------------------------------------------------------
// Test runner helpers
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
let skipped = 0;

/**
 * Returns true when the response indicates Neo4j is unreachable.
 */
const isOffline = (body) =>
  body?.code === 'ServiceUnavailable' ||
  body?.error === 'Database Service Unavailable';

const assert = (condition, title, details = '') => {
  if (condition) {
    console.log(` ✅  PASS: ${title}`);
    passed++;
  } else {
    console.error(` ❌  FAIL: ${title}`);
    if (details) console.error('     →', JSON.stringify(details, null, 2));
    failed++;
  }
};

/**
 * Like assert, but counts as SKIP instead of FAIL when any response body
 * indicates Neo4j is offline.  Pass an array of bodies to check.
 */
const assertOrSkip = (bodies, condition, title, details = '') => {
  if ([].concat(bodies).some(isOffline)) {
    console.log(` ⏭   SKIP: ${title} (Neo4j offline)`);
    skipped++;
    return;
  }
  assert(condition, title, details);
};

const section = (name) => {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(` ${name}`);
  console.log('─'.repeat(70));
};

// ---------------------------------------------------------------------------
// JWT tokens
// ---------------------------------------------------------------------------
const tokenA = jwt.sign(
  { studentId: 'STU2026001', email: 'aarav.sharma@campus.edu', role: 'student' },
  JWT_SECRET, { expiresIn: '1h' }
);
const tokenC = jwt.sign(
  { studentId: 'STU2026004', email: 'ananya.deshmukh@campus.edu', role: 'student' },
  JWT_SECRET, { expiresIn: '1h' }
);

const authA = { authorization: `Bearer ${tokenA}` };
const authC = { authorization: `Bearer ${tokenC}` };

// ---------------------------------------------------------------------------
const runTests = async () => {
  console.log('===============================================================');
  console.log('  CampusGraph  –  Week 3  Social Relationship Tests           ');
  console.log('===============================================================');

  // =========================================================================
  // 1. UNAUTHENTICATED ACCESS
  // =========================================================================
  section('1. Unauthenticated Access Checks (no Neo4j needed)');

  const unauth = [
    { method: 'POST',   url: '/api/relationships/friend-requests',           label: 'Send friend request (no token)' },
    { method: 'GET',    url: '/api/relationships/friend-requests/incoming',   label: 'Get incoming requests (no token)' },
    { method: 'GET',    url: '/api/relationships/friends',                    label: 'Get friends list (no token)' },
    { method: 'POST',   url: '/api/relationships/follow/STU2026002',          label: 'Follow student (no token)' },
    { method: 'DELETE', url: '/api/relationships/follow/STU2026002',          label: 'Unfollow (no token)' },
    { method: 'DELETE', url: '/api/relationships/friends/STU2026002',         label: 'Remove friend (no token)' },
    { method: 'POST',   url: '/api/clubs/CLUB_ACM/join',                      label: 'Join club (no token)' },
    { method: 'POST',   url: '/api/courses/CS302/enroll',                     label: 'Enroll course (no token)' },
    { method: 'POST',   url: '/api/events',                                   label: 'Create event (no token)' },
    { method: 'POST',   url: '/api/events/EVT_HACK26/register',               label: 'Register event (no token)' },
    { method: 'POST',   url: '/api/events/EVT_HACK26/cancel',                 label: 'Cancel event (no token)' },
  ];

  for (const r of unauth) {
    const res = await mockRequest({ method: r.method, url: r.url });
    assert(res.statusCode === 401, r.label, res.body);
  }

  // =========================================================================
  // 2. FRIEND REQUEST – SELF-REQUEST (no Neo4j needed)
  // =========================================================================
  section('2. Friend Request – Self-Request Prevention');

  const selfReq = await mockRequest({
    method: 'POST', url: '/api/relationships/friend-requests',
    headers: authA, body: { targetStudentId: 'STU2026001' }
  });
  assert(
    selfReq.statusCode === 400 && selfReq.body.message?.includes('yourself'),
    'Blocks sending friend request to yourself (400)',
    selfReq.body
  );

  // =========================================================================
  // 3. FRIEND REQUEST – MISSING BODY (no Neo4j needed)
  // =========================================================================
  section('3. Friend Request – Validation');

  const missingTarget = await mockRequest({
    method: 'POST', url: '/api/relationships/friend-requests',
    headers: authA, body: {}
  });
  assert(
    missingTarget.statusCode === 400,
    'Rejects friend request missing targetStudentId (400)',
    missingTarget.body
  );

  // =========================================================================
  // 4. FOLLOW – SELF-FOLLOW (no Neo4j needed)
  // =========================================================================
  section('4. Follow System – Self-Follow Prevention');

  const selfFollow = await mockRequest({
    method: 'POST', url: '/api/relationships/follow/STU2026001',
    headers: authA
  });
  assert(
    selfFollow.statusCode === 400 && selfFollow.body.message?.includes('yourself'),
    'Blocks following yourself (400)',
    selfFollow.body
  );

  // =========================================================================
  // 5. EVENT CREATION – FIELD VALIDATION (no Neo4j needed for 400 check)
  // =========================================================================
  section('5. Event Creation – Field Validation');

  const badCreate = await mockRequest({
    method: 'POST', url: '/api/events',
    headers: authA, body: { description: 'No title/date/location' }
  });
  assert(
    badCreate.statusCode === 400,
    'Create event missing required fields returns 400',
    badCreate.body
  );

  // =========================================================================
  // 6. FRIEND REQUEST – TARGET NOT FOUND (requires Neo4j)
  // =========================================================================
  section('6. Friend Request – Target Not Found');

  const noTarget = await mockRequest({
    method: 'POST', url: '/api/relationships/friend-requests',
    headers: authA, body: { targetStudentId: 'GHOST_9999' }
  });
  assertOrSkip(
    [noTarget.body],
    noTarget.statusCode === 404,
    'Returns 404 when target student does not exist',
    noTarget.body
  );

  // =========================================================================
  // 7. FRIEND REQUEST LIFECYCLE (requires Neo4j)
  // =========================================================================
  section('7. Friend Request Lifecycle');

  // C sends request to STU2026003
  const send1 = await mockRequest({
    method: 'POST', url: '/api/relationships/friend-requests',
    headers: authC, body: { targetStudentId: 'STU2026003' }
  });
  assertOrSkip(
    [send1.body],
    send1.statusCode === 201 || send1.statusCode === 400,
    'Send friend request succeeds (201) or notes existing relationship (400)',
    send1.body
  );

  // Duplicate send
  const send2 = await mockRequest({
    method: 'POST', url: '/api/relationships/friend-requests',
    headers: authC, body: { targetStudentId: 'STU2026003' }
  });
  assertOrSkip(
    [send2.body],
    send2.statusCode === 400,
    'Duplicate friend request blocked (400)',
    send2.body
  );

  // =========================================================================
  // 8. AUTHORIZATION – WRONG USER CANNOT ACCEPT ANOTHER'S REQUEST
  // =========================================================================
  section('8. Authorization – Cannot Accept Another Student\'s Request');

  const wrongAccept = await mockRequest({
    method: 'POST', url: '/api/relationships/friend-requests/STU2026003/accept',
    headers: authA   // STU2026001 is not the receiver of a STU2026003 request
  });
  assertOrSkip(
    [wrongAccept.body],
    wrongAccept.statusCode === 404 || wrongAccept.statusCode === 400,
    'Unauthorized accept attempt returns 404 (no request found for wrong user)',
    wrongAccept.body
  );

  // =========================================================================
  // 9. AUTHORIZATION – WRONG USER CANNOT REJECT ANOTHER'S REQUEST
  // =========================================================================
  section('9. Authorization – Cannot Reject Another Student\'s Request');

  const wrongReject = await mockRequest({
    method: 'POST', url: '/api/relationships/friend-requests/STU2026003/reject',
    headers: authA
  });
  assertOrSkip(
    [wrongReject.body],
    wrongReject.statusCode === 404 || wrongReject.statusCode === 400,
    'Unauthorized reject attempt returns 404 (no request found for wrong user)',
    wrongReject.body
  );

  // =========================================================================
  // 10. CANCEL – NON-EXISTENT REQUEST
  // =========================================================================
  section('10. Cancel Friend Request – Non-existent Request');

  const badCancel = await mockRequest({
    method: 'DELETE', url: '/api/relationships/friend-requests/GHOST_9999',
    headers: authA
  });
  assertOrSkip(
    [badCancel.body],
    badCancel.statusCode === 404,
    'Cancel non-existent outgoing request returns 404',
    badCancel.body
  );

  // =========================================================================
  // 11. RELATIONSHIP STATUS
  // =========================================================================
  section('11. Relationship Status Endpoint');

  const statusCheck = await mockRequest({
    method: 'GET', url: '/api/relationships/status/STU2026002',
    headers: authA
  });
  assertOrSkip(
    [statusCheck.body],
    statusCheck.statusCode === 200 && statusCheck.body.data !== undefined,
    'Returns 200 with relationship status object',
    statusCheck.body
  );

  const selfStatus = await mockRequest({
    method: 'GET', url: '/api/relationships/status/STU2026001',
    headers: authA
  });
  assertOrSkip(
    [selfStatus.body],
    selfStatus.statusCode === 200 && selfStatus.body.data?.isSelf === true,
    'Self-status returns isSelf: true',
    selfStatus.body
  );

  // =========================================================================
  // 12. FRIENDS LIST
  // =========================================================================
  section('12. Friends List');

  const friendsList = await mockRequest({
    method: 'GET', url: '/api/relationships/friends',
    headers: authA
  });
  assertOrSkip(
    [friendsList.body],
    friendsList.statusCode === 200 && Array.isArray(friendsList.body.data),
    'GET /relationships/friends returns array (200)',
    friendsList.body
  );

  const friendsListById = await mockRequest({
    method: 'GET', url: '/api/relationships/friends/STU2026002',
    headers: authA
  });
  assertOrSkip(
    [friendsListById.body],
    friendsListById.statusCode === 200 && Array.isArray(friendsListById.body.data),
    'GET /relationships/friends/:studentId returns array (200)',
    friendsListById.body
  );

  // =========================================================================
  // 13. FOLLOWING SYSTEM
  // =========================================================================
  section('13. Following System');

  const followRes = await mockRequest({
    method: 'POST', url: '/api/relationships/follow/STU2026003',
    headers: authA
  });
  assertOrSkip(
    [followRes.body],
    followRes.statusCode === 201 || followRes.statusCode === 400,
    'Follow student → 201 (new FOLLOWS) or 400 (already following)',
    followRes.body
  );

  // Duplicate follow
  const followDup = await mockRequest({
    method: 'POST', url: '/api/relationships/follow/STU2026003',
    headers: authA
  });
  assertOrSkip(
    [followDup.body],
    followDup.statusCode === 400,
    'Duplicate follow blocked (400)',
    followDup.body
  );

  const followersList = await mockRequest({
    method: 'GET', url: '/api/relationships/followers',
    headers: authA
  });
  assertOrSkip(
    [followersList.body],
    followersList.statusCode === 200 && Array.isArray(followersList.body.data),
    'GET /relationships/followers returns array (200)',
    followersList.body
  );

  const followingList = await mockRequest({
    method: 'GET', url: '/api/relationships/following',
    headers: authA
  });
  assertOrSkip(
    [followingList.body],
    followingList.statusCode === 200 && Array.isArray(followingList.body.data),
    'GET /relationships/following returns array (200)',
    followingList.body
  );

  // Unfollow non-followed student
  const badUnfollow = await mockRequest({
    method: 'DELETE', url: '/api/relationships/follow/GHOST_9999',
    headers: authA
  });
  assertOrSkip(
    [badUnfollow.body],
    badUnfollow.statusCode === 404,
    'Unfollow non-followed/non-existent student returns 404',
    badUnfollow.body
  );

  // =========================================================================
  // 14. REMOVE FRIEND – NOT A FRIEND
  // =========================================================================
  section('14. Remove Friend – Not Connected');

  const badUnfriend = await mockRequest({
    method: 'DELETE', url: '/api/relationships/friends/GHOST_9999',
    headers: authA
  });
  assertOrSkip(
    [badUnfriend.body],
    badUnfriend.statusCode === 404,
    'Remove non-friend returns 404',
    badUnfriend.body
  );

  // =========================================================================
  // 15. CLUBS
  // =========================================================================
  section('15. Clubs – Join, Duplicate Join, Leave, Members');

  const clubsList = await mockRequest({ method: 'GET', url: '/api/clubs' });
  assertOrSkip(
    [clubsList.body],
    clubsList.statusCode === 200 && Array.isArray(clubsList.body.data),
    'GET /clubs returns array of club objects (200)',
    clubsList.body
  );

  const joinClub = await mockRequest({
    method: 'POST', url: '/api/clubs/CLUB_CYB/join',
    headers: authA, body: { role: 'Member' }
  });
  assertOrSkip(
    [joinClub.body],
    joinClub.statusCode === 201 || joinClub.statusCode === 400,
    'Join club → 201 (new MEMBER_OF) or 400 (already member)',
    joinClub.body
  );

  const joinDup = await mockRequest({
    method: 'POST', url: '/api/clubs/CLUB_CYB/join',
    headers: authA, body: { role: 'Member' }
  });
  assertOrSkip(
    [joinDup.body],
    joinDup.statusCode === 400,
    'Duplicate club join blocked (400)',
    joinDup.body
  );

  const joinBad = await mockRequest({
    method: 'POST', url: '/api/clubs/CLUB_GHOST/join',
    headers: authA, body: {}
  });
  assertOrSkip(
    [joinBad.body],
    joinBad.statusCode === 404,
    'Join non-existent club returns 404',
    joinBad.body
  );

  const leaveClub = await mockRequest({
    method: 'POST', url: '/api/clubs/CLUB_CYB/leave',
    headers: authA
  });
  assertOrSkip(
    [leaveClub.body],
    leaveClub.statusCode === 200 || leaveClub.statusCode === 404,
    'Leave club → 200 (deleted MEMBER_OF) or 404 (not member)',
    leaveClub.body
  );

  const leaveAgain = await mockRequest({
    method: 'POST', url: '/api/clubs/CLUB_CYB/leave',
    headers: authA
  });
  assertOrSkip(
    [leaveAgain.body],
    leaveAgain.statusCode === 404,
    'Leave club when not a member returns 404',
    leaveAgain.body
  );

  const clubMembers = await mockRequest({
    method: 'GET', url: '/api/clubs/CLUB_ACM/members', headers: authA
  });
  assertOrSkip(
    [clubMembers.body],
    clubMembers.statusCode === 200 && Array.isArray(clubMembers.body.data),
    'GET /clubs/:clubId/members returns array (200)',
    clubMembers.body
  );

  // =========================================================================
  // 16. COURSES
  // =========================================================================
  section('16. Courses – Enroll, Duplicate Enroll, Drop, Classmates');

  const coursesList = await mockRequest({ method: 'GET', url: '/api/courses' });
  assertOrSkip(
    [coursesList.body],
    coursesList.statusCode === 200 && Array.isArray(coursesList.body.data),
    'GET /courses returns array of course objects (200)',
    coursesList.body
  );

  const enroll = await mockRequest({
    method: 'POST', url: '/api/courses/CS101/enroll',
    headers: authA, body: { semester: 'Fall 2026' }
  });
  assertOrSkip(
    [enroll.body],
    enroll.statusCode === 201 || enroll.statusCode === 400,
    'Enroll course → 201 (new STUDIES) or 400 (already enrolled)',
    enroll.body
  );

  const enrollDup = await mockRequest({
    method: 'POST', url: '/api/courses/CS101/enroll',
    headers: authA, body: { semester: 'Fall 2026' }
  });
  assertOrSkip(
    [enrollDup.body],
    enrollDup.statusCode === 400,
    'Duplicate enrollment blocked (400)',
    enrollDup.body
  );

  const enrollBad = await mockRequest({
    method: 'POST', url: '/api/courses/XX999/enroll',
    headers: authA, body: {}
  });
  assertOrSkip(
    [enrollBad.body],
    enrollBad.statusCode === 404,
    'Enroll in non-existent course returns 404',
    enrollBad.body
  );

  const drop = await mockRequest({
    method: 'POST', url: '/api/courses/CS101/drop', headers: authA
  });
  assertOrSkip(
    [drop.body],
    drop.statusCode === 200 || drop.statusCode === 404,
    'Drop course → 200 (deleted STUDIES) or 404 (not enrolled)',
    drop.body
  );

  const dropAgain = await mockRequest({
    method: 'POST', url: '/api/courses/CS101/drop', headers: authA
  });
  assertOrSkip(
    [dropAgain.body],
    dropAgain.statusCode === 404,
    'Drop course when not enrolled returns 404',
    dropAgain.body
  );

  const courseStudents = await mockRequest({
    method: 'GET', url: '/api/courses/CS302/students', headers: authA
  });
  assertOrSkip(
    [courseStudents.body],
    courseStudents.statusCode === 200 && Array.isArray(courseStudents.body.data),
    'GET /courses/:courseCode/students returns array (200)',
    courseStudents.body
  );

  // =========================================================================
  // 17. EVENTS
  // =========================================================================
  section('17. Events – Create, Register, Duplicate, Cancel, Participants');

  const eventsList = await mockRequest({ method: 'GET', url: '/api/events' });
  assertOrSkip(
    [eventsList.body],
    eventsList.statusCode === 200 && Array.isArray(eventsList.body.data),
    'GET /events returns array of event objects (200)',
    eventsList.body
  );

  // Valid event creation
  const newEvent = await mockRequest({
    method: 'POST', url: '/api/events',
    headers: authA,
    body: { title: 'Test Event ' + Date.now(), date: '2026-12-31', location: 'Test Hall', description: 'Week 3 test event' }
  });
  assertOrSkip(
    [newEvent.body],
    newEvent.statusCode === 201,
    'Create event with valid data returns 201 and event node',
    newEvent.body
  );

  const regEvent = await mockRequest({
    method: 'POST', url: '/api/events/EVT_CYBER_CTF/register', headers: authA
  });
  assertOrSkip(
    [regEvent.body],
    regEvent.statusCode === 201 || regEvent.statusCode === 400,
    'Register for event → 201 (new PARTICIPATES_IN) or 400 (already registered)',
    regEvent.body
  );

  const regDup = await mockRequest({
    method: 'POST', url: '/api/events/EVT_CYBER_CTF/register', headers: authA
  });
  assertOrSkip(
    [regDup.body],
    regDup.statusCode === 400,
    'Duplicate event registration blocked (400)',
    regDup.body
  );

  const regBad = await mockRequest({
    method: 'POST', url: '/api/events/EVT_GHOST/register', headers: authA
  });
  assertOrSkip(
    [regBad.body],
    regBad.statusCode === 404,
    'Register for non-existent event returns 404',
    regBad.body
  );

  const cancelReg = await mockRequest({
    method: 'POST', url: '/api/events/EVT_CYBER_CTF/cancel', headers: authA
  });
  assertOrSkip(
    [cancelReg.body],
    cancelReg.statusCode === 200 || cancelReg.statusCode === 404,
    'Cancel event registration → 200 (deleted PARTICIPATES_IN) or 404 (not registered)',
    cancelReg.body
  );

  const cancelAgain = await mockRequest({
    method: 'POST', url: '/api/events/EVT_CYBER_CTF/cancel', headers: authA
  });
  assertOrSkip(
    [cancelAgain.body],
    cancelAgain.statusCode === 404,
    'Cancel registration when not registered returns 404',
    cancelAgain.body
  );

  const participants = await mockRequest({
    method: 'GET', url: '/api/events/EVT_HACK26/participants', headers: authA
  });
  assertOrSkip(
    [participants.body],
    participants.statusCode === 200 && Array.isArray(participants.body.data),
    'GET /events/:eventId/participants returns array (200)',
    participants.body
  );

  // =========================================================================
  // 18. INCOMING / OUTGOING REQUEST LISTS
  // =========================================================================
  section('18. Incoming & Outgoing Request Lists');

  const incoming = await mockRequest({
    method: 'GET', url: '/api/relationships/friend-requests/incoming', headers: authA
  });
  assertOrSkip(
    [incoming.body],
    incoming.statusCode === 200 && Array.isArray(incoming.body.data),
    'GET /friend-requests/incoming returns array (200)',
    incoming.body
  );

  const outgoing = await mockRequest({
    method: 'GET', url: '/api/relationships/friend-requests/outgoing', headers: authA
  });
  assertOrSkip(
    [outgoing.body],
    outgoing.statusCode === 200 && Array.isArray(outgoing.body.data),
    'GET /friend-requests/outgoing returns array (200)',
    outgoing.body
  );

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n===============================================================');
  console.log(`  Results:  ${passed} Passed   ${failed} Failed   ${skipped} Skipped (Neo4j offline)`);
  console.log(`  Total tests run: ${passed + failed + skipped}`);
  console.log('===============================================================');

  if (failed > 0) process.exit(1);
  process.exit(0);
};

runTests().catch((err) => {
  console.error('[Test Runner] Fatal error:', err);
  process.exit(1);
});
