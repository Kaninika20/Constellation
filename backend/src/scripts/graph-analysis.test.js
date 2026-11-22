import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RISK_CONFIG, detectCommunities, scoreSuspiciousActivity } from '../services/graph-analysis.js';

const now = new Date('2026-11-20T00:00:00.000Z');
const oldDate = '2026-10-01T00:00:00.000Z';
const recentDate = '2026-11-19T23:30:00.000Z';

const makeStudent = (studentId, activity = true, createdAt = oldDate) => ({
  studentId,
  name: studentId,
  department: 'Computer Science',
  createdAt,
  courseCount: activity ? 1 : 0,
  clubCount: activity ? 1 : 0,
  interestCount: activity ? 1 : 0
});

const connectClique = (ids, since = oldDate) =>
  ids.flatMap((source, index) =>
    ids.slice(index + 1).map(target => ({ source, target, since }))
  );

const createSyntheticNetwork = () => {
  const normalIds = ['NORMAL_A', 'NORMAL_B', 'NORMAL_C', 'NORMAL_D'];
  const coordinatedIds = ['GROUP_A', 'GROUP_B', 'GROUP_C', 'GROUP_D'];
  const popularId = 'POPULAR_STUDENT';
  const lowConnectionId = 'LOW_CONNECTION_STUDENT';
  const leafIds = Array.from({ length: 32 }, (_, index) => `LEAF_${String(index).padStart(2, '0')}`);
  const students = [
    ...normalIds.map(id => makeStudent(id)),
    ...coordinatedIds.map(id => makeStudent(id, false)),
    makeStudent(popularId),
    makeStudent(lowConnectionId, false),
    ...leafIds.map(id => makeStudent(id))
  ];
  const friendships = [
    ...connectClique(normalIds),
    ...connectClique(coordinatedIds, recentDate),
    ...leafIds.map(target => ({ source: popularId, target, createdAt: recentDate }))
  ];
  const follows = leafIds.slice(0, 10).map(target => ({ source: popularId, target }));
  return { students, friendships, follows, normalIds, coordinatedIds, popularId, lowConnectionId };
};

test('label propagation separates disconnected groups and keeps isolated students', () => {
  const students = ['A', 'B', 'C', 'D', 'E'].map(id => makeStudent(id));
  const result = detectCommunities(students, [
    ...connectClique(['A', 'B', 'C']),
    { source: 'D', target: 'E', since: oldDate }
  ]);
  assert.equal(result.algorithm, 'label-propagation');
  assert.deepEqual(result.communities.map(community => community.size), [3, 2]);
  assert.equal(result.communities.flatMap(community => community.members).length, students.length);
});

test('label propagation combines friendship, academic, and follow connections', () => {
  const students = ['A', 'B', 'C', 'D'].map(id => makeStudent(id));
  const result = detectCommunities(
    students,
    [{ source: 'A', target: 'B' }],
    30,
    [
      { source: 'B', target: 'C', type: 'FOLLOWS' },
      { source: 'C', target: 'D', type: 'STUDIES' }
    ]
  );

  assert.equal(result.communities.length, 1);
  assert.equal(result.communities[0].size, 4);
  assert.ok(result.edges.some(edge => edge.types.includes('STUDIES')));
  assert.equal(result.friendships.length, 1);
});

test('academic community links do not inflate friendship-based risk metrics', () => {
  const students = [makeStudent('A'), makeStudent('B')];
  const results = scoreSuspiciousActivity({
    students,
    friendships: [],
    communityEdges: [{ source: 'A', target: 'B', type: 'STUDIES' }],
    now
  });

  assert.deepEqual(results.map(student => student.friendCount), [0, 0]);
});

test('synthetic normal students avoid high risk while suspicious patterns are explained', () => {
  const network = createSyntheticNetwork();
  const results = scoreSuspiciousActivity({ ...network, now });
  const byId = new Map(results.map(student => [student.studentId, student]));

  assert.equal(network.normalIds.filter(id => byId.get(id).riskLevel === 'High').length, 0);
  assert.equal(byId.get(network.popularId).riskLevel, 'High');
  assert.deepEqual(
    byId.get(network.popularId).riskIndicators.map(indicator => indicator.rule),
    ['high_friend_count', 'rapid_growth', 'unusual_relationship_structure']
  );
  assert.ok(byId.get(network.coordinatedIds[0]).riskIndicators.some(
    indicator => indicator.rule === 'dense_low_engagement_group'
  ));
  assert.ok(byId.get(network.lowConnectionId).riskIndicators.some(
    indicator => indicator.rule === 'few_meaningful_connections'
  ));
  assert.equal(byId.get(network.lowConnectionId).riskLevel, 'Low');
});

test('risk thresholds can be configured without exceeding the score range', () => {
  const network = createSyntheticNetwork();
  const config = { ...DEFAULT_RISK_CONFIG, highFriendCount: 40, rapidFriendCount: 50 };
  const results = scoreSuspiciousActivity({ ...network, now, config });
  const popular = results.find(student => student.studentId === network.popularId);
  assert.equal(popular.riskIndicators.some(indicator => indicator.rule === 'high_friend_count'), false);
  assert.ok(popular.riskScore <= 100);
});
