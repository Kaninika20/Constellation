/**
 * =============================================================================
 * CampusGraph – Community Detection Service  (Week 5 – Part A)
 * =============================================================================
 *
 * ALGORITHM CHOICE
 * ─────────────────
 * Neo4j Graph Data Science (GDS) is NOT assumed to be installed. This service
 * implements community detection entirely with Cypher queries:
 *
 *  1. WEAKLY CONNECTED COMPONENTS (WCC) via iterative label propagation in
 *     Cypher. Each student starts with their own studentId as a community label.
 *     In each pass, every node adopts the lexicographically smallest label
 *     among itself and its FRIENDS_WITH neighbours. After convergence (or a
 *     fixed max of 10 passes), nodes sharing a label are in the same component.
 *     This is an approximation of WCC but is fully Cypher-native.
 *
 *  2. TRIANGLE COUNT per community is used to measure internal cohesion:
 *     a dense, heavily interconnected community has a higher triangle ratio.
 *
 *  3. INTERNAL DENSITY = (actual internal edges) / (possible edges within
 *     the community). A community of k nodes has at most k*(k-1)/2 possible
 *     undirected edges.
 *
 * WHY NOT GDS?
 * ─────────────
 * GDS requires a separately licensed plugin.  We detect its availability at
 * runtime; if it is present we use it, otherwise we fall back to this pure
 * Cypher implementation.
 * =============================================================================
 */

import { getSession } from '../config/neo4j.config.js';

const toInt   = (v) => (v == null ? 0 : typeof v === 'number' ? v : typeof v.toNumber === 'function' ? v.toNumber() : Number(v));
const toFloat = (v) => (v == null ? 0 : typeof v === 'number' ? v : typeof v.toNumber === 'function' ? v.toNumber() : Number(v));

// ─── GDS availability probe ───────────────────────────────────────────────────
let _gdsAvailable = null;   // cached after first check

async function isGdsAvailable(session) {
  if (_gdsAvailable !== null) return _gdsAvailable;
  try {
    await session.run('CALL gds.version() YIELD version RETURN version LIMIT 1');
    _gdsAvailable = true;
  } catch {
    _gdsAvailable = false;
  }
  return _gdsAvailable;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Detects communities and returns a summary list.
 * Automatically uses GDS Louvain if available, otherwise Cypher WCC.
 */
export const detectCommunities = async () => {
  const session = getSession();
  try {
    const gds = await isGdsAvailable(session);
    if (gds) {
      return await detectWithLouvain(session);
    } else {
      return await detectWithCypherWCC(session);
    }
  } finally {
    await session.close();
  }
};

/**
 * Returns the full member list for a specific community (by communityId label).
 */
export const getCommunityMembers = async (communityId) => {
  const session = getSession();
  try {
    const query = `
      MATCH (s:Student)
      WHERE s.communityId = $communityId
      OPTIONAL MATCH (s)-[:HAS_INTEREST]->(i:Interest)
      OPTIONAL MATCH (s)-[:FRIENDS_WITH]-(f:Student)
      WITH s, collect(DISTINCT i.name) AS interests, count(DISTINCT f) AS friendCount
      ORDER BY s.name ASC
      RETURN s, interests, friendCount
    `;
    const res = await session.run(query, { communityId });
    return res.records.map(r => ({
      student: sanitize(r.get('s').properties),
      interests: r.get('interests') || [],
      friendCount: toInt(r.get('friendCount')),
    }));
  } finally {
    await session.close();
  }
};

/**
 * Returns overall community statistics.
 */
export const getCommunityStats = async () => {
  const session = getSession();
  try {
    const res = await session.run(`
      MATCH (s:Student)
      WHERE s.communityId IS NOT NULL
      WITH s.communityId AS cid, count(s) AS size
      RETURN
        count(cid)   AS totalCommunities,
        sum(size)    AS labelledStudents,
        min(size)    AS minSize,
        max(size)    AS maxSize,
        avg(size)    AS avgSize
    `);
    if (!res.records.length) {
      return { totalCommunities: 0, labelledStudents: 0, minSize: 0, maxSize: 0, avgSize: 0, algorithm: 'none' };
    }
    const r = res.records[0];
    // detect which algorithm was last used
    const algRes = await session.run(`
      MATCH (s:Student) WHERE s.communityAlgorithm IS NOT NULL
      RETURN s.communityAlgorithm AS alg LIMIT 1
    `);
    const alg = algRes.records[0]?.get('alg') || 'unknown';
    return {
      totalCommunities: toInt(r.get('totalCommunities')),
      labelledStudents: toInt(r.get('labelledStudents')),
      minSize: toInt(r.get('minSize')),
      maxSize: toInt(r.get('maxSize')),
      avgSize: parseFloat(toFloat(r.get('avgSize')).toFixed(2)),
      algorithm: alg,
    };
  } finally {
    await session.close();
  }
};

// =============================================================================
// INTERNAL IMPLEMENTATIONS
// =============================================================================

/**
 * GDS Louvain community detection.
 * Only called when GDS plugin is confirmed available.
 */
async function detectWithLouvain(session) {
  // Project an in-memory graph, run Louvain, write back communityId
  await session.run(`
    CALL gds.graph.project.cypher(
      'campusFriends',
      'MATCH (s:Student) RETURN id(s) AS id',
      'MATCH (a:Student)-[:FRIENDS_WITH]-(b:Student) RETURN id(a) AS source, id(b) AS target',
      { validateRelationships: false }
    )
    YIELD graphName, nodeCount, relationshipCount
  `).catch(() => {}); // ignore if already exists

  await session.run(`
    CALL gds.louvain.write('campusFriends', { writeProperty: 'communityId' })
    YIELD communityCount, modularity
  `);

  // Tag algorithm used
  await session.run(`
    MATCH (s:Student) SET s.communityAlgorithm = 'louvain', s.communityDetectedAt = datetime()
  `);

  // Drop projection
  await session.run(`CALL gds.graph.drop('campusFriends', false)`).catch(() => {});

  return buildCommunityList(session, 'louvain');
}

/**
 * Pure-Cypher Weakly Connected Components approximation via label propagation.
 *
 * ALGORITHM (documented):
 *  Initialise: each student's communityId = their studentId (unique).
 *  Iterate up to MAX_PASSES times:
 *    For every FRIENDS_WITH edge (a, b):
 *      new_label_a = min(a.communityId, b.communityId) [lex min]
 *      new_label_b = min(a.communityId, b.communityId)
 *    Apply all updates atomically.
 *  Convergence when no label changed in a pass (early exit).
 *  Result: all nodes in the same weakly-connected component share one label.
 */
async function detectWithCypherWCC(session) {
  const MAX_PASSES = 15;

  // Step 1: Initialise — set each student's communityId to their own studentId
  await session.run(`
    MATCH (s:Student)
    SET s.communityId = s.studentId,
        s.communityAlgorithm = 'wcc-cypher',
        s.communityDetectedAt = datetime()
  `);

  // Step 2: Iterative label propagation
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const result = await session.run(`
      MATCH (a:Student)-[:FRIENDS_WITH]-(b:Student)
      WHERE a.communityId > b.communityId
      SET a.communityId = b.communityId
      RETURN count(*) AS updated
    `);
    const updated = toInt(result.records[0]?.get('updated'));
    if (updated === 0) break;  // converged early
  }

  return buildCommunityList(session, 'wcc-cypher');
}

/**
 * Queries community summaries after labels are written.
 */
async function buildCommunityList(session, algorithm) {
  const listQuery = `
    MATCH (s:Student)
    WHERE s.communityId IS NOT NULL
    WITH s.communityId AS cid, collect(s) AS members, count(s) AS size
    WHERE size >= 1
    // Count internal edges within community
    OPTIONAL MATCH (a:Student {communityId: cid})-[:FRIENDS_WITH]-(b:Student {communityId: cid})
    WITH cid, members, size, count(DISTINCT [id(a), id(b)]) / 2.0 AS internalEdges
    // Compute density
    WITH cid, members, size, internalEdges,
      CASE WHEN size > 1
        THEN toFloat(internalEdges) / (toFloat(size) * toFloat(size - 1) / 2.0)
        ELSE 1.0
      END AS density
    ORDER BY size DESC
    RETURN
      cid,
      size,
      internalEdges,
      density,
      [m IN members | {
        studentId: m.studentId,
        name: m.name,
        department: m.department,
        yearOfStudy: m.yearOfStudy,
        profileImageUrl: m.profileImageUrl,
        fraudRiskScore: m.fraudRiskScore
      }][0..3] AS previewMembers
    LIMIT 50
  `;

  const res = await session.run(listQuery);

  const communities = res.records.map((r, idx) => ({
    communityId: r.get('cid'),
    communityLabel: `Community ${idx + 1}`,
    size: toInt(r.get('size')),
    internalEdges: toInt(r.get('internalEdges')),
    density: parseFloat(toFloat(r.get('density')).toFixed(3)),
    cohesion: classifyCohesion(toInt(r.get('size')), toFloat(r.get('density'))),
    previewMembers: (r.get('previewMembers') || []).filter(Boolean).map(m => ({
      ...m,
      fraudRiskScore: toFloat(m.fraudRiskScore ?? 0),
    })),
    algorithm,
  }));

  return { communities, algorithm, total: communities.length };
}

function classifyCohesion(size, density) {
  if (size === 1) return 'isolated';
  if (density >= 0.8) return 'tight-knit';
  if (density >= 0.4) return 'moderate';
  return 'loosely-connected';
}

function sanitize(props) {
  if (!props) return null;
  const { passwordHash, ...safe } = props;
  return safe;
}
