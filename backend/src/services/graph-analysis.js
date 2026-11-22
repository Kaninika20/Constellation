export const DEFAULT_RISK_CONFIG = Object.freeze({
  highFriendCount: 30,
  highFriendPoints: 25,
  rapidFriendCount: 5,
  rapidWindowHours: 24,
  rapidGrowthPoints: 30,
  coordinatedGroupMinSize: 4,
  coordinatedDensityThreshold: 0.75,
  coordinatedInactivityRatio: 0.75,
  coordinatedGroupPoints: 25,
  fewFriendMaxCount: 1,
  fewConnectionsPoints: 15,
  minAccountAgeDays: 7,
  unusualMinFriendCount: 8,
  unusualMaxClustering: 0.1,
  unusualMaxReciprocity: 0.2,
  unusualRelationshipPoints: 25,
  mediumRiskThreshold: 30,
  highRiskThreshold: 60
});

const integerConfig = new Set([
  'highFriendCount',
  'highFriendPoints',
  'rapidFriendCount',
  'rapidWindowHours',
  'rapidGrowthPoints',
  'coordinatedGroupMinSize',
  'coordinatedGroupPoints',
  'fewFriendMaxCount',
  'fewConnectionsPoints',
  'minAccountAgeDays',
  'unusualMinFriendCount',
  'unusualRelationshipPoints',
  'mediumRiskThreshold',
  'highRiskThreshold'
]);

const configRanges = {
  highFriendCount: [1, 100000],
  highFriendPoints: [0, 100],
  rapidFriendCount: [1, 100000],
  rapidWindowHours: [1, 8760],
  rapidGrowthPoints: [0, 100],
  coordinatedGroupMinSize: [2, 100000],
  coordinatedDensityThreshold: [0, 1],
  coordinatedInactivityRatio: [0, 1],
  coordinatedGroupPoints: [0, 100],
  fewFriendMaxCount: [0, 100000],
  fewConnectionsPoints: [0, 100],
  minAccountAgeDays: [0, 36500],
  unusualMinFriendCount: [1, 100000],
  unusualMaxClustering: [0, 1],
  unusualMaxReciprocity: [0, 1],
  unusualRelationshipPoints: [0, 100],
  mediumRiskThreshold: [1, 99],
  highRiskThreshold: [2, 100]
};

export const validateRiskConfig = (overrides = {}) => {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    throw configError('Risk configuration must be an object.');
  }

  const unknownKeys = Object.keys(overrides).filter(
    key => !Object.prototype.hasOwnProperty.call(DEFAULT_RISK_CONFIG, key)
  );
  if (unknownKeys.length) {
    throw configError(`Unknown risk configuration field: ${unknownKeys[0]}.`);
  }

  const config = { ...DEFAULT_RISK_CONFIG };
  for (const [key, value] of Object.entries(overrides)) {
    const [min, max] = configRanges[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      throw configError(`${key} must be a number between ${min} and ${max}.`);
    }
    if (integerConfig.has(key) && !Number.isInteger(value)) {
      throw configError(`${key} must be an integer.`);
    }
    config[key] = value;
  }

  if (config.highRiskThreshold <= config.mediumRiskThreshold) {
    throw configError('highRiskThreshold must be greater than mediumRiskThreshold.');
  }

  return config;
};

function configError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

const normalizeEdges = (students, edges) => {
  const ids = new Set(students.map(student => student.studentId));
  const unique = new Map();
  for (const edge of edges) {
    const source = edge.source ?? edge.sourceId ?? edge.s1;
    const target = edge.target ?? edge.targetId ?? edge.s2;
    if (!ids.has(source) || !ids.has(target) || source === target) continue;
    const key = source < target ? `${source}\u0000${target}` : `${target}\u0000${source}`;
    const type = edge.type ?? edge.relationshipType;
    if (!unique.has(key)) {
      unique.set(key, { ...edge, source, target, types: type ? [type] : [] });
    } else if (type && !unique.get(key).types.includes(type)) {
      unique.get(key).types.push(type);
    }
  }
  return [...unique.values()];
};

export const detectCommunities = (students, friendships, maxIterations = 30, relationshipEdges = []) => {
  const ids = students.map(student => student.studentId).sort();
  const adjacency = new Map(ids.map(id => [id, new Set()]));
  const friendshipEdges = normalizeEdges(students, friendships);
  const edges = normalizeEdges(students, [...friendships, ...relationshipEdges]);
  for (const { source, target } of edges) {
    adjacency.get(source).add(target);
    adjacency.get(target).add(source);
  }

  let labels = new Map(ids.map(id => [id, id]));
  let iterations = 0;
  for (; iterations < maxIterations; iterations++) {
    const next = new Map();
    let changed = false;
    for (const id of ids) {
      const votes = new Map();
      votes.set(labels.get(id), 1);
      for (const neighbor of adjacency.get(id)) {
        const label = labels.get(neighbor);
        votes.set(label, (votes.get(label) || 0) + 1);
      }

      const winningLabel = [...votes.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
      next.set(id, winningLabel);
      if (winningLabel !== labels.get(id)) changed = true;
    }
    labels = next;
    if (!changed) {
      iterations++;
      break;
    }
  }

  const groups = new Map();
  for (const student of students) {
    const label = labels.get(student.studentId);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(student);
  }

  const communities = [...groups.values()].map(members => {
    const memberIds = new Set(members.map(member => member.studentId));
    const communityEdges = edges.filter(edge => memberIds.has(edge.source) && memberIds.has(edge.target));
    const possibleEdges = members.length * (members.length - 1) / 2;
    const density = possibleEdges ? communityEdges.length / possibleEdges : 0;
    const communityId = members.map(member => member.studentId).sort()[0];
    return {
      communityId,
      size: members.length,
      density: Number(density.toFixed(3)),
      internalEdges: communityEdges.length,
      members: [...members].sort((a, b) => a.studentId.localeCompare(b.studentId))
    };
  }).sort((a, b) => b.size - a.size || a.communityId.localeCompare(b.communityId));

  const communityByStudent = new Map();
  for (const community of communities) {
    community.members.forEach(member => communityByStudent.set(member.studentId, community));
  }

  return {
    algorithm: 'label-propagation',
    description: 'Deterministic label propagation over combined social and shared-campus relationships; a heuristic, not Louvain.',
    iterations,
    communities,
    communityByStudent,
    edges,
    friendships: friendshipEdges
  };
};

const timestampMillis = value => {
  if (!value) return null;
  const parsed = Date.parse(typeof value === 'string' ? value : value.toString?.());
  return Number.isFinite(parsed) ? parsed : null;
};

const hasEngagement = student =>
  (student.courseCount || 0) + (student.clubCount || 0) + (student.interestCount || 0) > 0;

export const scoreSuspiciousActivity = ({
  students,
  friendships,
  follows = [],
  communityEdges = [],
  now = new Date(),
  config: configOverrides = {}
}) => {
  const config = validateRiskConfig(configOverrides);
  const graph = detectCommunities(students, friendships, 30, communityEdges);
  const timestamp = now instanceof Date ? now.getTime() : Date.parse(now);
  const nowMillis = Number.isFinite(timestamp) ? timestamp : Date.now();
  const cutoff = nowMillis - config.rapidWindowHours * 60 * 60 * 1000;

  const metrics = new Map(students.map(student => [student.studentId, {
    ...student,
    friendIds: new Set(),
    followingIds: new Set(),
    followerIds: new Set(),
    recentFriendships: 0
  }]));
  for (const edge of graph.friendships) {
    const source = metrics.get(edge.source);
    const target = metrics.get(edge.target);
    source.friendIds.add(edge.target);
    target.friendIds.add(edge.source);
    const relationshipMillis = timestampMillis(edge.createdAt ?? edge.since);
    if (relationshipMillis !== null && relationshipMillis >= cutoff && relationshipMillis <= nowMillis) {
      source.recentFriendships++;
      target.recentFriendships++;
    }
  }
  const uniqueFollows = new Set();
  for (const edge of follows) {
    const sourceId = edge.source ?? edge.sourceId ?? edge.follower;
    const targetId = edge.target ?? edge.targetId ?? edge.following;
    const source = metrics.get(sourceId);
    const target = metrics.get(targetId);
    if (!source || !target || sourceId === targetId) continue;
    const key = `${sourceId}\u0000${targetId}`;
    if (uniqueFollows.has(key)) continue;
    uniqueFollows.add(key);
    source.followingIds.add(targetId);
    target.followerIds.add(sourceId);
  }

  const groupSummaries = new Map(graph.communities.map(community => {
    const inactiveMembers = community.members.filter(member => !hasEngagement(member)).length;
    return [community.communityId, {
      inactiveRatio: community.size ? inactiveMembers / community.size : 0
    }];
  }));
  const results = [];

  for (const student of students) {
    const data = metrics.get(student.studentId);
    const friendCount = data.friendIds.size;
    let triangles = 0;
    const friendIds = [...data.friendIds];
    for (let i = 0; i < friendIds.length; i++) {
      for (let j = i + 1; j < friendIds.length; j++) {
        if (metrics.get(friendIds[i])?.friendIds.has(friendIds[j])) triangles++;
      }
    }
    const possibleTriangles = friendCount * (friendCount - 1) / 2;
    const clusteringCoefficient = possibleTriangles ? triangles / possibleTriangles : 0;
    const followingCount = data.followingIds.size;
    const reciprocalCount = [...data.followingIds].filter(id => metrics.get(id)?.followingIds.has(student.studentId)).length;
    const reciprocityRatio = followingCount ? reciprocalCount / followingCount : 1;
    const community = graph.communityByStudent.get(student.studentId);
    const group = groupSummaries.get(community.communityId);
    const indicators = [];

    const addIndicator = (rule, description, points) => {
      indicators.push({ rule, description, points });
    };

    if (friendCount > config.highFriendCount) {
      addIndicator('high_friend_count', `${friendCount} confirmed friendships exceeds the configured threshold of ${config.highFriendCount}.`, config.highFriendPoints);
    }
    if (data.recentFriendships >= config.rapidFriendCount) {
      addIndicator('rapid_growth', `${data.recentFriendships} friendships were recorded in the last ${config.rapidWindowHours} hours.`, config.rapidGrowthPoints);
    }
    if (
      community.size >= config.coordinatedGroupMinSize &&
      community.density >= config.coordinatedDensityThreshold &&
      group.inactiveRatio >= config.coordinatedInactivityRatio
    ) {
      addIndicator(
        'dense_low_engagement_group',
        `Part of a dense group of ${community.size} accounts (${Math.round(community.density * 100)}% connection density) with limited recorded course, club, or interest activity.`,
        config.coordinatedGroupPoints
      );
    }

    const accountCreated = timestampMillis(student.createdAt);
    const accountAgeDays = accountCreated === null ? null : (nowMillis - accountCreated) / 86400000;
    if (
      friendCount <= config.fewFriendMaxCount &&
      !hasEngagement(student) &&
      accountAgeDays !== null &&
      accountAgeDays >= config.minAccountAgeDays
    ) {
      addIndicator('few_meaningful_connections', `Only ${friendCount} confirmed friendships and no recorded course, club, or interest activity after ${Math.floor(accountAgeDays)} days.`, config.fewConnectionsPoints);
    }
    if (
      friendCount >= config.unusualMinFriendCount &&
      clusteringCoefficient <= config.unusualMaxClustering &&
      followingCount > 0 &&
      reciprocityRatio <= config.unusualMaxReciprocity
    ) {
      addIndicator(
        'unusual_relationship_structure',
        `A sparse friendship neighborhood (clustering ${clusteringCoefficient.toFixed(2)}) and low follow reciprocity (${Math.round(reciprocityRatio * 100)}%).`,
        config.unusualRelationshipPoints
      );
    }

    const riskScore = Math.min(100, indicators.reduce((total, indicator) => total + indicator.points, 0));
    const riskLevel = riskScore >= config.highRiskThreshold
      ? 'High'
      : riskScore >= config.mediumRiskThreshold ? 'Medium' : 'Low';
    results.push({
      studentId: student.studentId,
      name: student.name,
      department: student.department,
      profileImageUrl: student.profileImageUrl,
      riskScore,
      fraudRiskScore: riskScore / 100,
      riskLevel,
      riskIndicators: indicators,
      friendCount,
      recentFriendships: data.recentFriendships,
      followingCount,
      followerCount: data.followerIds.size,
      courseCount: student.courseCount || 0,
      clubCount: student.clubCount || 0,
      interestCount: student.interestCount || 0,
      clusteringCoefficient: Number(clusteringCoefficient.toFixed(3)),
      reciprocityRatio: Number(reciprocityRatio.toFixed(3)),
      communityId: community.communityId
    });
  }

  return results.sort((a, b) => b.riskScore - a.riskScore || a.studentId.localeCompare(b.studentId));
};
