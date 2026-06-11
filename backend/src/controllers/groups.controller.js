import groupsService from '../services/groups.service.js';
import { success, created, paginated, noContent } from '../utils/api-response.js';

export const createGroup = async (req, res, next) => {
  try {
    const group = await groupsService.createGroup(req.user.id, req.validated.body, req);
    created(res, group);
  } catch (err) { next(err); }
};

export const getGroups = async (req, res, next) => {
  try {
    const groups = await groupsService.getGroups(req.user.id);
    success(res, groups);
  } catch (err) { next(err); }
};

export const getGroup = async (req, res, next) => {
  try {
    const group = await groupsService.getGroup(req.groupId, req.user.id);
    success(res, group);
  } catch (err) { next(err); }
};

export const updateGroup = async (req, res, next) => {
  try {
    const group = await groupsService.updateGroup(req.groupId, req.user.id, req.validated.body, req);
    success(res, group);
  } catch (err) { next(err); }
};

export const deleteGroup = async (req, res, next) => {
  try {
    await groupsService.deleteGroup(req.groupId, req.user.id, req);
    noContent(res);
  } catch (err) { next(err); }
};

export const getMembers = async (req, res, next) => {
  try {
    const members = await groupsService.getMembers(req.groupId);
    success(res, members);
  } catch (err) { next(err); }
};

export const updateMember = async (req, res, next) => {
  try {
    const member = await groupsService.updateMember(
      req.groupId, req.params.memberId, req.validated.body, req.user.id, req
    );
    success(res, member);
  } catch (err) { next(err); }
};

export const removeMember = async (req, res, next) => {
  try {
    await groupsService.removeMember(req.groupId, req.params.memberId, req.user.id, req);
    noContent(res);
  } catch (err) { next(err); }
};

export const leaveGroup = async (req, res, next) => {
  try {
    await groupsService.leaveGroup(req.groupId, req.user.id, req);
    noContent(res);
  } catch (err) { next(err); }
};

export const inviteMember = async (req, res, next) => {
  try {
    const result = await groupsService.inviteMember(req.params.groupId, req.user.id, req.body, req);
    success(res, result);
  } catch (err) { next(err); }
};

export const generateShareLink = async (req, res, next) => {
  try {
    const result = await groupsService.generateShareLink(req.params.groupId, req.user.id, req);
    const link = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/join/${result.token}`;
    success(res, { token: result.token, link });
  } catch (err) { next(err); }
};

export const getInvitations = async (req, res, next) => {
  try {
    const invitations = await groupsService.getInvitations(req.groupId);
    success(res, invitations);
  } catch (err) { next(err); }
};

export const acceptInvitation = async (req, res, next) => {
  try {
    const result = await groupsService.acceptInvitation(req.params.token, req.user.id, req);
    success(res, result);
  } catch (err) { next(err); }
};

export const archiveGroup = async (req, res, next) => {
  try {
    const result = await groupsService.archiveGroup(req.groupId, req.user.id, req);
    success(res, result);
  } catch (err) { next(err); }
};

export const unarchiveGroup = async (req, res, next) => {
  try {
    const result = await groupsService.unarchiveGroup(req.groupId, req.user.id, req);
    success(res, result);
  } catch (err) { next(err); }
};

export const cloneGroup = async (req, res, next) => {
  try {
    const result = await groupsService.cloneGroup(req.groupId, req.user.id, req.body, req);
    created(res, result);
  } catch (err) { next(err); }
};

export const transferOwnership = async (req, res, next) => {
  try {
    const result = await groupsService.transferOwnership(req.groupId, req.user.id, req.body.toMemberId, req);
    success(res, result);
  } catch (err) { next(err); }
};

export const getQRInvite = async (req, res, next) => {
  try {
    const result = await groupsService.generateQRInvite(req.groupId, req.user.id, req);
    success(res, result);
  } catch (err) { next(err); }
};

export const uploadCoverImage = async (req, res, next) => {
  try {
    const result = await groupsService.uploadCoverImage(req.groupId, req.user.id, req.file, req);
    success(res, result);
  } catch (err) { next(err); }
};
