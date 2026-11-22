import { getSession, closeDriver } from '../config/neo4j.config.js';
import { initializeSchema } from '../services/schema.service.js';

const demoAccounts = Array.from({ length: 6 }, (_, index) => {
  const suffix = String(index + 1).padStart(3, '0');
  return {
    studentId: `DEMO_RISK_${suffix}`,
    name: `Demo Risk Account ${index + 1}`,
    email: `demo-risk-${suffix}@example.invalid`,
    department: 'Demo Network',
    yearOfStudy: 1,
    bio: 'Synthetic demo-only account. This is not a real fraud finding.',
    riskIndicators: ['Synthetic demo risk flag'],
    riskIndicatorDetails: JSON.stringify([{
      rule: 'demo_fixture',
      label: 'Synthetic demo risk flag',
      description: 'Synthetic demo risk flag',
      detail: 'Demo-only fixture; not a real fraud finding.',
      points: 88
    }])
  };
});

const seedDemoFraudNetwork = async () => {
  const schema = await initializeSchema();
  if (schema.errors.length) {
    throw new Error(`Schema initialization failed: ${schema.errors.map(item => item.error).join('; ')}`);
  }

  const session = getSession();
  try {
    for (const account of demoAccounts) {
      await session.run(`
        MERGE (s:Student {studentId: $studentId})
        ON CREATE SET s.createdAt = datetime() - duration({days: 14})
        SET s.name = $name,
            s.email = $email,
            s.department = $department,
            s.yearOfStudy = $yearOfStudy,
            s.bio = $bio,
            s.role = 'student',
            s.status = 'active',
            s.riskScore = 88,
            s.fraudRiskScore = 0.88,
            s.riskLevel = 'High',
            s.riskCategory = 'High',
            s.riskIndicators = $riskIndicators,
            s.riskIndicatorDetails = $riskIndicatorDetails,
            s.riskAnalyzedAt = datetime(),
            s.updatedAt = datetime()
        MERGE (d:Department {name: $department})
        MERGE (s)-[:BELONGS_TO]->(d)
      `, account);
    }

    for (let sourceIndex = 0; sourceIndex < demoAccounts.length; sourceIndex++) {
      for (let targetIndex = sourceIndex + 1; targetIndex < demoAccounts.length; targetIndex++) {
        await session.run(`
          MATCH (a:Student {studentId: $sourceId})
          MATCH (b:Student {studentId: $targetId})
          MERGE (a)-[r:FRIENDS_WITH]-(b)
          ON CREATE SET r.createdAt = datetime() - duration({hours: 2}),
                        r.since = datetime() - duration({hours: 2})
        `, {
          sourceId: demoAccounts[sourceIndex].studentId,
          targetId: demoAccounts[targetIndex].studentId
        });
      }
    }
  } finally {
    await session.close();
  }
};

seedDemoFraudNetwork()
  .then(() => {
    console.log(`Created or refreshed ${demoAccounts.length} synthetic demo accounts and their isolated friendship cluster.`);
    console.log('The accounts have no login credentials and do not represent real fraud findings.');
  })
  .catch(error => {
    console.error('[Demo fraud fixture] Failed:', error.message);
    process.exitCode = 1;
  })
  .finally(closeDriver);
