import * as eventService from '../services/event.service.js';

export const getEvents = async (req, res, next) => {
  try {
    const currentStudentId = req.user ? req.user.studentId : null;
    const events = await eventService.getAllEvents(currentStudentId);
    return res.status(200).json({
      data: events
    });
  } catch (error) {
    next(error);
  }
};

export const createEvent = async (req, res, next) => {
  try {
    const creatorStudentId = req.user ? req.user.studentId : null;
    const { eventId, title, date, location, description } = req.body;

    if (!title || !date || !location) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'title, date, and location are required fields for creating an event.'
      });
    }

    const result = await eventService.createEvent({
      eventId,
      title,
      date,
      location,
      description,
      creatorStudentId
    });

    return res.status(201).json({
      message: result.message,
      data: result.event
    });
  } catch (error) {
    next(error);
  }
};

export const registerForEvent = async (req, res, next) => {
  try {
    const studentId = req.user.studentId;
    const { eventId } = req.params;

    const result = await eventService.registerForEvent(studentId, eventId);
    return res.status(201).json({
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const cancelEventRegistration = async (req, res, next) => {
  try {
    const studentId = req.user.studentId;
    const { eventId } = req.params;

    const result = await eventService.cancelEventRegistration(studentId, eventId);
    return res.status(200).json({
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getEventParticipants = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const participants = await eventService.getEventParticipants(eventId);
    return res.status(200).json({
      data: participants
    });
  } catch (error) {
    next(error);
  }
};

