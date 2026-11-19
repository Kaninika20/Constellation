import { initializeSchema, getSchemaStatus } from '../services/schema.service.js';
import { verifyConnection, closeDriver } from '../config/neo4j.config.js';

const run = async () => {
  console.log('--- Neo4j Database Schema Initialization ---');
  console.log('Connecting to Neo4j...');

  const conn = await verifyConnection();
  if (!conn.connected) {
    console.error('❌ Connection Failed:', conn.error);
    console.error('Hint:', conn.hint);
    process.exit(1);
  }

  console.log(`✅ Connected to Neo4j at ${conn.uri} (${conn.database})`);
  console.log('Applying uniqueness constraints and performance indexes...');

  const results = await initializeSchema();

  console.log('\n--- Constraints Applied ---');
  results.constraintsApplied.forEach(c => {
    console.log(` ✓ [Constraint] ${c.name} on (${c.label}.${c.property})`);
  });

  console.log('\n--- Indexes Applied ---');
  results.indexesApplied.forEach(i => {
    console.log(` ✓ [Index] ${i.name} on (${i.label}.${i.property})`);
  });

  if (results.errors.length > 0) {
    console.warn('\n⚠️ Some items encountered issues:');
    results.errors.forEach(e => console.warn(` - [${e.type}] ${e.target}: ${e.error}`));
  }

  const status = await getSchemaStatus();
  console.log('\n--- Current Schema State ---');
  console.log('Node Counts:', JSON.stringify(status.nodeCounts, null, 2));
  console.log('Relationship Counts:', JSON.stringify(status.relCounts, null, 2));

  await closeDriver();
  console.log('\n✅ Schema initialization complete.');
  process.exit(0);
};

run().catch(async (err) => {
  console.error('Fatal initialization error:', err);
  await closeDriver();
  process.exit(1);
});

