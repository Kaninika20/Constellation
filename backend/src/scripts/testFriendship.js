/**
 * =============================================================================
 * CampusGraph - Phase 3A Friend Request Management Tests
 * =============================================================================
 * Verifies the PENDING_FRIEND_REQUEST + FRIENDS_WITH lifecycle end-to-end
 * through the real Express API against a live Neo4j instance:
 *   1.  Self-request prevention
 *   2.  Successful friend request
 *   3.  Duplicate request blocked
 *   4.  Reciprocal pending request blocked
 *   5.  Accept (transactional: pending removed + FRIENDS_WITH created)
 *   6.  Reject
 *   7.  Unauthorized acceptance (only the receiver can accept)
 *   8.  Sender-only cancel
 *   9.  Removing friendship + only existing friends can remove
 *  10.  Cannot request an existing friend
 *
 * Run with: node src/scripts/testFriendship.js
 * =============================================================================
 */
import { EventEmitter } from 'events';
import { execSync } from 'child_process';
import app from '../app.js';
import jwt from 'jsonwebtoken';
import { getSession, closeDriver } from '../config/neo4j.config.js';

const JWT_SECRET = process.env.JWT_SECRET || 'campusgraph_super_secret_jwt_key_2026_academic_project';

// ---------------------------------------------------------------------------
// In-process HTTP mock (same approach as the existing relationship test suite)
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
    const res = new EventEmitter();
    res.statusCode = 200;
    res.status = function (c) { this.statusCode = c; responseStatus = c; return this; };
    res.setHeader = () => {};
    res.removeHeader = () => {};
    res.getHeader = () => undefined;
    const done = (b) => resolve({ statusCode: responseStatus, body: b });
    res.json = function (o) { done(o); };
    res.send = function (d) { try { done(JSON.parse(d)); } catch { done(d); } };
    res.end = function (d) { done(d || ''); };

    app.handle(req, res);
    if (body !== null) {
      const s = typeof body === 'string' ? body : JSON.stringify(body);
      req.emit('data', Buffer.from(s));
    }
    req.emit('end');
  });
};

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
const failures = [];
const assert = (cond, title, details = '') => {
  if (cond) { console.log(`  PASS: ${title}`); passed++; }
  else { console.error(`  FAIL: ${title}`); if (details) console.error(`        -> ${details}`); failures.push(title); failed++; }
};

const tokenFor = (studentId, email) =>
  jwt.sign({ studentId, email, role: 'student' }, JWT_SECRET, { expiresIn: '1h' });

// Test students
const A = { id: 'STU2026001', email: 'aarav.sharma@campus.edu' };     // Aarav
const B = { id: 'STU2026002', email: 'priya.patel@campus.edu' };       // Priya
const C = { id: 'STU2026004', email: 'ananya.deshmukh@campus.edu' };   // Ananya
const D = { id: 'STU2026005', email: 'vikram.verma@campus.edu' };      // Vikram
const E = { id: 'STU2026003', email: 'rohan.gupta@campus.edu' };       // Rohan
const auth = (s) => ({ authorization: `Bearer ${tokenFor(s.id, s.email)}` });

// ---------------------------------------------------------------------------
// Reset the friendship subgraph to a clean seed state before testing
// (clear all pending requests + friendships, then recreate seed friendships)
// ---------------------------------------------------------------------------
const resetFriendshipSubgraph = async () => {
  const session = getSession();
  try {
    await session.run('MATCH ()-[r:PENDING_FRIEND_REQUEST]->() DELETE r');
    await session.run('MATCH ()-[r:FRIENDS_WITH]->() DELETE r');
    const seedFriends = [
      ['STU2026001', 'STU2026002'], ['STU2026001', 'STU2026003'],
      ['STU2026002', 'STU2026004'], ['STU2026003', 'STU2026005'],
      ['STU2026004', 'STU2026005']
    ];
    for (const [a, b] of seedFriends) {
      await session.run(
        'MATCH (x:Student {studentId: $a}), (y:Student {studentId: $b}) MERGE (x)-[:FRIENDS_WITH {since: datetime(), status: "accepted"}]-(y)',
        { a, b }
      );
    }
  } finally {
    await session.close();
  }
};

// Helper: read relationship status between two students (as seen by `as`)
const statusBetween = async (as, targetId) => {
  const r = await mockRequest({ method: 'GET', url: `/api/relationships/status/${targetId}`, headers: auth(as) });
  return r.body?.data || {};
};

const runTests = async () => {
  console.log('===============================================================');
  console.log(' CampusGraph Phase 3A - Friend Request Management Tests');
  console.log('===============================================================');

  await resetFriendshipSubgraph();
  console.log('  (reset friendship subgraph to seed state)');

  // 1. Self-request prevention ---------------------------------------------
  console.log('\n-- 1. Self-request prevention --');
  {
    const r = await mockRequest({
      method: 'POST', url: '/api/relationships/friend-requests',
      headers: auth(A), body: { targetStudentId: A.id }
    });
    assert(r.statusCode === 400 && (r.body.message || '').includes('yourself'),
      'Self-request rejected with 400', JSON.stringify(r.body));
  }

  // 2. Successful friend request -------------------------------------------
  console.log('\n-- 2. Successful friend request (C -> A) --');
  {
    const r = await mockRequest({
      method: 'POST', url: '/api/relationships/friend-requests',
      headers: auth(C), body: { targetStudentId: A.id }
    });
    assert(r.statusCode === 201 && r.body.data?.status === 'pending',
      'Friend request sent -> 201 with status pending', JSON.stringify(r.body));

    const st = await statusBetween(A, C.id);
    assert(st.hasPendingIncoming === true && st.isFriend === false,
      'Receiver sees hasPendingIncoming=true, not yet friends', JSON.stringify(st));
  }

  // 3. Duplicate request blocked -------------------------------------------
  console.log('\n-- 3. Duplicate request blocked (C -> A again) --');
  {
    const r = await mockRequest({
      method: 'POST', url: '/api/relationships/friend-requests',
      headers: auth(C), body: { targetStudentId: A.id }
    });
    assert(r.statusCode === 400 && (r.body.message || '').toLowerCase().includes('pending'),
      'Duplicate request rejected with 400', JSON.stringify(r.body));
  }

  // 4. Reciprocal pending request blocked ----------------------------------
  console.log('\n-- 4. Reciprocal pending request blocked (A -> C while C -> A pending) --');
  {
    const r = await mockRequest({
      method: 'POST', url: '/api/relationships/friend-requests',
      headers: auth(A), body: { targetStudentId: C.id }
    });
    assert(r.statusCode === 400 && (r.body.message || '').toLowerCase().includes('already'),
      'Reciprocal request rejected with 400 (incoming conflict)', JSON.stringify(r.body));
  }

  // 5. Accept (transactional) ----------------------------------------------
  console.log('\n-- 5. Accept friend request (A accepts C) --');
  {
    const r = await mockRequest({
      method: 'POST', url: `/api/relationships/friend-requests/${C.id}/accept`,
      headers: auth(A)
    });
    assert(r.statusCode === 200 && r.body.data?.status === 'accepted',
      'Accept returns 200 with status accepted', JSON.stringify(r.body));

    const st = await statusBetween(A, C.id);
    assert(st.isFriend === true && st.hasPendingIncoming === false && st.hasPendingOutgoing === false,
      'After accept: isFriend=true, no pending remains', JSON.stringify(st));

    // Verify the pending edge was removed and no dangling request remains
    const session = getSession();
    let dangling;
    try {
      const res = await session.run(
        'MATCH (a:Student {studentId: $a})-[r:PENDING_FRIEND_REQUEST]->(b:Student {studentId: $b}) RETURN count(r) AS c',
        { a: C.id, b: A.id }
      );
      dangling = res.records[0].get('c');
    } finally { await session.close(); }
    assert(dangling === 0, 'No dangling PENDING_FRIEND_REQUEST edge remains after accept', `dangling=${dangling}`);
  }

  // 6. Reject ---------------------------------------------------------------
  console.log('\n-- 6. Reject friend request (D -> A, then A rejects) --');
  {
    const send = await mockRequest({
      method: 'POST', url: '/api/relationships/friend-requests',
      headers: auth(D), body: { targetStudentId: A.id }
    });
    assert(send.statusCode === 201, 'D sends request to A -> 201', JSON.stringify(send.body));

    const rej = await mockRequest({
      method: 'POST', url: `/api/relationships/friend-requests/${D.id}/reject`,
      headers: auth(A)
    });
    assert(rej.statusCode === 200, 'A rejects D -> 200', JSON.stringify(rej.body));

    const st = await statusBetween(A, D.id);
    assert(st.isFriend === false && st.hasPendingIncoming === false,
      'After reject: not friends, no pending incoming', JSON.stringify(st));
  }

  // 7. Unauthorized acceptance (only the receiver can accept) ---------------
  console.log('\n-- 7. Unauthorized acceptance (E -> B, A tries to accept) --');
  {
    const send = await mockRequest({
      method: 'POST', url: '/api/relationships/friend-requests',
      headers: auth(E), body: { targetStudentId: B.id }
    });
    assert(send.statusCode === 201, 'E sends request to B -> 201', JSON.stringify(send.body));

    const wrong = await mockRequest({
      method: 'POST', url: `/api/relationships/friend-requests/${E.id}/accept`,
      headers: auth(A) // A is not the receiver (B is)
    });
    assert(wrong.statusCode === 404,
      'Unauthorized accept by non-receiver rejected with 404', JSON.stringify(wrong.body));

    // Confirm B and E are NOT friends (the unauthorized accept did nothing)
    const st = await statusBetween(B, E.id);
    assert(st.isFriend === false,
      'Unauthorized accept did not create a friendship', JSON.stringify(st));
  }

  // 8. Sender-only cancel ---------------------------------------------------
  console.log('\n-- 8. Sender-only cancel (B -> D, B cancels; A cannot cancel it) --');
  {
    const send = await mockRequest({
      method: 'POST', url: '/api/relationships/friend-requests',
      headers: auth(B), body: { targetStudentId: D.id }
    });
    assert(send.statusCode === 201, 'B sends request to D -> 201', JSON.stringify(send.body));

    // Wrong user (A) cannot cancel B's outgoing request
    const wrong = await mockRequest({
      method: 'DELETE', url: `/api/relationships/friend-requests/${D.id}`,
      headers: auth(A)
    });
    assert(wrong.statusCode === 404,
      'Non-sender cannot cancel another student\'s outgoing request -> 404', JSON.stringify(wrong.body));

    // Sender (B) cancels their own request
    const ok = await mockRequest({
      method: 'DELETE', url: `/api/relationships/friend-requests/${D.id}`,
      headers: auth(B)
    });
    assert(ok.statusCode === 200, 'Sender cancels own outgoing request -> 200', JSON.stringify(ok.body));

    const st = await statusBetween(B, D.id);
    assert(st.hasPendingOutgoing === false && st.isFriend === false,
      'After cancel: no pending outgoing, not friends', JSON.stringify(st));
  }

  // 9. Removing friendship + only existing friends can remove -------------
  console.log('\n-- 9. Removing friendship (A unfriends E) --');
  {
    const before = await statusBetween(A, E.id);
    assert(before.isFriend === true, 'A and E are friends before removal', JSON.stringify(before));

    const rm = await mockRequest({
      method: 'DELETE', url: `/api/relationships/friends/${E.id}`,
      headers: auth(A)
    });
    assert(rm.statusCode === 200, 'A removes friend E -> 200', JSON.stringify(rm.body));

    const after = await statusBetween(A, E.id);
    assert(after.isFriend === false, 'A and E are no longer friends', JSON.stringify(after));

    // Removing again fails (only existing friends can remove)
    const rmAgain = await mockRequest({
      method: 'DELETE', url: `/api/relationships/friends/${E.id}`,
      headers: auth(A)
    });
    assert(rmAgain.statusCode === 404,
      'Removing a non-existent friendship -> 404 (only existing friends can remove)', JSON.stringify(rmAgain.body));
  }

  // 10. Cannot request an existing friend ----------------------------------
  console.log('\n-- 10. Cannot request an existing friend (A -> B already friends) --');
  {
    const r = await mockRequest({
      method: 'POST', url: '/api/relationships/friend-requests',
      headers: auth(A), body: { targetStudentId: B.id }
    });
    assert(r.statusCode === 400 && (r.body.message || '').toLowerCase().includes('friend'),
      'Requesting an existing friend rejected with 400', JSON.stringify(r.body));
  }

  // -------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(` Phase 3A Summary: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) { console.log(' Failed:'); failures.forEach(f => console.log(`   - ${f}`)); }
  console.log('===============================================================');

  await closeDriver();
  process.exit(failed > 0 ? 1 : 0);
};

runTests().catch(async (err) => {
  console.error('[Test Runner] Fatal error:', err);
  await closeDriver();
  process.exit(1);
});
