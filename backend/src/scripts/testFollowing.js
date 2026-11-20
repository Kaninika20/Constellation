/**
 * =============================================================================
 * Constellation - Phase 3B Following & Followers System Tests
 * =============================================================================
 * Verifies the directed FOLLOWS relationship lifecycle through the real Express
 * API against a live Neo4j instance:
 *   1.  Self-follow prevention
 *   2.  Successful follow (creates directed FOLLOWS with createdAt)
 *   3.  Duplicate following blocked
 *   4.  Follower / following counts endpoint
 *   5.  Unfollow + unfollow-again (404)
 *   6.  Unauthorized access (no token) blocked
 *   7.  Independence: following does NOT create friendship
 *   8.  Independence: unfollowing does NOT remove friendship
 *   9.  Independence: removing friendship does NOT remove following
 *
 * Run with: node src/scripts/testFollowing.js
 * =============================================================================
 */
import { EventEmitter } from 'events';
import app from '../app.js';
import jwt from 'jsonwebtoken';
import { getSession, closeDriver } from '../config/neo4j.config.js';

const JWT_SECRET = process.env.JWT_SECRET || 'campusgraph_super_secret_jwt_key_2026_academic_project';

// ---------------------------------------------------------------------------
// In-process HTTP mock
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
let passed = 0;
let failed = 0;
const failures = [];
const assert = (cond, title, details = '') => {
  if (cond) { console.log(`  PASS: ${title}`); passed++; }
  else { console.error(`  FAIL: ${title}`); if (details) console.error(`        -> ${details}`); failures.push(title); failed++; }
};

const tokenFor = (studentId, email) =>
  jwt.sign({ studentId, email, role: 'student' }, JWT_SECRET, { expiresIn: '1h' });

const A = { id: 'STU2026001', email: 'aarav.sharma@campus.edu' };     // Aarav
const B = { id: 'STU2026002', email: 'priya.patel@campus.edu' };       // Priya  (friend of A in seed)
const D = { id: 'STU2026005', email: 'vikram.verma@campus.edu' };      // Vikram (NOT friend of A in seed)
const auth = (s) => ({ authorization: `Bearer ${tokenFor(s.id, s.email)}` });

const statusBetween = async (as, targetId) => {
  const r = await mockRequest({ method: 'GET', url: `/api/relationships/status/${targetId}`, headers: auth(as) });
  return r.body?.data || {};
};

// ---------------------------------------------------------------------------
// Reset: clear FOLLOWS + PENDING, recreate seed friendships so the test runs
// against a deterministic graph (A-B and A-E(Rohan=STU2026003) are friends).
// ---------------------------------------------------------------------------
const resetFollowSubgraph = async () => {
  const session = getSession();
  try {
    await session.run('MATCH ()-[r:FOLLOWS]->() DELETE r');
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

const runTests = async () => {
  console.log('===============================================================');
  console.log(' Constellation Phase 3B - Following & Followers System Tests');
  console.log('===============================================================');

  await resetFollowSubgraph();
  console.log('  (reset follow + friendship subgraph to seed state)');

  // 1. Self-follow prevention ------------------------------------------------
  console.log('\n-- 1. Self-follow prevention --');
  {
    const r = await mockRequest({ method: 'POST', url: `/api/relationships/follow/${A.id}`, headers: auth(A) });
    assert(r.statusCode === 400 && (r.body.message || '').includes('yourself'),
      'Self-follow rejected with 400', JSON.stringify(r.body));
  }

  // 2. Successful follow (directed, with createdAt) -------------------------
  console.log('\n-- 2. Successful follow (A -> D) with createdAt --');
  {
    const r = await mockRequest({ method: 'POST', url: `/api/relationships/follow/${D.id}`, headers: auth(A) });
    assert(r.statusCode === 201, 'Follow succeeds -> 201', JSON.stringify(r.body));

    // The following list entry must carry a createdAt timestamp (not since)
    const fl = await mockRequest({ method: 'GET', url: '/api/relationships/following', headers: auth(A) });
    const entry = (fl.body?.data || []).find((e) => e.followed?.studentId === D.id);
    assert(!!entry && typeof entry.createdAt === 'string' && entry.createdAt.length > 0,
      'FOLLOWS edge stores createdAt timestamp', JSON.stringify(entry));

    const st = await statusBetween(A, D.id);
    assert(st.isFollowing === true && st.isFriend === false,
      'A follows D; status reflects isFollowing=true', JSON.stringify(st));
  }

  // 7 (early). Independence: following does NOT create friendship ------------
  console.log('\n-- 3. Independence: following does not create friendship --');
  {
    const st = await statusBetween(A, D.id);
    assert(st.isFriend === false,
      'Following a non-friend did NOT create a friendship', JSON.stringify(st));
  }

  // 3. Duplicate following blocked -----------------------------------------
  console.log('\n-- 4. Duplicate following blocked (A -> D again) --');
  {
    const r = await mockRequest({ method: 'POST', url: `/api/relationships/follow/${D.id}`, headers: auth(A) });
    assert(r.statusCode === 400, 'Duplicate follow rejected with 400', JSON.stringify(r.body));

    // Verify no duplicate FOLLOWS edge was created
    const session = getSession();
    let dupCount;
    try {
      const res = await session.run(
        'MATCH (a:Student {studentId: $a})-[r:FOLLOWS]->(b:Student {studentId: $b}) RETURN count(r) AS c',
        { a: A.id, b: D.id }
      );
      dupCount = res.records[0].get('c');
    } finally { await session.close(); }
    assert(dupCount === 1, 'Exactly one FOLLOWS edge exists (no duplicate)', `count=${dupCount}`);
  }

  // 4. Follower / following counts ------------------------------------------
  console.log('\n-- 5. Follower / following counts --');
  {
    // A follows D (1 following, 0 followers)
    const aCounts = await mockRequest({ method: 'GET', url: '/api/relationships/follow-counts', headers: auth(A) });
    assert(aCounts.statusCode === 200 && aCounts.body?.data?.followingCount === 1 && aCounts.body?.data?.followersCount === 0,
      'Self counts: following=1, followers=0', JSON.stringify(aCounts.body));

    // D is followed by A (1 follower, 0 following)
    const dCounts = await mockRequest({ method: 'GET', url: `/api/relationships/follow-counts/${D.id}`, headers: auth(A) });
    assert(dCounts.statusCode === 200 && dCounts.body?.data?.followersCount === 1 && dCounts.body?.data?.followingCount === 0,
      'Peer counts (D): followers=1, following=0', JSON.stringify(dCounts.body));
  }

  // 8. Independence: unfollowing does NOT remove friendship ------------------
  console.log('\n-- 6. Independence: unfollowing does not remove friendship --');
  {
    // A and B are friends in seed. A follows B, then unfollows B -> friendship must remain.
    const follow = await mockRequest({ method: 'POST', url: `/api/relationships/follow/${B.id}`, headers: auth(A) });
    assert(follow.statusCode === 201, 'A follows friend B -> 201', JSON.stringify(follow.body));

    const before = await statusBetween(A, B.id);
    assert(before.isFriend === true && before.isFollowing === true,
      'A and B are friends AND A follows B', JSON.stringify(before));

    const unfollow = await mockRequest({ method: 'DELETE', url: `/api/relationships/follow/${B.id}`, headers: auth(A) });
    assert(unfollow.statusCode === 200, 'A unfollows B -> 200', JSON.stringify(unfollow.body));

    const after = await statusBetween(A, B.id);
    assert(after.isFriend === true && after.isFollowing === false,
      'After unfollow: friendship intact, no longer following', JSON.stringify(after));
  }

  // 5. Unfollow + unfollow again (404) --------------------------------------
  console.log('\n-- 7. Unfollow + unfollow-again (404) --');
  {
    const r = await mockRequest({ method: 'DELETE', url: `/api/relationships/follow/${D.id}`, headers: auth(A) });
    assert(r.statusCode === 200, 'A unfollows D -> 200', JSON.stringify(r.body));

    const st = await statusBetween(A, D.id);
    assert(st.isFollowing === false, 'A no longer follows D', JSON.stringify(st));

    const again = await mockRequest({ method: 'DELETE', url: `/api/relationships/follow/${D.id}`, headers: auth(A) });
    assert(again.statusCode === 404, 'Unfollow when not following -> 404', JSON.stringify(again.body));
  }

  // 9. Independence: removing friendship does NOT remove following -----------
  console.log('\n-- 8. Independence: removing friendship does not remove following --');
  {
    // A follows B (re-follow), then removes friendship -> following must remain.
    const follow = await mockRequest({ method: 'POST', url: `/api/relationships/follow/${B.id}`, headers: auth(A) });
    assert(follow.statusCode === 201, 'A re-follows B -> 201', JSON.stringify(follow.body));

    const rm = await mockRequest({ method: 'DELETE', url: `/api/relationships/friends/${B.id}`, headers: auth(A) });
    assert(rm.statusCode === 200, 'A removes friendship with B -> 200', JSON.stringify(rm.body));

    const st = await statusBetween(A, B.id);
    assert(st.isFollowing === true && st.isFriend === false,
      'After removing friendship: still following, no longer friends', JSON.stringify(st));
  }

  // 6. Unauthorized access ---------------------------------------------------
  console.log('\n-- 9. Unauthorized access (no token) --');
  {
    const cases = [
      { method: 'POST', url: `/api/relationships/follow/${D.id}` },
      { method: 'DELETE', url: `/api/relationships/follow/${D.id}` },
      { method: 'GET', url: '/api/relationships/followers' },
      { method: 'GET', url: '/api/relationships/following' },
      { method: 'GET', url: '/api/relationships/follow-counts' }
    ];
    for (const c of cases) {
      const r = await mockRequest({ method: c.method, url: c.url });
      assert(r.statusCode === 401, `${c.method} ${c.url} without token -> 401`, JSON.stringify(r.body));
    }
  }

  // -------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(` Phase 3B Summary: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) { console.log(' Failed:'); failures.forEach((f) => console.log(`   - ${f}`)); }
  console.log('===============================================================');

  await closeDriver();
  process.exit(failed > 0 ? 1 : 0);
};

runTests().catch(async (err) => {
  console.error('[Test Runner] Fatal error:', err);
  await closeDriver();
  process.exit(1);
});
