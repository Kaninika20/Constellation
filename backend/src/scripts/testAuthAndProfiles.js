import { EventEmitter } from 'events';
import app from '../app.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'campusgraph_super_secret_jwt_key_2026_academic_project';

/**
 * Executes a simulated HTTP request directly through the Express app
 * without requiring TCP socket binding (sandbox and cross-platform safe).
 */
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

    if (body) {
      req.body = body;
    }

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
  console.log(' CampusGraph Week 2: Security & Authentication Test Suite');
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

  // -------------------------------------------------------------------------
  // Test 1: Input Validation - Invalid Email on Registration
  // -------------------------------------------------------------------------
  const res1 = await mockRequest({
    method: 'POST',
    url: '/api/auth/register',
    body: {
      name: 'John Doe',
      email: 'not-an-email',
      password: 'short',
      department: 'CS',
      yearOfStudy: 'invalidYear'
    }
  });

  assert(
    res1.statusCode === 400 && res1.body.error === 'Validation Error',
    'Registration rejects invalid email format with 400 Bad Request',
    res1.body
  );

  // -------------------------------------------------------------------------
  // Test 2: Input Validation - Missing Password on Login
  // -------------------------------------------------------------------------
  const res2 = await mockRequest({
    method: 'POST',
    url: '/api/auth/login',
    body: {
      email: 'valid@campus.edu'
    }
  });

  assert(
    res2.statusCode === 400 && res2.body.error === 'Validation Error',
    'Login rejects missing password with 400 Bad Request',
    res2.body
  );

  // -------------------------------------------------------------------------
  // Test 3: Protected Route Access Without Token
  // -------------------------------------------------------------------------
  const res3 = await mockRequest({
    method: 'GET',
    url: '/api/students/me'
  });

  assert(
    res3.statusCode === 401 && res3.body.error === 'Unauthorized',
    'Protected route /api/students/me blocks unauthenticated request (401 Unauthorized)',
    res3.body
  );

  // -------------------------------------------------------------------------
  // Test 4: Protected Route Access With Malformed Token
  // -------------------------------------------------------------------------
  const res4 = await mockRequest({
    method: 'GET',
    url: '/api/students/me',
    headers: { 'authorization': 'Bearer invalid.token.payload' }
  });

  assert(
    res4.statusCode === 401 && res4.body.error === 'Unauthorized',
    'Protected route rejects invalid JWT signature (401 Unauthorized)',
    res4.body
  );

  // -------------------------------------------------------------------------
  // Test 5: Authorization Security - Student Attempting to Edit Another Profile
  // -------------------------------------------------------------------------
  const tokenStudentA = jwt.sign(
    { studentId: 'STU001', email: 'studentA@campus.edu', role: 'student' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const res5 = await mockRequest({
    method: 'PUT',
    url: '/api/students/STU002',
    headers: {
      'authorization': `Bearer ${tokenStudentA}`
    },
    body: {
      name: 'Unauthorized Change'
    }
  });

  assert(
    res5.statusCode === 403 && res5.body.error === 'Forbidden',
    'Strict Authorization: Student A cannot edit Student B\'s profile (403 Forbidden)',
    res5.body
  );

  // -------------------------------------------------------------------------
  // Test 6: Input Validation on Profile Update
  // -------------------------------------------------------------------------
  const res6 = await mockRequest({
    method: 'PUT',
    url: '/api/students/STU001',
    headers: {
      'authorization': `Bearer ${tokenStudentA}`
    },
    body: {
      yearOfStudy: 99 // exceeds valid range 1-8
    }
  });

  assert(
    res6.statusCode === 400 && res6.body.error === 'Validation Error',
    'Profile update validates yearOfStudy range (1-8) with 400 Bad Request',
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
