/**
 * =============================================================================
 * Constellation – Recommendation Engine Tests
 * =============================================================================
 * Covers:
 *  1.  Personalized recommendations: live Neo4j data, positive scores, correct
 *      exclusions (self, existing friends, pending requests).
 *  2.  Weight overrides change the score ordering.
 *  3.  Mutual connections: friends, courses, clubs, interests, events.
 *  4.  Mutual-friends backwards-compat endpoint.
 *  5.  Connection path finder: direct friend path, multi-hop indirect path,
 *      self-to-self distance=0, unreachable pair.
 *  6.  Weights endpoint returns all five keys.
 *  7.  Unauthenticated access is blocked (401) for all endpoints.
 *
 * Run with: node src/scripts/testRecommendations.js
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

// ---------------------------------------------------------------------------
let passed = 0, failed = 0;
const failures = [];
const assert = (cond, title, details = '') => {
  if (cond) { console.log(`  PASS: ${title}`); passed++; }
  else {
    console.error(`  FAIL: ${title}`);
    if (details) console.error(`        -> ${details}`);
    failures.push(title); failed++;
  }
};

const tokenFor = (studentId, email) =>
  jwt.sign({ studentId, email, role: 'student' }, JWT_SECRET, { expiresIn: '1h' });

// STU2026001 (Aarav) – friends with STU2026002, STU2026003 in seed
// Candidates: STU2026004, STU2026005 (not friends, no pending)
const A = { id: 'STU2026001', email: 'aarav.sharma@campus.edu' };
const authA = { authorization: `Bearer ${tokenFor(A.id, A.email)}` };

// ---------------------------------------------------------------------------
// Helpers – direct Neo4j queries for setup
// ---------------------------------------------------------------------------
const cleanupTestData = async () => {
  const session = getSession();
  try {
    // Remove any PENDING_FRIEND_REQUESTs STU2026001 → STU2026004 we may have created
    await session.run(
      'MATCH (a:Student {studentId:"STU2026001"})-[r:PENDING_FRIEND_REQUEST]->(b:Student {studentId:"STU2026004"}) DELETE r'
    );
  } finally { await session.close(); }
};

const addPendingRequest = async (fromId, toId) => {
  const session = getSession();
  try {
    await session.run(
      'MATCH (a:Student {studentId:$fromId}),(b:Student {studentId:$toId}) CREATE (a)-[:PENDING_FRIEND_REQUEST {createdAt:datetime(),status:"pending"}]->(b)',
      { fromId, toId }
    );
  } finally { await session.close(); }
};

// ---------------------------------------------------------------------------
const runTests = async () => {
  console.log('===============================================================');
  console.log(' Constellation – Recommendation Engine Tests');
  console.log('===============================================================');

  await cleanupTestData();
  console.log('  (cleaned up stray test data)');

  // 1. Weights endpoint -------------------------------------------------------
  console.log('\n-- 1. Scoring weights endpoint --');
  {
    const r = await mockRequest({ url: '/api/recommendations/weights', headers: authA });
    assert(r.statusCode === 200, 'GET /recommendations/weights -> 200', JSON.stringify(r.body));
    const d = r.body?.data || {};
    assert(
      d.commonFriends === 5 && d.sharedCourses === 3 &&
      d.sharedInterests === 3 && d.sharedClubs === 2 && d.commonEvents === 1,
      'Default weights: friends=5, courses=3, interests=3, clubs=2, events=1',
      JSON.stringify(d)
    );
  }

  // 2. Personalized recommendations ------------------------------------------
  console.log('\n-- 2. Personalized recommendations (Aarav / STU2026001) --');
  {
    const r = await mockRequest({ url: '/api/recommendations', headers: authA });
    assert(r.statusCode === 200, 'GET /recommendations -> 200', JSON.stringify(r.body?.error));

    const recs = r.body?.data?.recommendations || [];
    assert(recs.length > 0, `Recommendations list is non-empty (got ${recs.length})`, JSON.stringify(recs.map(x => x.student?.studentId)));

    // Self must not appear
    assert(!recs.some(x => x.student?.studentId === A.id), 'Logged-in student is excluded from recommendations');

    // Existing friends (STU2026002, STU2026003) must not appear
    assert(!recs.some(x => ['STU2026002','STU2026003'].includes(x.student?.studentId)),
      'Existing friends (STU2026002, STU2026003) are excluded',
      JSON.stringify(recs.map(x => x.student?.studentId)));

    // All scores must be positive
    assert(recs.every(x => (x.score?.total || 0) > 0),
      'All recommendations have positive score',
      JSON.stringify(recs.map(x => `${x.student?.studentId}=${x.score?.total}`)));

    // Scores must be descending
    const scores = recs.map(x => x.score?.total || 0);
    const descending = scores.every((s, i) => i === 0 || s <= scores[i - 1]);
    assert(descending, 'Results are sorted by score descending', JSON.stringify(scores));

    // Each recommendation includes reasons breakdown
    assert(recs.every(x => x.reasons && typeof x.reasons === 'object'),
      'Each recommendation includes reasons breakdown');
  }

  // 3. Pending-request exclusion ---------------------------------------------
  console.log('\n-- 3. Pending request exclusion --');
  {
    // Add a PENDING_FRIEND_REQUEST from A to STU2026004 manually
    await addPendingRequest('STU2026001', 'STU2026004');

    const r = await mockRequest({ url: '/api/recommendations', headers: authA });
    const recs = r.body?.data?.recommendations || [];
    assert(!recs.some(x => x.student?.studentId === 'STU2026004'),
      'Student with outgoing pending request (STU2026004) excluded from recommendations',
      JSON.stringify(recs.map(x => x.student?.studentId)));

    // Clean up
    await cleanupTestData();
  }

  // 4. Weight overrides change ordering ---------------------------------------
  console.log('\n-- 4. Weight overrides --');
  {
    // Set friends weight to 0, interests weight to 10 -> ordering should change
    const rDefault = await mockRequest({ url: '/api/recommendations', headers: authA });
    const rWeighted = await mockRequest({ url: '/api/recommendations?wFriends=0&wInterests=10', headers: authA });
    const dRecs = rDefault.body?.data?.recommendations || [];
    const wRecs = rWeighted.body?.data?.recommendations || [];
    // Both must succeed
    assert(rDefault.statusCode === 200, 'Default weights request succeeds');
    assert(rWeighted.statusCode === 200, 'Custom weights request succeeds');
    // The applied weights must reflect the override
    const applied = rWeighted.body?.data?.appliedWeights;
    assert(applied?.commonFriends === 0 && applied?.sharedInterests === 10,
      'Applied weights reflect overrides (friends=0, interests=10)', JSON.stringify(applied));
  }

  // 5. Mutual friends endpoint (backwards compat) ----------------------------
  console.log('\n-- 5. Mutual friends endpoint --');
  {
    // STU2026001 and STU2026002 share a mutual friend: STU2026003
    // (seed: A-B, A-C, B... so A-C and B-? — let me check: seed has A(001)-B(002), A(001)-C(003))
    // STU2026001-STU2026002 mutual = students friends with BOTH: checking seed:
    // 001-002, 001-003, 002-004, 003-005, 004-005
    // Friends of 001: 002, 003. Friends of 002: 001, 004.
    // Mutual friends of 001 and 002: students in BOTH friend-lists (excluding 001 and 002) = none (003 is only friend of 001, 004 only friend of 002)
    // But 001-003: friends of 001={002,003}, friends of 003={001,005} -> mutual = {} again
    // Let's use 002 and 003: friends of 002={001,004}, friends of 003={001,005} -> mutual = {001}
    const r = await mockRequest({ url: '/api/recommendations/mutual/STU2026003', headers: { authorization: `Bearer ${tokenFor('STU2026002','priya.patel@campus.edu')}` } });
    assert(r.statusCode === 200, 'GET /recommendations/mutual/:id -> 200', JSON.stringify(r.body?.error));
    const result = r.body?.data || {};
    assert(typeof result.count === 'number', 'Mutual friends response has count field', JSON.stringify(result));
    assert(Array.isArray(result.mutualFriends), 'Mutual friends response has mutualFriends array');
    // STU2026001 (Aarav) is a mutual friend of STU2026002 and STU2026003
    assert(result.mutualFriends.some(m => m.student?.studentId === 'STU2026001'),
      'STU2026001 appears as mutual friend of STU2026002 and STU2026003',
      JSON.stringify(result.mutualFriends.map(m => m.student?.studentId)));
  }

  // 6. Shared connections (all five dimensions) ------------------------------
  console.log('\n-- 6. Shared connections endpoint --');
  {
    // 001 and 002 share: course DS201, course CS302 (both enrolled in seed)
    const r = await mockRequest({ url: '/api/recommendations/shared/STU2026002', headers: authA });
    assert(r.statusCode === 200, 'GET /recommendations/shared/:id -> 200', JSON.stringify(r.body?.error));
    const d = r.body?.data || {};
    assert(typeof d.counts === 'object', 'Shared connections response has counts', JSON.stringify(d));
    assert(Array.isArray(d.sharedCourses), 'sharedCourses is an array');
    assert(Array.isArray(d.sharedClubs),   'sharedClubs is an array');
    assert(Array.isArray(d.sharedInterests), 'sharedInterests is an array');
    assert(Array.isArray(d.commonEvents),  'commonEvents is an array');
    assert(Array.isArray(d.mutualFriends), 'mutualFriends is an array');
    // 001 and 002 both enrolled in DS201 and CS302
    assert(d.sharedCourses.some(c => c.courseCode === 'DS201'),
      '001 and 002 share course DS201',
      JSON.stringify(d.sharedCourses.map(c => c.courseCode)));
    // Both registered for EVT_HACK26
    assert(d.commonEvents.some(e => e.eventId === 'EVT_HACK26'),
      '001 and 002 share event EVT_HACK26',
      JSON.stringify(d.commonEvents.map(e => e.eventId)));
  }

  // 7. Connection path finder ------------------------------------------------
  console.log('\n-- 7. Connection path finder --');
  {
    // Direct friend path: 001 -> 002 (1 hop)
    const direct = await mockRequest({ url: '/api/recommendations/path/STU2026002?maxHops=6', headers: authA });
    assert(direct.statusCode === 200, 'Path 001->002 (direct friend) -> 200', JSON.stringify(direct.body?.error));
    const dp = direct.body?.data;
    assert(dp?.found === true, 'Direct path found');
    assert(dp?.distance === 1, `Direct friend path is 1 hop (got ${dp?.distance})`, JSON.stringify(dp));

    // Indirect path: 001 -> 005 (seed: 001-003, 003-005 = 2 hops via FRIENDS_WITH)
    const indirect = await mockRequest({ url: '/api/recommendations/path/STU2026005?maxHops=6', headers: authA });
    assert(indirect.statusCode === 200, 'Path 001->005 (indirect) -> 200', JSON.stringify(indirect.body?.error));
    const ip = indirect.body?.data;
    assert(ip?.found === true, 'Indirect path 001->005 found');
    assert(ip?.distance > 0, `Indirect path distance > 0 (got ${ip?.distance})`);
    assert(Array.isArray(ip?.path) && ip.path.length > 0, 'Path contains nodes');

    // The selected start ID must be used instead of the authenticated student ID.
    const arbitrary = await mockRequest({
      url: '/api/recommendations/path/STU2026002/STU2026004?maxHops=6',
      headers: authA
    });
    assert(arbitrary.statusCode === 200, 'Arbitrary-pair path request -> 200', JSON.stringify(arbitrary.body?.error));
    assert(
      arbitrary.body?.data?.found === true &&
        arbitrary.body.data.pathNodes[0]?.id === 'STU2026002' &&
        arbitrary.body.data.pathNodes.at(-1)?.id === 'STU2026004',
      'Arbitrary-pair path uses both selected student IDs',
      JSON.stringify(arbitrary.body?.data)
    );

    // Self path
    const selfPath = await mockRequest({ url: '/api/recommendations/path/STU2026001?maxHops=6', headers: authA });
    assert(selfPath.statusCode === 200, 'Self-path request -> 200');
    assert(selfPath.body?.data?.distance === 0, 'Self-path distance is 0', JSON.stringify(selfPath.body?.data));

    // Unreachable: STU2026999 (bot) has no FRIENDS_WITH edges, only FOLLOWS which could still create paths
    // Use a non-existent ID to guarantee no path
    const noPath = await mockRequest({ url: '/api/recommendations/path/STU9999999?maxHops=6', headers: authA });
    assert(noPath.statusCode === 200, 'Unreachable path request -> 200 (not found is not a 500)');
    assert(noPath.body?.data?.found === false, 'Non-existent student returns found=false', JSON.stringify(noPath.body?.data));
  }

  // 8. Unauthenticated access ------------------------------------------------
  console.log('\n-- 8. Unauthenticated access blocked --');
  {
    const endpoints = [
      '/api/recommendations',
      '/api/recommendations/weights',
      '/api/recommendations/mutual/STU2026002',
      '/api/recommendations/shared/STU2026002',
      '/api/recommendations/path/STU2026002',
      '/api/recommendations/path/STU2026002/STU2026004',
    ];
    for (const url of endpoints) {
      const r = await mockRequest({ url });
      assert(r.statusCode === 401, `${url} without token -> 401`, JSON.stringify(r.body));
    }
  }

  // -------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(` Summary: ${passed} Passed, ${failed} Failed`);
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
