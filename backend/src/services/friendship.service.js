import { getSession } from '../config/neo4j.config.js';
import { sanitizeStudent } from './student.service.js';

/**
 * =============================================================================
 *  Friendship & Friend Request Management (Phase 3A)
 * =============================================================================
 *  Relationship model:
 *    (sender)-[:PENDING_FRIEND_REQUEST { createdAt, status: 'pending' }]->(receiver)
 *    (a)-[:FRIENDS_WITH { since, status: 'accepted' }]-(b)   // undirected
 *
 *  Design notes:
 *   - A pending request is a directed PENDING_FRIEND_REQUEST edge carrying
 *     createdAt + status. Accepting removes that edge and creates an undirected
 *     FRIENDS_WITH edge inside a single managed transaction so the two writes
 *     succeed or fail together.
 *   - FRIENDS_WITH is created with an undirected MERGE + ON CREATE SET so that
 *     duplicate or reciprocal friendship edges can never be created.
 *   - Authorization is structural: accept/reject are keyed off the authenticated
 *     user as the receiver; cancel is keyed off the authenticated user as the
 *     sender; only an existing FRIENDS_WITH edge can be removed.
 * =============================================================================
 */

/**
 * Sends a friend request from senderId to targetId.
 * Enforces: no self-request, target must exist, not already friends,
 *           no conflicting pending request in either direction.
 */
export const sendFriendRequest = async (senderId, targetId) => {
  if (senderId === targetId) {
    const error = new Error('You cannot send a friend request to yourself.');
    error.statusCode = 400;
    throw error;
  }

  const session = getSession();
  try {
    // 1. Verify the target student exists
    const checkUserQuery = `
      MATCH (target:Student {studentId: $targetId})
      RETURN target
    `;
    const checkRes = await session.run(checkUserQuery, { targetId });
    if (checkRes.records.length === 0) {
      const error = new Error(`Student with ID '${targetId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    // 2. Block requests to an existing friend
    const checkFriendsQuery = `
      MATCH (s1:Student {studentId: $senderId})-[r:FRIENDS_WITH]-(s2:Student {studentId: $targetId})
      RETURN r
    `;
    const friendsRes = await session.run(checkFriendsQuery, { senderId, targetId });
    if (friendsRes.records.length > 0) {
      const error = new Error('You are already friends with this student.');
      error.statusCode = 400;
      throw error;
    }

    // 3. Block conflicting pending requests (either direction)
    const checkPendingQuery = `
      MATCH (s1:Student {studentId: $senderId})-[r1:PENDING_FRIEND_REQUEST]->(s2:Student {studentId: $targetId})
      RETURN 'outgoing' AS direction
      UNION
      MATCH (s2:Student {studentId: $targetId})-[r2:PENDING_FRIEND_REQUEST]->(s1:Student {studentId: $senderId})
      RETURN 'incoming' AS direction
    `;
    const pendingRes = await session.run(checkPendingQuery, { senderId, targetId });
    if (pendingRes.records.length > 0) {
      const direction = pendingRes.records[0].get('direction');
      if (direction === 'outgoing') {
        const error = new Error('Friend request already sent and pending acceptance.');
        error.statusCode = 400;
        throw error;
      } else {
        const error = new Error('This student has already sent you a friend request. Check your incoming requests to accept.');
        error.statusCode = 400;
        throw error;
      }
    }

    // 4. Create the pending request edge
    const createQuery = `
      MATCH (s1:Student {studentId: $senderId})
      MATCH (s2:Student {studentId: $targetId})
      CREATE (s1)-[r:PENDING_FRIEND_REQUEST { createdAt: datetime(), status: 'pending' }]->(s2)
      RETURN r
    `;
    await session.run(createQuery, { senderId, targetId });

    return {
      message: 'Friend request sent successfully.',
      senderId,
      receiverId: targetId,
      status: 'pending'
    };
  } finally {
    await session.close();
  }
};

/**
 * Accepts a pending friend request addressed to receiverId from senderId.
 * Runs inside a managed transaction: delete the PENDING_FRIEND_REQUEST edge and
 * create an undirected FRIENDS_WITH edge atomically.
 */
export const acceptFriendRequest = async (receiverId, senderId) => {
  const session = getSession();
  try {
    await session.executeWrite(async (tx) => {
      // 1. Confirm a pending request from sender -> receiver exists.
      //    (Only the receiver can accept: receiverId is the authenticated user.)
      const findQuery = `
        MATCH (sender:Student {studentId: $senderId})-[r:PENDING_FRIEND_REQUEST]->(receiver:Student {studentId: $receiverId})
        RETURN r
      `;
      const findRes = await tx.run(findQuery, { senderId, receiverId });
      if (findRes.records.length === 0) {
        const error = new Error('No pending friend request found from this student.');
        error.statusCode = 404;
        throw error;
      }

      // 2. Remove the pending request.
      await tx.run(
        `MATCH (sender:Student {studentId: $senderId})-[r:PENDING_FRIEND_REQUEST]->(receiver:Student {studentId: $receiverId})
         DELETE r`,
        { senderId, receiverId }
      );

      // 3. Create the undirected friendship edge (idempotent: MERGE prevents
      //    duplicate or reciprocal FRIENDS_WITH relationships).
      await tx.run(
        `MATCH (sender:Student {studentId: $senderId}), (receiver:Student {studentId: $receiverId})
         MERGE (sender)-[f:FRIENDS_WITH]-(receiver)
         ON CREATE SET f.since = datetime(), f.status = 'accepted'`,
        { senderId, receiverId }
      );
    });

    return {
      message: 'Friend request accepted. You are now connected!',
      senderId,
      receiverId,
      status: 'accepted'
    };
  } finally {
    await session.close();
  }
};

/**
 * Rejects a pending friend request addressed to receiverId from senderId.
 * Only the receiver can reject (receiverId is the authenticated user).
 */
export const rejectFriendRequest = async (receiverId, senderId) => {
  const session = getSession();
  try {
    const query = `
      MATCH (sender:Student {studentId: $senderId})-[r:PENDING_FRIEND_REQUEST]->(receiver:Student {studentId: $receiverId})
      DELETE r
      RETURN count(r) AS deletedCount
    `;
    const res = await session.run(query, { senderId, receiverId });
    const count = res.records[0].get('deletedCount');

    if (count === 0) {
      const error = new Error('No pending friend request found to reject.');
      error.statusCode = 404;
      throw error;
    }

    return {
      message: 'Friend request rejected.',
      senderId,
      receiverId
    };
  } finally {
    await session.close();
  }
};

/**
 * Cancels an outgoing pending friend request sent by senderId to receiverId.
 * Only the sender can cancel (senderId is the authenticated user).
 */
export const cancelFriendRequest = async (senderId, receiverId) => {
  const session = getSession();
  try {
    const query = `
      MATCH (sender:Student {studentId: $senderId})-[r:PENDING_FRIEND_REQUEST]->(receiver:Student {studentId: $receiverId})
      DELETE r
      RETURN count(r) AS deletedCount
    `;
    const res = await session.run(query, { senderId, receiverId });
    const count = res.records[0].get('deletedCount');

    if (count === 0) {
      const error = new Error('No outgoing friend request found to cancel.');
      error.statusCode = 404;
      throw error;
    }

    return {
      message: 'Outgoing friend request canceled.',
      senderId,
      receiverId
    };
  } finally {
    await session.close();
  }
};

/**
 * Retrieves incoming pending friend requests for a student
 * (requests sent TO this student by others).
 */
export const getIncomingFriendRequests = async (studentId) => {
  const session = getSession();
  try {
    const query = `
      MATCH (sender:Student)-[r:PENDING_FRIEND_REQUEST]->(receiver:Student {studentId: $studentId})
      OPTIONAL MATCH (sender)-[:HAS_INTEREST]->(i:Interest)
      WITH sender, r, collect(DISTINCT i.name) AS interests
      ORDER BY r.createdAt DESC
      RETURN sender, r.createdAt AS sentAt, interests
    `;
    const res = await session.run(query, { studentId });

    return res.records.map(rec => ({
      sender: sanitizeStudent(rec.get('sender').properties),
      sentAt: rec.get('sentAt') ? rec.get('sentAt').toString() : null,
      interests: rec.get('interests') || []
    }));
  } finally {
    await session.close();
  }
};

/**
 * Retrieves outgoing pending friend requests sent by a student
 * (requests sent BY this student to others).
 */
export const getOutgoingFriendRequests = async (studentId) => {
  const session = getSession();
  try {
    const query = `
      MATCH (sender:Student {studentId: $studentId})-[r:PENDING_FRIEND_REQUEST]->(receiver:Student)
      OPTIONAL MATCH (receiver)-[:HAS_INTEREST]->(i:Interest)
      WITH receiver, r, collect(DISTINCT i.name) AS interests
      ORDER BY r.createdAt DESC
      RETURN receiver, r.createdAt AS sentAt, interests
    `;
    const res = await session.run(query, { studentId });

    return res.records.map(rec => ({
      receiver: sanitizeStudent(rec.get('receiver').properties),
      sentAt: rec.get('sentAt') ? rec.get('sentAt').toString() : null,
      interests: rec.get('interests') || []
    }));
  } finally {
    await session.close();
  }
};

/**
 * Retrieves confirmed friends for a student (undirected FRIENDS_WITH).
 */
export const getFriends = async (studentId) => {
  const session = getSession();
  try {
    const query = `
      MATCH (s:Student {studentId: $studentId})-[r:FRIENDS_WITH]-(friend:Student)
      OPTIONAL MATCH (friend)-[:HAS_INTEREST]->(i:Interest)
      WITH friend, r, collect(DISTINCT i.name) AS interests
      ORDER BY friend.name ASC
      RETURN friend, r.since AS since, interests
    `;
    const res = await session.run(query, { studentId });

    return res.records.map(rec => ({
      friend: sanitizeStudent(rec.get('friend').properties),
      since: rec.get('since') ? rec.get('since').toString() : null,
      interests: rec.get('interests') || []
    }));
  } finally {
    await session.close();
  }
};

/**
 * Removes an existing friendship (unfriend).
 * Only an existing FRIENDS_WITH edge between the two students can be removed.
 */
export const removeFriendship = async (studentId, friendId) => {
  const session = getSession();
  try {
    const query = `
      MATCH (s1:Student {studentId: $studentId})-[r:FRIENDS_WITH]-(s2:Student {studentId: $friendId})
      DELETE r
      RETURN count(r) AS deletedCount
    `;
    const res = await session.run(query, { studentId, friendId });
    const count = res.records[0].get('deletedCount');

    if (count === 0) {
      const error = new Error('Friendship not found.');
      error.statusCode = 404;
      throw error;
    }

    return {
      message: 'Friend removed successfully.',
      studentId,
      friendId
    };
  } finally {
    await session.close();
  }
};
