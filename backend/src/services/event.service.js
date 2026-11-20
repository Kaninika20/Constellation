import { getSession } from '../config/neo4j.config.js';
import { sanitizeStudent } from './student.service.js';

/**
 * -----------------------------------------------------------------------------
 * 3. EVENTS MANAGEMENT (PARTICIPATES_IN)
 * -----------------------------------------------------------------------------
 */

/**
 * Retrieves all events with participant counts and registration status for current student.
 */
export const getAllEvents = async (currentStudentId = null) => {
  const session = getSession();
  try {
    const query = `
      MATCH (e:Event)
      OPTIONAL MATCH (s:Student)-[r:PARTICIPATES_IN]->(e)
      WITH e, count(DISTINCT s) AS participantCount
      ${currentStudentId ? `
        OPTIONAL MATCH (me:Student {studentId: $currentStudentId})-[myRel:PARTICIPATES_IN]->(e)
        WITH e, participantCount, myRel IS NOT NULL AS isRegistered, myRel.registrationDate AS registrationDate
      ` : `
        WITH e, participantCount, false AS isRegistered, null AS registrationDate
      `}
      ORDER BY e.date ASC
      RETURN e, participantCount, isRegistered, registrationDate
    `;

    const res = await session.run(query, { currentStudentId });

    return res.records.map(rec => ({
      ...rec.get('e').properties,
      participantCount: rec.get('participantCount'),
      isRegistered: rec.get('isRegistered'),
      registrationDate: rec.get('registrationDate') ? rec.get('registrationDate').toString() : null
    }));
  } finally {
    await session.close();
  }
};

/**
 * Creates a new college event in Neo4j.
 */
export const createEvent = async ({
  eventId,
  title,
  date,
  location,
  description,
  category = '',
  creatorStudentId = null
}) => {
  if (![title, date, location].every(value => typeof value === 'string' && value.trim())) {
    const error = new Error('title, date, and location are required to create an event.');
    error.statusCode = 400;
    throw error;
  }

  const session = getSession();
  try {
    const normalizedEventId = typeof eventId === 'string' ? eventId.trim() : '';
    const finalEventId = normalizedEventId
      ? normalizedEventId
      : `EVT_${Date.now().toString().slice(-6)}`;

    // 1. Check if event ID already exists
    const checkQuery = `MATCH (e:Event {eventId: $finalEventId}) RETURN e`;
    const checkRes = await session.run(checkQuery, { finalEventId });
    if (checkRes.records.length > 0) {
      const error = new Error(`Event with ID '${finalEventId}' already exists.`);
      error.statusCode = 409;
      throw error;
    }

    // 2. Create Event node
    const createQuery = `
      CREATE (e:Event {
        eventId: $finalEventId,
        title: $title,
        date: $date,
        location: $location,
        description: $description,
        category: $category,
        createdBy: $creatorStudentId,
        createdAt: datetime(),
        updatedAt: datetime()
      })
      RETURN e
    `;

    const res = await session.run(createQuery, {
      finalEventId,
      title: title.trim(),
      date: date.trim(),
      location: location.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      category: typeof category === 'string' ? category.trim() : '',
      creatorStudentId
    });

    return {
      message: 'College event created successfully.',
      event: res.records[0].get('e').properties
    };
  } finally {
    await session.close();
  }
};

/**
 * Registers student for an event (creates PARTICIPATES_IN relationship).
 */
export const registerForEvent = async (studentId, eventId) => {
  const session = getSession();
  try {
    // 1. Verify event exists
    const checkEventQuery = `MATCH (e:Event {eventId: $eventId}) RETURN e`;
    const checkEventRes = await session.run(checkEventQuery, { eventId });
    if (checkEventRes.records.length === 0) {
      const error = new Error(`Event with ID '${eventId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    // 2. Check if already registered
    const checkRelQuery = `
      MATCH (s:Student {studentId: $studentId})-[r:PARTICIPATES_IN]->(e:Event {eventId: $eventId})
      RETURN r
    `;
    const relRes = await session.run(checkRelQuery, { studentId, eventId });
    if (relRes.records.length > 0) {
      const error = new Error('You are already registered for this event.');
      error.statusCode = 400;
      throw error;
    }

    // 3. Create PARTICIPATES_IN relationship
    const regQuery = `
      MATCH (s:Student {studentId: $studentId})
      MATCH (e:Event {eventId: $eventId})
      CREATE (s)-[r:PARTICIPATES_IN { registrationDate: datetime(), status: 'confirmed' }]->(e)
      RETURN r
    `;
    await session.run(regQuery, { studentId, eventId });

    return {
      message: 'Successfully registered for event.',
      studentId,
      eventId
    };
  } finally {
    await session.close();
  }
};

/**
 * Cancels event participation (deletes PARTICIPATES_IN relationship).
 */
export const cancelEventRegistration = async (studentId, eventId) => {
  const session = getSession();
  try {
    const query = `
      MATCH (s:Student {studentId: $studentId})-[r:PARTICIPATES_IN]->(e:Event {eventId: $eventId})
      DELETE r
      RETURN count(r) AS deletedCount
    `;
    const res = await session.run(query, { studentId, eventId });
    const count = res.records[0].get('deletedCount');

    if (count === 0) {
      const error = new Error('You are not registered for this event.');
      error.statusCode = 404;
      throw error;
    }

    return {
      message: 'Successfully cancelled event participation.',
      studentId,
      eventId
    };
  } finally {
    await session.close();
  }
};

/**
 * Retrieves participants of a specific event.
 */
export const getEventParticipants = async (eventId) => {
  const session = getSession();
  try {
    const query = `
      MATCH (s:Student)-[r:PARTICIPATES_IN]->(e:Event {eventId: $eventId})
      OPTIONAL MATCH (s)-[:HAS_INTEREST]->(i:Interest)
      WITH s, r, collect(DISTINCT i.name) AS interests
      ORDER BY s.name ASC
      RETURN s, r.registrationDate AS registrationDate, r.status AS status, interests
    `;
    const res = await session.run(query, { eventId });

    return res.records.map(rec => ({
      student: sanitizeStudent(rec.get('s').properties),
      registrationDate: rec.get('registrationDate') ? rec.get('registrationDate').toString() : null,
      status: rec.get('status'),
      interests: rec.get('interests')
    }));
  } finally {
    await session.close();
  }
};

