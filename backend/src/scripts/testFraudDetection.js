import { EventEmitter } from 'events';
import app from '../app.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'campusgraph_super_secret_jwt_key_2026_academic_project';

const mockRequest = ({ method = 'GET', url = '/', headers = {}, body = null }) => {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = url;
    req.headers = {
      'content-type': 'application/json',
      ...headers
    };
    req.connection = {};
    req.socket = {};

    if (body) {
      req.body = body;
    }

    let responseBody = '';
    let responseStatus = 200;
    const responseHeaders = {};

    const res = new EventEmitter();
    res.statusCode = 200;

    res.status = function (code) {
      this.statusCode = code;
      responseStatus = code;
      return this;
    };

    res.setHeader = function (name, value) {
      responseHeaders[name.toLowerCase()] = value;
    };

    res.removeHeader = function (name) {
      delete responseHeaders[name.toLowerCase()];
    };

    res.getHeader = function (name) {
      return responseHeaders[name.toLowerCase()];
    };

    res.json = function (jsonObj) {
      responseBody = jsonObj;
      resolve({
        statusCode: responseStatus,
        body: jsonObj,
        headers: responseHeaders
      });
    };

    res.send = function (content) {
      try {
        responseBody = JSON.parse(content);
      } catch {
        responseBody = content;
      }
      resolve({
        statusCode: responseStatus,
        body: responseBody,
        headers: responseHeaders
      });
    };

    res.end = function (data) {
      if (data) responseBody = data;
      resolve({
        statusCode: responseStatus,
        body: responseBody,
        headers: responseHeaders
      });
    };

    app.handle(req, res);

    if (body) {
      const dataStr = typeof body === 'string' ? body : JSON.stringify(body);
      req.emit('data', Buffer.from(dataStr));
    }
    req.emit('end');
  });
};

const runTests = async () => {
  console.log('===============================================================');
  console.log(' CampusGraph Week 4: Fraud Detection & Analytics Tests');
  console.log('===============================================================');

  let passed = 0;
  let failed = 0;

  const assert = (condition, title, details = '') => {
    if (condition) {
      console.log(` ✅ PASS: ${title}`);
      passed++;
    } else {
      console.error(` ❌ FAIL: ${title}`);
      if (details) console.error(`    Details:`, details);
      failed++;
    }
  };

  const tokenStudentA = jwt.sign(
    { studentId: 'STU001', email: 'studentA@campus.edu', role: 'student' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // 1. Unauthenticated risk-scores blocked (401)
  const res1 = await mockRequest({
    method: 'GET',
    url: '/api/fraud/risk-scores'
  });

  assert(
    res1.statusCode === 401,
    'Fraud Route Protection: Unauthenticated GET /api/fraud/risk-scores returns 401',
    res1.body
  );

  // 2. Authenticated risk-scores allowed (200 or 503)
  const res2 = await mockRequest({
    method: 'GET',
    url: '/api/fraud/risk-scores',
    headers: { 'authorization': `Bearer ${tokenStudentA}` }
  });

  assert(
    res2.statusCode === 200 || res2.statusCode === 503,
    'Fraud Risk Scores: Authenticated GET /api/fraud/risk-scores returns 200 or 503 (Neo4j offline)',
    res2.body
  );

  // 3. Recalculate requires auth (401)
  const res3 = await mockRequest({
    method: 'POST',
    url: '/api/fraud/recalculate'
  });

  assert(
    res3.statusCode === 401,
    'Fraud Route Protection: Unauthenticated POST /api/fraud/recalculate returns 401',
    res3.body
  );

  // 4. Recalculate with auth allowed (200 or 503)
  const res4 = await mockRequest({
    method: 'POST',
    url: '/api/fraud/recalculate',
    headers: { 'authorization': `Bearer ${tokenStudentA}` }
  });

  assert(
    res4.statusCode === 200 || res4.statusCode === 503,
    'Fraud Recalculate: Authenticated POST /api/fraud/recalculate returns 200 or 503 (Neo4j offline)',
    res4.body
  );

  // 5. Path between same student returns distance:0 (200) or 503
  const res5 = await mockRequest({
    method: 'GET',
    url: '/api/fraud/path/STU001/STU001',
    headers: { 'authorization': `Bearer ${tokenStudentA}` }
  });

  assert(
    (res5.statusCode === 200 && res5.body?.data?.distance === 0) || res5.statusCode === 503,
    'Fraud Path: Same student path returns distance:0 (200) or 503 (Neo4j offline)',
    res5.body
  );

  // 6. Analytics stats requires auth (401)
  const res6 = await mockRequest({
    method: 'GET',
    url: '/api/analytics/stats'
  });

  assert(
    res6.statusCode === 401,
    'Analytics Route Protection: Unauthenticated GET /api/analytics/stats returns 401',
    res6.body
  );

  console.log('\n===============================================================');
  console.log(` Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log('===============================================================');

  if (failed > 0) process.exit(1);
  process.exit(0);
};

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
