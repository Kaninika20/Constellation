/**
 * Constellation - Phase 2 Audit Verification Suite
 * ---------------------------------------------------------------------------
 * Verifies the six Phase 2 invariants against a live Neo4j instance by
 * exercising the actual Express endpoints (login, profile, directory, update)
 * and the Neo4j node/relationship layer directly.
 *
 * Run with: node src/scripts/auditPhase2.js
 */
import { EventEmitter } from 'events';
import app from '../app.js';
import jwt from 'jsonwebtoken';
import { getSession, closeDriver } from '../config/neo4j.config.js';

const JWT_SECRET = process.env.JWT_SECRET || 'campusgraph_super_secret_jwt_key_2026_academic_project';

let passed = 0;
let failed = 0;
const failures = [];

const assert = (cond, title, details = '') => {
  if (cond) {
    console.log(`  PASS: ${title}`);
    passed++;
  } else {
    console.error(`  FAIL: ${title}`);
    if (details) console.error(`        -> ${details}`);
    failures.push(title);
    failed++;
  }
};

/** Recursively check that no key named passwordHash exists anywhere in an object/array. */
const containsPasswordHash = (obj) => {
  if (obj === null || obj === undefined) return false;
  if (typeof obj !== 'object') return false;
  if (Array.isArray(obj)) return obj.some(containsPasswordHash);
  return Object.entries(obj).some(
    ([k, v]) => k === 'passwordHash' || containsPasswordHash(v)
  );
};

/** Simulated HTTP request through the Express app (no socket binding). */
const mockRequest = ({ method = 'GET', url = '/', headers = {}, body = null }) => {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = url;
    req.headers = { 'content-type': 'application/json', ...headers };
    req.connection = {};
    req.socket = {};

    let responseBody = null;
    let responseStatus = 200;
    const responseHeaders = {};

    const res = new EventEmitter();
    res.statusCode = 200;
    res.status = function (code) { this.statusCode = code; responseStatus = code; return this; };
    res.setHeader = (n, v) => { responseHeaders[n.toLowerCase()] = v; };
    res.removeHeader = (n) => { delete responseHeaders[n.toLowerCase()]; };
    res.getHeader = (n) => responseHeaders[n.toLowerCase()];
    res.json = function (o) { responseBody = o; resolve({ statusCode: responseStatus, body: o, headers: responseHeaders }); };
    res.send = function (c) { try { responseBody = JSON.parse(c); } catch { responseBody = c; } resolve({ statusCode: responseStatus, body: responseBody, headers: responseHeaders }); };
    res.end = function (d) { if (d) responseBody = d; resolve({ statusCode: responseStatus, body: responseBody, headers: responseHeaders }); };

    if (body) req.body = body;
    app.handle(req, res);
    if (body) {
      const s = typeof body === 'string' ? body : JSON.stringify(body);
      req.emit('data', Buffer.from(s));
    }
    req.emit('end');
  });
};

const tokenFor = (studentId, email = `${studentId.toLowerCase()}@campus.edu`, role = 'student') =>
  jwt.sign({ studentId, email, role }, JWT_SECRET, { expiresIn: '1h' });

const run = async () => {
  console.log('===============================================================');
  console.log(' Constellation Phase 2 Audit Verification');
  console.log('===============================================================');

  // -- Real login to obtain an authenticated session + verify login response --
  const loginRes = await mockRequest({
    method: 'POST',
    url: '/api/auth/login',
    body: { email: 'aarav.sharma@campus.edu', password: 'Password123!' }
  });

  assert(loginRes.statusCode === 200, 'Login succeeds with valid seeded credentials (200)', JSON.stringify(loginRes.body));

  const loginStudent = loginRes.body?.data?.student;
  assert(!!loginStudent, 'Login response includes a student object');
  assert(!containsPasswordHash(loginRes.body), 'Login response exposes NO passwordHash anywhere', JSON.stringify(loginStudent));
  assert(!!loginRes.body?.data?.token, 'Login response returns a JWT token');

  // Use the real token for subsequent authenticated profile requests
  const realToken = loginRes.body?.data?.token;
  const authHeader = { authorization: `Bearer ${realToken}` };

  // -- Point 1 & 2: Profile API retrieval incl. following list --
  // STU2026001 (Aarav): 2 courses, 1 club, 2 events, 2 interests, 2 friends, 0 following
  const meRes = await mockRequest({ method: 'GET', url: '/api/students/me', headers: authHeader });
  assert(meRes.statusCode === 200, 'GET /api/students/me returns 200 for authenticated student', JSON.stringify(meRes.body));
  const me = meRes.body?.data || {};
  assert(Array.isArray(me.courses) && me.courses.length === 2, `Profile retrieves courses (got ${me.courses?.length}, expected 2)`, JSON.stringify(me.courses));
  assert(Array.isArray(me.clubs) && me.clubs.length === 1, `Profile retrieves clubs (got ${me.clubs?.length}, expected 1)`, JSON.stringify(me.clubs));
  assert(Array.isArray(me.events) && me.events.length === 2, `Profile retrieves events (got ${me.events?.length}, expected 2)`, JSON.stringify(me.events));
  assert(Array.isArray(me.interests) && me.interests.length === 2, `Profile retrieves interests (got ${me.interests?.length}, expected 2)`, JSON.stringify(me.interests));
  assert(Array.isArray(me.friends) && me.friends.length === 2, `Profile retrieves friends (got ${me.friends?.length}, expected 2)`, JSON.stringify(me.friends));
  assert(Array.isArray(me.following), 'Profile response includes a following array');
  assert(me.following.length === 0, `Following list correct for student who follows nobody (got ${me.following?.length}, expected 0)`, JSON.stringify(me.following));

  // STU2026999 (Bot): 0 of everything except following = 3
  const botRes = await mockRequest({ method: 'GET', url: '/api/students/STU2026999', headers: authHeader });
  assert(botRes.statusCode === 200, 'GET /api/students/:id returns 200 for a peer profile', JSON.stringify(botRes.body));
  const bot = botRes.body?.data || {};
  const followingIds = (bot.following || []).map(f => f.studentId).sort();
  assert(
    Array.isArray(bot.following) && bot.following.length === 3,
    `Profile retrieves following list (got ${bot.following?.length}, expected 3)`,
    JSON.stringify(bot.following)
  );
  assert(
    JSON.stringify(followingIds) === JSON.stringify(['STU2026001', 'STU2026002', 'STU2026003']),
    `Following list contains exactly the followed students (${followingIds.join(', ')})`,
    JSON.stringify(followingIds)
  );

  // -- Point 3: passwordHash never exposed through profile / directory responses --
  assert(!containsPasswordHash(meRes.body), 'Profile (/me) response exposes NO passwordHash (incl. friends/following)');
  assert(!containsPasswordHash(botRes.body), 'Profile (/:id) response exposes NO passwordHash (incl. friends/following)');

  const dirRes = await mockRequest({ method: 'GET', url: '/api/students?limit=50' });
  assert(dirRes.statusCode === 200, 'GET /api/students directory returns 200', JSON.stringify(dirRes.body));
  assert(!containsPasswordHash(dirRes.body), 'Directory response exposes NO passwordHash for any student');
  assert((dirRes.body?.data?.students?.length || 0) > 0, 'Directory returns a non-empty student list');

  // -- Point 4: Profile update updates Neo4j node + interest relationships --
  // Snapshot original values so we can restore the seed afterwards.
  const originalBio = me.student?.bio;
  const originalInterests = me.interests;

  const updateRes = await mockRequest({
    method: 'PUT',
    url: '/api/students/STU2026001',
    headers: authHeader,
    body: {
      bio: 'AUDIT_PROBE_UPDATED_BIO',
      interests: ['Graph Databases', 'Cybersecurity', 'Cloud Computing'] // 2 new + 1 kept
    }
  });
  assert(updateRes.statusCode === 200, 'PUT /api/students/:id (own profile) returns 200', JSON.stringify(updateRes.body));
  assert(updateRes.body?.data?.student?.bio === 'AUDIT_PROBE_UPDATED_BIO', 'Profile update persists bio on the Neo4j Student node', updateRes.body?.data?.student?.bio);

  // Verify interest relationships were rewired (old removed, new added) directly in Neo4j
  const session = getSession();
  let liveInterests;
  try {
    const r = await session.run(
      `MATCH (s:Student {studentId: 'STU2026001'})-[:HAS_INTEREST]->(i:Interest)
       RETURN collect(i.name) AS interests`
    );
    liveInterests = r.records[0].get('interests').sort();
  } finally {
    await session.close();
  }
  assert(
    JSON.stringify(liveInterests) === JSON.stringify(['Cloud Computing', 'Cybersecurity', 'Graph Databases']),
    `Profile update rewires HAS_INTEREST relationships (${liveInterests.join(', ')})`,
    JSON.stringify(liveInterests)
  );

  // The update response itself must also not leak passwordHash and must reflect the new following/interests
  assert(!containsPasswordHash(updateRes.body), 'Update response exposes NO passwordHash');
  assert(
    JSON.stringify((updateRes.body?.data?.interests || []).sort()) === JSON.stringify(['Cloud Computing', 'Cybersecurity', 'Graph Databases']),
    'Update response returns the rewired interest set',
    JSON.stringify(updateRes.body?.data?.interests)
  );

  // -- Restore seed state (bio + interests) so the audit leaves no side effects --
  await mockRequest({
    method: 'PUT',
    url: '/api/students/STU2026001',
    headers: authHeader,
    body: { bio: originalBio, interests: originalInterests }
  });
  console.log('  (restored original bio + interests for STU2026001)');

  // -- Point 5: Profile ownership + JWT authorization --
  const studentBToken = tokenFor('STU2026002', 'priya.patel@campus.edu');
  const crossEdit = await mockRequest({
    method: 'PUT',
    url: '/api/students/STU2026001',
    headers: { authorization: `Bearer ${studentBToken}` },
    body: { bio: 'SHOULD_NOT_PERSIST' }
  });
  assert(crossEdit.statusCode === 403, 'Ownership: Student B editing Student A profile is forbidden (403)', JSON.stringify(crossEdit.body));

  const noToken = await mockRequest({ method: 'GET', url: '/api/students/me' });
  assert(noToken.statusCode === 401, 'JWT: /me without token is unauthorized (401)', JSON.stringify(noToken.body));

  const badToken = await mockRequest({ method: 'GET', url: '/api/students/me', headers: { authorization: 'Bearer not.a.valid.token' } });
  assert(badToken.statusCode === 401, 'JWT: /me with malformed token is unauthorized (401)', JSON.stringify(badToken.body));

  // -- Summary --
  console.log('\n===============================================================');
  console.log(` Audit Summary: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) {
    console.log(' Failed checks:');
    failures.forEach(f => console.log(`   - ${f}`));
  }
  console.log('===============================================================');

  await closeDriver();
  process.exit(failed > 0 ? 1 : 0);
};

run().catch(async (err) => {
  console.error('Audit execution error:', err);
  await closeDriver();
  process.exit(1);
});
