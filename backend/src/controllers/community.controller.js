import * as communityService from '../services/community.service.js';

export const detectCommunities = async (req, res, next) => {
  try {
    const result = await communityService.detectCommunities();
    return res.status(200).json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const getCommunityMembers = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    if (!communityId) {
      return res.status(400).json({ error: 'communityId param required' });
    }
    const members = await communityService.getCommunityMembers(communityId);
    return res.status(200).json({ success: true, data: members });
  } catch (err) { next(err); }
};

export const getCommunityStats = async (req, res, next) => {
  try {
    const stats = await communityService.getCommunityStats();
    return res.status(200).json({ success: true, data: stats });
  } catch (err) { next(err); }
};
