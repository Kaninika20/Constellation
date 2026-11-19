# CampusGraph – A Graph-Based College Social Network with Fraud Detection Using Neo4j

> **Academic Project — Phase 2: User Authentication & Student Profile Management**

CampusGraph is an academic social networking and fraud detection platform built entirely on a native graph database architecture using **Neo4j** and **Cypher**. Rather than utilizing traditional relational or document tables, all college entities (Students, Courses, Clubs, Campus Events, and Interests) and their relationships are modeled and traversed as first-class graph elements.

---

## 🏛️ System Architecture

```mermaid
graph TD
    subgraph Client Layer [React 18 + Vite Frontend]
        Auth[AuthContext & JWT Session]
        Dir[Student Directory & Search]
        Profile[Profile & Edit Modal]
        Dashboard[Dashboard & Feeds]
        Cyto[Cytoscape.js Graph Engine]
    end

    subgraph Security Layer [Express Security & Auth]
        Validator[Express Validator Middleware]
        JWTAuth[JWT Bearer Middleware]
        Bcrypt[Bcrypt Password Hashing]
        RBAC[Ownership & 403 Guard]
    end

    subgraph Service & Controller Layer
        AuthCtrl[Auth Controller & Service]
        StudentCtrl[Student Profile Controller & Service]
        SchemaCtrl[Schema & Constraints Service]
    end

    subgraph Database Layer [Neo4j Native Graph Engine]
        Driver[Neo4j Driver 5.x Connection Pool]
        Neo4j[(Neo4j 5.x - Bolt 7687)]
    end

    Client Layer -->|REST with Bearer Token| Security Layer
    Security Layer --> Service & Controller Layer
    Service & Controller Layer --> Driver
    Driver -->|Cypher Queries| Neo4j
```

---

## 🔑 Key Week 2 Implementation Highlights

1. **JWT-Based Authentication Workflow**:
   - Secure student registration with password hashing using `bcryptjs` (salt rounds: 10).
   - Generates signed HMAC-SHA256 JWT tokens containing `studentId`, `email`, and `role`.
   - Client stores token in `localStorage` and automatically attaches `Authorization: Bearer <token>` through an Axios request interceptor.
   - Protected routes use `authenticateJWT` middleware to verify signature, check expiration, and populate `req.user`.

2. **Security & Input Validation**:
   - Strict input validation via `express-validator` on email formats, password lengths, and year of study ranges (1–8).
   - **Zero Plaintext Credentials**: Passwords are never saved unhashed.
   - **Zero Password Hash Exposure**: API queries and sanitizers permanently strip `passwordHash` before sending responses.
   - **Profile Ownership Enforcement**: A student can only edit their own profile (`req.user.studentId === req.params.id`). Any attempt to modify another student's node returns `403 Forbidden`.

3. **Student Profile & Graph Directory Management**:
   - **View Own Profile**: Returns the student's attributes plus graph neighborhood (courses enrolled `[:STUDIES]`, clubs joined `[:MEMBER_OF]`, events participating in `[:PARTICIPATES_IN]`, interests `[:HAS_INTEREST]`, and friends `[:FRIENDS_WITH]`).
   - **View Peer Profile**: Cleanly inspect other students' academic profiles without granting modification privileges.
   - **Update Profile & Interests**: Dynamically modifies student node properties in Neo4j and rewires `[:HAS_INTEREST]` relationships.
   - **Student Directory**: Multi-criteria search by student name or ID, with combined filtering by department and year of study.

---

## 📊 Neo4j Cypher Queries Used for Student Operations

### 1. Student Registration & Interest Graph Linking
```cypher
MATCH (s:Student)
WHERE s.studentId = $studentId OR s.email = $email
RETURN s.studentId AS existingId, s.email AS existingEmail;

CREATE (s:Student {
  studentId: $studentId,
  name: $name,
  email: $email,
  department: $department,
  yearOfStudy: toInteger($yearOfStudy),
  bio: $bio,
  profileImageUrl: $profileImageUrl,
  passwordHash: $passwordHash,
  role: 'student',
  status: 'active',
  fraudRiskScore: 0.0,
  createdAt: datetime(),
  updatedAt: datetime()
})
WITH s
FOREACH (interestName IN $interests |
  MERGE (i:Interest {name: trim(interestName)})
  ON CREATE SET i.category = 'General'
  MERGE (s)-[:HAS_INTEREST {assignedAt: datetime(), level: 'General'}]->(i)
)
RETURN s;
```

### 2. Student Authentication (Login)
```cypher
MATCH (s:Student {email: $email})
OPTIONAL MATCH (s)-[:HAS_INTEREST]->(i:Interest)
RETURN s, collect(DISTINCT i.name) AS interests;
```

### 3. Student Profile with Full Graph Neighborhood Traversal
```cypher
MATCH (s:Student {studentId: $studentId})

// Courses enrolled
OPTIONAL MATCH (s)-[r_studies:STUDIES]->(c:Course)
WITH s, collect(DISTINCT {
  courseCode: c.courseCode,
  courseName: c.courseName,
  department: c.department,
  credits: c.credits,
  semester: r_studies.semester
}) AS courses

// Clubs
OPTIONAL MATCH (s)-[r_member:MEMBER_OF]->(cl:Club)
WITH s, courses, collect(DISTINCT {
  clubId: cl.clubId,
  name: cl.name,
  category: cl.category,
  role: r_member.role
}) AS clubs

// Events
OPTIONAL MATCH (s)-[r_part:PARTICIPATES_IN]->(e:Event)
WITH s, courses, clubs, collect(DISTINCT {
  eventId: e.eventId,
  title: e.title,
  date: e.date,
  location: e.location
}) AS events

// Interests
OPTIONAL MATCH (s)-[:HAS_INTEREST]->(i:Interest)
WITH s, courses, clubs, events, collect(DISTINCT i.name) AS interests

// Friends
OPTIONAL MATCH (s)-[:FRIENDS_WITH]-(f:Student)
WITH s, courses, clubs, events, interests, collect(DISTINCT {
  studentId: f.studentId,
  name: f.name,
  department: f.department,
  yearOfStudy: f.yearOfStudy,
  profileImageUrl: f.profileImageUrl
}) AS friends

// Following
OPTIONAL MATCH (s)-[:FOLLOWS]->(target:Student)
RETURN s, courses, clubs, events, interests, friends, following;
```

### 4. Updating Student Profile Node & Rewiring Graph Interests
```cypher
// Update student attributes
MATCH (s:Student {studentId: $studentId})
SET s.name = $name,
    s.department = $department,
    s.yearOfStudy = toInteger($yearOfStudy),
    s.bio = $bio,
    s.profileImageUrl = $profileImageUrl,
    s.updatedAt = datetime()
RETURN s;

// Rewire HAS_INTEREST edges
MATCH (s:Student {studentId: $studentId})-[r:HAS_INTEREST]->(:Interest)
DELETE r;

MATCH (s:Student {studentId: $studentId})
UNWIND $interests AS interestName
MERGE (i:Interest {name: trim(interestName)})
ON CREATE SET i.category = 'General'
MERGE (s)-[:HAS_INTEREST {assignedAt: datetime(), level: 'General'}]->(i);
```

### 5. Multi-Criteria Directory Search & Filter
```cypher
MATCH (s:Student)
WHERE (toLower(s.name) CONTAINS toLower($search) OR toLower(s.studentId) CONTAINS toLower($search))
  AND toLower(s.department) = toLower($department)
  AND s.yearOfStudy = toInteger($yearOfStudy)
OPTIONAL MATCH (s)-[:HAS_INTEREST]->(i:Interest)
OPTIONAL MATCH (s)-[:FRIENDS_WITH]-(f:Student)
WITH s, collect(DISTINCT i.name) AS interests, count(DISTINCT f) AS friendsCount
ORDER BY s.name ASC
SKIP $skip
LIMIT $limit
RETURN s, interests, friendsCount;
```

---

## 🧪 Testing Suite & Verification

Run the automated authentication, security, and profile verification suite:
```bash
npm run test:auth
```

**Test Suite Coverage**:
- ✅ Input Validation: Rejects malformed emails during registration with `400 Bad Request`.
- ✅ Input Validation: Rejects missing credentials during login with `400 Bad Request`.
- ✅ Protected Routes: Blocks unauthenticated access to `/api/students/me` with `401 Unauthorized`.
- ✅ JWT Verification: Rejects falsified/expired JWT signatures with `401 Unauthorized`.
- ✅ Authorization Security: Rejects student attempt to edit another student's profile node with `403 Forbidden`.
- ✅ Profile Validation: Validates acceptable `yearOfStudy` (1–8) range on profile updates.

---

## 🚀 Running the Application

### 1. Start Neo4j Database
```bash
docker compose up -d
```
*(Or start Neo4j Desktop / Neo4j Aura cloud and verify credentials in `backend/.env`)*

### 2. Seed Sample Database
```bash
npm run db:init
npm run db:seed
```

### 3. Start Backend & Frontend
In terminal 1:
```bash
npm run dev:backend
```
In terminal 2:
```bash
npm run dev:frontend
```
Frontend runs at: [http://localhost:5173](http://localhost:5173)  
Backend API runs at: [http://localhost:5000](http://localhost:5000)

---

## 🔑 Pre-seeded Accounts for Testing

| Student Name | Email | Password | Department | Year |
| :--- | :--- | :--- | :--- | :--- |
| **Aarav Sharma** | `aarav.sharma@campus.edu` | `Password123!` | Computer Science | Year 3 |
| **Priya Patel** | `priya.patel@campus.edu` | `Password123!` | Data Science | Year 4 |
| **Rohan Gupta** | `rohan.gupta@campus.edu` | `Password123!` | Cybersecurity | Year 3 |
| **Ananya Deshmukh** | `ananya.deshmukh@campus.edu` | `Password123!` | Computer Science | Year 2 |
