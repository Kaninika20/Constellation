import * as messageService from '../services/message.service.js';

export const getConversation = async (req, res, next) => {
  try {
    const messages = await messageService.getConversation(req.user.studentId, req.params.friendId);
    return res.status(200).json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    const message = await messageService.sendMessage(
      req.user.studentId,
      req.params.friendId,
      req.body?.content
    );
    return res.status(201).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
};

export const reportMessage = async (req, res, next) => {
  try {
    const report = await messageService.reportMessage(
      req.user.studentId,
      req.params.friendId,
      req.params.messageId,
      req.body?.details
    );
    return res.status(201).json({
      success: true,
      message: 'Your report was sent to the moderators for review.',
      data: report
    });
  } catch (error) {
    next(error);
  }
};
