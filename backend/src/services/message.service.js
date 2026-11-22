import { randomUUID } from 'node:crypto';
import { getSession } from '../config/neo4j.config.js';

const friendshipError = () => {
  const error = new Error('Messages are available only between confirmed friends.');
  error.statusCode = 403;
  return error;
};

const assertFriends = async (session, studentId, friendId) => {
  const result = await session.run(`
    MATCH (:Student {studentId: $studentId})-[:FRIENDS_WITH]-(:Student {studentId: $friendId})
    RETURN count(*) AS friendshipCount
  `, { studentId, friendId });
  if (!result.records[0]?.get('friendshipCount')) throw friendshipError();
};

export const getConversation = async (studentId, friendId) => {
  if (studentId === friendId) {
    const error = new Error('You cannot open a conversation with yourself.');
    error.statusCode = 400;
    throw error;
  }

  const session = getSession();
  try {
    await assertFriends(session, studentId, friendId);
    const result = await session.run(`
      MATCH (sender:Student)-[:SENT_MESSAGE]->(message:Message)-[:MESSAGE_TO]->(recipient:Student)
      WHERE (sender.studentId = $studentId AND recipient.studentId = $friendId)
         OR (sender.studentId = $friendId AND recipient.studentId = $studentId)
      RETURN message.messageId AS messageId, message.content AS content,
        message.sentAt AS sentAt, sender.studentId AS senderId,
        EXISTS {
          MATCH (:Student {studentId: $studentId})-[:SUBMITTED_REPORT]->
            (:MessageReport)-[:ABOUT_MESSAGE]->(message)
        } AS reportedByMe
      ORDER BY sentAt DESC
      LIMIT 200
    `, { studentId, friendId });

    return result.records.map(record => ({
      messageId: record.get('messageId'),
      content: record.get('content'),
      sentAt: record.get('sentAt')?.toString() || null,
      senderId: record.get('senderId'),
      reportedByMe: record.get('reportedByMe')
    })).reverse();
  } finally {
    await session.close();
  }
};

export const reportMessage = async (reporterId, senderId, messageId, details = '') => {
  if (typeof details !== 'string') {
    const error = new Error('Report details must be text.');
    error.statusCode = 400;
    throw error;
  }
  const trimmedDetails = details.trim();
  if (trimmedDetails.length > 1000) {
    const error = new Error('Report details must be no longer than 1000 characters.');
    error.statusCode = 400;
    throw error;
  }
  if (reporterId === senderId) {
    const error = new Error('You cannot report your own message.');
    error.statusCode = 400;
    throw error;
  }

  const reportId = randomUUID();
  const reportKey = `${reporterId}:${messageId}`;
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (reporter:Student {studentId: $reporterId})
      MATCH (sender:Student {studentId: $senderId})-[:SENT_MESSAGE]->
        (message:Message {messageId: $messageId})-[:MESSAGE_TO]->(reporter)
      MERGE (report:MessageReport {reportKey: $reportKey})
      ON CREATE SET report.reportId = $reportId,
        report.category = 'obscene_content',
        report.details = $details,
        report.status = 'pending',
        report.submittedAt = datetime()
      MERGE (reporter)-[:SUBMITTED_REPORT]->(report)
      MERGE (report)-[:ABOUT_MESSAGE]->(message)
      MERGE (report)-[:REPORTS_STUDENT]->(sender)
      RETURN report.reportId AS reportId, report.status AS status,
        report.reportId = $reportId AS created
    `, { reporterId, senderId, messageId, reportId, reportKey, details: trimmedDetails });

    if (!result.records.length) {
      const error = new Error('Only a message you received from this student can be reported.');
      error.statusCode = 404;
      throw error;
    }

    const record = result.records[0];
    if (!record.get('created')) {
      const error = new Error('You have already reported this message.');
      error.statusCode = 409;
      throw error;
    }
    return {
      reportId: record.get('reportId'),
      status: record.get('status')
    };
  } finally {
    await session.close();
  }
};

export const sendMessage = async (studentId, friendId, content) => {
  const trimmedContent = typeof content === 'string' ? content.trim() : '';
  if (!trimmedContent || trimmedContent.length > 2000) {
    const error = new Error('Message text must contain 1 to 2000 characters.');
    error.statusCode = 400;
    throw error;
  }
  if (studentId === friendId) {
    const error = new Error('You cannot send a message to yourself.');
    error.statusCode = 400;
    throw error;
  }

  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (sender:Student {studentId: $studentId})
      MATCH (recipient:Student {studentId: $friendId})
      MATCH (sender)-[:FRIENDS_WITH]-(recipient)
      CREATE (message:Message {
        messageId: $messageId,
        content: $content,
        sentAt: datetime()
      })
      CREATE (sender)-[:SENT_MESSAGE]->(message)
      CREATE (message)-[:MESSAGE_TO]->(recipient)
      RETURN message.messageId AS messageId, message.content AS content,
        message.sentAt AS sentAt, sender.studentId AS senderId
    `, { studentId, friendId, content: trimmedContent, messageId: randomUUID() });

    if (!result.records.length) throw friendshipError();
    const record = result.records[0];
    return {
      messageId: record.get('messageId'),
      content: record.get('content'),
      sentAt: record.get('sentAt')?.toString() || null,
      senderId: record.get('senderId')
    };
  } finally {
    await session.close();
  }
};
