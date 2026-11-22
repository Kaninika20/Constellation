import bcrypt from 'bcryptjs';
import { getSession, verifyConnection, closeDriver } from '../config/neo4j.config.js';
import { initializeSchema, synchronizeDepartmentRelationships } from '../services/schema.service.js';

const seedDatabase = async () => {
  console.log('--- Constellation Database Seeding ---');
  
  const conn = await verifyConnection();
  if (!conn.connected) {
    console.error('❌ Cannot seed: Neo4j connection failed.', conn.error);
    process.exit(1);
  }

  // 1. Ensure constraints are applied first
  console.log('Ensuring schema constraints...');
  await initializeSchema();

  const session = getSession();
  try {
    console.log('Clearing old sample data (if any)...');
    // Optional: Only clear if requested or clear all nodes
    await session.run(`
      MATCH (n)
      DETACH DELETE n
    `);

    console.log('Seeding Courses...');
    const courses = [
      { courseCode: 'CS101', courseName: 'Introduction to Computer Science', department: 'Computer Science', credits: 4 },
      { courseCode: 'CS302', courseName: 'Advanced Database Systems & Graph Theory', department: 'Computer Science', credits: 4 },
      { courseCode: 'DS201', courseName: 'Data Mining and Social Network Analytics', department: 'Data Science', credits: 3 },
      { courseCode: 'CYB304', courseName: 'Cybersecurity and Network Fraud Detection', department: 'Cybersecurity', credits: 3 },
      { courseCode: 'MATH205', courseName: 'Discrete Mathematics and Graph Algorithms', department: 'Mathematics', credits: 4 }
    ];

    for (const c of courses) {
      await session.run(`
        MERGE (c:Course {courseCode: $courseCode})
        SET c.courseName = $courseName,
            c.department = $department,
            c.credits = $credits,
            c.updatedAt = datetime()
      `, c);
    }

    console.log('Seeding Clubs...');
    const clubs = [
      { clubId: 'CLUB_ACM', name: 'ACM Student Chapter', category: 'Technical', description: 'Empowering students with algorithms, hackathons and tech talks.' },
      { clubId: 'CLUB_ROBO', name: 'Robotics & AI Innovation Lab', category: 'Engineering', description: 'Hands-on robotics hardware and machine learning systems.' },
      { clubId: 'CLUB_DEV', name: 'Web & Open Source Developers', category: 'Software', description: 'Full-stack building, open source contributions and peer coding.' },
      { clubId: 'CLUB_CYB', name: 'Campus Cybersecurity Alliance', category: 'Security', description: 'Ethical hacking, threat intelligence, and defense workshops.' }
    ];

    for (const cl of clubs) {
      await session.run(`
        MERGE (cl:Club {clubId: $clubId})
        ON CREATE SET cl.createdAt = datetime()
        SET cl.name = $name,
            cl.category = $category,
            cl.description = $description,
            cl.updatedAt = datetime()
      `, cl);
    }

    console.log('Seeding Events...');
    const events = [
      { eventId: 'EVT_HACK26', title: 'Campus Hackathon 2026', date: '2026-11-20', location: 'Science & Tech Auditorium', description: '36-hour multi-track graph and AI challenge.' },
      { eventId: 'EVT_GRAPH_WS', title: 'Neo4j Graph Database Workshop', date: '2026-11-25', location: 'Lab CS-301', description: 'Hands-on Cypher querying and graph data modeling.' },
      { eventId: 'EVT_CYBER_CTF', title: 'Inter-College CTF & Fraud Defense', date: '2026-12-05', location: 'Virtual Arena', description: 'Defending networks against sybil attacks and identity spoofing.' },
      { eventId: 'EVT_ALUMNI_CON', title: 'Tech Career & Alumni Connect', date: '2026-12-12', location: 'Campus Convention Center', description: 'Mentorship and networking with industry alumni.' }
    ];

    for (const e of events) {
      await session.run(`
        MERGE (e:Event {eventId: $eventId})
        SET e.title = $title,
            e.date = $date,
            e.location = $location,
            e.description = $description,
            e.updatedAt = datetime()
      `, e);
    }

    console.log('Seeding Interests...');
    const interests = [
      { name: 'Graph Databases', category: 'Databases' },
      { name: 'Machine Learning', category: 'AI' },
      { name: 'Fraud Detection', category: 'Security' },
      { name: 'Full-Stack Development', category: 'Engineering' },
      { name: 'Cybersecurity', category: 'Security' },
      { name: 'Cloud Computing', category: 'Infrastructure' },
      { name: 'Competitive Programming', category: 'Algorithms' },
      { name: 'UI/UX Design', category: 'Design' },
      { name: 'Data Mining', category: 'Data Science' }
    ];

    for (const i of interests) {
      await session.run(`
        MERGE (i:Interest {name: $name})
        SET i.category = $category
      `, i);
    }

    console.log('Seeding Students with bcrypt passwords...');
    const salt = await bcrypt.genSalt(10);
    const defaultPasswordHash = await bcrypt.hash('Password123!', salt);

    const students = [
      {
        studentId: 'STU2026001',
        name: 'Aarav Sharma',
        email: 'aarav.sharma@campus.edu',
        department: 'Computer Science',
        yearOfStudy: 3,
        bio: 'Passionate about graph analytics, Neo4j, and building social network algorithms.',
        profileImageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&fit=crop&crop=faces',
        fraudRiskScore: 0.05
      },
      {
        studentId: 'STU2026002',
        name: 'Priya Patel',
        email: 'priya.patel@campus.edu',
        department: 'Data Science',
        yearOfStudy: 4,
        bio: 'Researcher in graph neural networks, anomaly detection, and academic community detection.',
        profileImageUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&fit=crop&crop=faces',
        fraudRiskScore: 0.02
      },
      {
        studentId: 'STU2026003',
        name: 'Rohan Gupta',
        email: 'rohan.gupta@campus.edu',
        department: 'Cybersecurity',
        yearOfStudy: 3,
        bio: 'Ethical hacker and security enthusiast focusing on Sybil cluster detection in social graphs.',
        profileImageUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&fit=crop&crop=faces',
        fraudRiskScore: 0.08
      },
      {
        studentId: 'STU2026004',
        name: 'Ananya Deshmukh',
        email: 'ananya.deshmukh@campus.edu',
        department: 'Computer Science',
        yearOfStudy: 2,
        bio: 'Full-stack developer building modern React apps, Tailwind layouts, and interactive graph views.',
        profileImageUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&fit=crop&crop=faces',
        fraudRiskScore: 0.01
      },
      {
        studentId: 'STU2026005',
        name: 'Vikram Verma',
        email: 'vikram.verma@campus.edu',
        department: 'Information Technology',
        yearOfStudy: 4,
        bio: 'President of Web & Dev Club. Interested in scalable microservices and database clustering.',
        profileImageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&fit=crop&crop=faces',
        fraudRiskScore: 0.04
      },
      {
        studentId: 'STU2026999',
        name: 'Bot_Account_Alert',
        email: 'synthetic.bot@disposable.org',
        department: 'Unknown',
        yearOfStudy: 1,
        bio: 'Suspicious profile with abnormal rapid connection attempts and no academic verification.',
        profileImageUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&fit=crop&crop=faces',
        fraudRiskScore: 0.88 // flagged high risk for future fraud detection demonstration!
      }
    ];

    for (const s of students) {
      await session.run(`
        MERGE (s:Student {studentId: $studentId})
        SET s.name = $name,
            s.email = $email,
            s.department = $department,
            s.yearOfStudy = $yearOfStudy,
            s.bio = $bio,
            s.profileImageUrl = $profileImageUrl,
            s.passwordHash = $passwordHash,
            s.role = 'student',
            s.status = 'active',
            s.fraudRiskScore = $fraudRiskScore,
            s.createdAt = datetime(),
            s.updatedAt = datetime()
      `, {
        ...s,
        passwordHash: defaultPasswordHash
      });
    }

    await synchronizeDepartmentRelationships(session);

    console.log('Connecting Relationships...');
    
    // 1. STUDIES (Student -> Course)
    const studies = [
      { studentId: 'STU2026001', courseCode: 'CS302', semester: 'Fall 2026' },
      { studentId: 'STU2026001', courseCode: 'DS201', semester: 'Fall 2026' },
      { studentId: 'STU2026002', courseCode: 'DS201', semester: 'Fall 2026' },
      { studentId: 'STU2026002', courseCode: 'CS302', semester: 'Fall 2026' },
      { studentId: 'STU2026003', courseCode: 'CYB304', semester: 'Fall 2026' },
      { studentId: 'STU2026004', courseCode: 'CS101', semester: 'Fall 2026' },
      { studentId: 'STU2026004', courseCode: 'MATH205', semester: 'Fall 2026' },
      { studentId: 'STU2026005', courseCode: 'CS302', semester: 'Fall 2026' }
    ];

    for (const rel of studies) {
      await session.run(`
        MATCH (s:Student {studentId: $studentId})
        MATCH (c:Course {courseCode: $courseCode})
        MERGE (s)-[r:STUDIES]->(c)
        SET r.semester = $semester, r.enrolledAt = datetime()
      `, rel);
    }

    // 2. FRIENDS_WITH (Student <-> Student)
    const friendships = [
      { s1: 'STU2026001', s2: 'STU2026002' },
      { s1: 'STU2026001', s2: 'STU2026003' },
      { s1: 'STU2026002', s2: 'STU2026004' },
      { s1: 'STU2026003', s2: 'STU2026005' },
      { s1: 'STU2026004', s2: 'STU2026005' }
    ];

    for (const rel of friendships) {
      await session.run(`
        MATCH (s1:Student {studentId: $s1})
        MATCH (s2:Student {studentId: $s2})
        MERGE (s1)-[r:FRIENDS_WITH]-(s2)
        SET r.since = '2025-08-15', r.status = 'accepted'
      `, rel);
    }

    // 3. FOLLOWS (Student -> Student)
    const follows = [
      { follower: 'STU2026004', following: 'STU2026001' },
      { follower: 'STU2026003', following: 'STU2026002' },
      { follower: 'STU2026005', following: 'STU2026001' },
      { follower: 'STU2026999', following: 'STU2026001' },
      { follower: 'STU2026999', following: 'STU2026002' },
      { follower: 'STU2026999', following: 'STU2026003' }
    ];

    for (const rel of follows) {
      await session.run(`
        MATCH (f:Student {studentId: $follower})
        MATCH (t:Student {studentId: $following})
        MERGE (f)-[r:FOLLOWS]->(t)
        SET r.createdAt = datetime()
      `, rel);
    }

    // 4. MEMBER_OF (Student -> Club)
    const memberships = [
      { studentId: 'STU2026001', clubId: 'CLUB_ACM', role: 'Vice Lead' },
      { studentId: 'STU2026002', clubId: 'CLUB_ROBO', role: 'Research Lead' },
      { studentId: 'STU2026003', clubId: 'CLUB_CYB', role: 'Security Auditor' },
      { studentId: 'STU2026004', clubId: 'CLUB_DEV', role: 'UI Lead' },
      { studentId: 'STU2026005', clubId: 'CLUB_DEV', role: 'President' }
    ];

    for (const rel of memberships) {
      await session.run(`
        MATCH (s:Student {studentId: $studentId})
        MATCH (cl:Club {clubId: $clubId})
        MERGE (s)-[r:MEMBER_OF]->(cl)
        SET r.role = $role, r.joinedDate = '2025-09-01'
      `, rel);
    }

    // 5. PARTICIPATES_IN (Student -> Event)
    const eventParticipation = [
      { studentId: 'STU2026001', eventId: 'EVT_HACK26' },
      { studentId: 'STU2026001', eventId: 'EVT_GRAPH_WS' },
      { studentId: 'STU2026002', eventId: 'EVT_HACK26' },
      { studentId: 'STU2026003', eventId: 'EVT_CYBER_CTF' },
      { studentId: 'STU2026004', eventId: 'EVT_GRAPH_WS' },
      { studentId: 'STU2026005', eventId: 'EVT_ALUMNI_CON' }
    ];

    for (const rel of eventParticipation) {
      await session.run(`
        MATCH (s:Student {studentId: $studentId})
        MATCH (e:Event {eventId: $eventId})
        MERGE (s)-[r:PARTICIPATES_IN]->(e)
        SET r.registrationDate = datetime(), r.status = 'confirmed'
      `, rel);
    }

    // 6. HAS_INTEREST (Student -> Interest)
    const studentInterests = [
      { studentId: 'STU2026001', interest: 'Graph Databases' },
      { studentId: 'STU2026001', interest: 'Machine Learning' },
      { studentId: 'STU2026002', interest: 'Data Mining' },
      { studentId: 'STU2026002', interest: 'Fraud Detection' },
      { studentId: 'STU2026003', interest: 'Cybersecurity' },
      { studentId: 'STU2026003', interest: 'Fraud Detection' },
      { studentId: 'STU2026004', interest: 'UI/UX Design' },
      { studentId: 'STU2026004', interest: 'Full-Stack Development' },
      { studentId: 'STU2026005', interest: 'Full-Stack Development' },
      { studentId: 'STU2026005', interest: 'Cloud Computing' }
    ];

    for (const rel of studentInterests) {
      await session.run(`
        MATCH (s:Student {studentId: $studentId})
        MATCH (i:Interest {name: $interest})
        MERGE (s)-[r:HAS_INTEREST]->(i)
        SET r.level = 'Advanced'
      `, rel);
    }

    console.log('✅ Seeding completed successfully!');
    console.log('Default login test accounts:');
    console.log(' - Email: aarav.sharma@campus.edu | Password: Password123!');
    console.log(' - Email: priya.patel@campus.edu  | Password: Password123!');
    console.log(' - Email: rohan.gupta@campus.edu  | Password: Password123!');
  } finally {
    await session.close();
    await closeDriver();
  }
};

seedDatabase().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});

