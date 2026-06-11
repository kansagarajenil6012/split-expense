import { getClient } from '../config/database.js';
import crypto from 'crypto';
import QRCode from 'qrcode';
import groupsRepository from '../repositories/groups.repository.js';
import groupMembersRepository from '../repositories/group-members.repository.js';
import invitationsRepository from '../repositories/invitations.repository.js';
import usersRepository from '../repositories/users.repository.js';
import notificationsRepository from '../repositories/notifications.repository.js';
import categoriesRepository from '../repositories/categories.repository.js';
import { notFound, badRequest, forbidden, conflict } from '../utils/app-error.js';
import { logActivity, logAudit, getRequestMeta } from './audit.service.js';
import { uploadFile, validateImageFile } from './upload.service.js';
import config from '../config/index.js';

const groupsService = {
  async createGroup(userId, data, req) {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const group = await groupsRepository.create(
        { ...data, createdBy: userId },
        client
      );
      await groupMembersRepository.create(
        { groupId: group.id, userId, role: 'admin' },
        client
      );

      await logActivity({
        groupId: group.id,
        actorUserId: userId,
        entityType: 'group',
        entityId: group.id,
        action: 'create',
        summary: `Created group "${group.name}"`,
        ...getRequestMeta(req),
      }, client);

      await client.query('COMMIT');
      return group;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async getGroups(userId) {
    return groupsRepository.findByUserId(userId);
  },

  async getGroup(groupId, userId) {
    const group = await groupsRepository.findById(groupId);
    if (!group) throw notFound('Group');
    const membership = await groupMembersRepository.findActiveMembership(groupId, userId);
    if (!membership) throw forbidden('Not a member of this group');
    const members = await groupMembersRepository.findByGroupId(groupId);
    return { ...group, members, myMembership: membership };
  },

  async updateGroup(groupId, userId, data, req) {
    const before = await groupsRepository.findById(groupId);
    if (!before) throw notFound('Group');

    const updated = await groupsRepository.update(groupId, data);

    await logAudit({
      ...getRequestMeta(req),
      actorUserId: userId,
      action: 'group.update',
      entityType: 'group',
      entityId: groupId,
      beforeState: before,
      afterState: updated,
    });

    await logActivity({
      groupId,
      actorUserId: userId,
      entityType: 'group',
      entityId: groupId,
      action: 'update',
      summary: `Updated group "${updated.name}"`,
      ...getRequestMeta(req),
    });

    return updated;
  },

  async deleteGroup(groupId, userId, req) {
    const group = await groupsRepository.findById(groupId);
    if (!group) throw notFound('Group');
    await groupsRepository.softDelete(groupId);

    await logActivity({
      groupId,
      actorUserId: userId,
      entityType: 'group',
      entityId: groupId,
      action: 'delete',
      summary: `Deleted group "${group.name}"`,
      ...getRequestMeta(req),
    });

    return { id: groupId };
  },

  // ============================================================
  // ARCHIVE / UNARCHIVE
  // ============================================================

  async archiveGroup(groupId, userId, req) {
    const group = await groupsRepository.findById(groupId);
    if (!group) throw notFound('Group');
    if (group.is_archived) throw badRequest('Group is already archived');

    await groupsRepository.update(groupId, { is_archived: true });

    await logActivity({
      groupId,
      actorUserId: userId,
      entityType: 'group',
      entityId: groupId,
      action: 'archive',
      summary: `Archived group "${group.name}"`,
      ...getRequestMeta(req),
    });

    return { id: groupId, is_archived: true };
  },

  async unarchiveGroup(groupId, userId, req) {
    const group = await groupsRepository.findById(groupId);
    if (!group) throw notFound('Group');
    if (!group.is_archived) throw badRequest('Group is not archived');

    await groupsRepository.update(groupId, { is_archived: false });

    await logActivity({
      groupId,
      actorUserId: userId,
      entityType: 'group',
      entityId: groupId,
      action: 'archive',
      summary: `Unarchived group "${group.name}"`,
      ...getRequestMeta(req),
    });

    return { id: groupId, is_archived: false };
  },

  // ============================================================
  // CLONE GROUP
  // ============================================================

  async cloneGroup(groupId, userId, data, req) {
    const original = await groupsRepository.findById(groupId);
    if (!original) throw notFound('Group');

    const members = await groupMembersRepository.findByGroupId(groupId);

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Create new group with same settings
      const newGroup = await groupsRepository.create({
        name: data.name || `${original.name} (Copy)`,
        description: original.description,
        groupType: original.group_type,
        currency: original.currency,
        settings: original.settings,
        tags: original.tags,
        createdBy: userId,
      }, client);

      // Add creator as admin
      await groupMembersRepository.create(
        { groupId: newGroup.id, userId, role: 'admin' },
        client
      );

      // Add other active members
      for (const member of members) {
        if (member.user_id !== userId && member.status === 'active') {
          await groupMembersRepository.create(
            { groupId: newGroup.id, userId: member.user_id, role: 'member', invitedBy: userId },
            client
          );
        }
      }

      // Clone categories (non-system)
      const categories = await categoriesRepository.findByGroupId(groupId);
      for (const cat of categories) {
        if (!cat.is_system) {
          await categoriesRepository.create({
            groupId: newGroup.id,
            name: cat.name,
            icon: cat.icon,
            color: cat.color,
          }, client);
        }
      }

      await logActivity({
        groupId: newGroup.id,
        actorUserId: userId,
        entityType: 'group',
        entityId: newGroup.id,
        action: 'clone',
        summary: `Cloned group from "${original.name}"`,
        payload: { sourceGroupId: groupId },
        ...getRequestMeta(req),
      }, client);

      await client.query('COMMIT');
      return newGroup;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // ============================================================
  // TRANSFER OWNERSHIP
  // ============================================================

  async transferOwnership(groupId, userId, toMemberId, req) {
    const group = await groupsRepository.findById(groupId);
    if (!group) throw notFound('Group');

    const currentMembership = await groupMembersRepository.findActiveMembership(groupId, userId);
    if (!currentMembership || currentMembership.role !== 'admin') {
      throw forbidden('Only admins can transfer ownership');
    }

    const targetMember = await groupMembersRepository.findById(toMemberId);
    if (!targetMember || targetMember.group_id !== groupId || targetMember.status !== 'active') {
      throw badRequest('Invalid target member');
    }

    if (targetMember.user_id === userId) {
      throw badRequest('Cannot transfer ownership to yourself');
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Promote target to admin
      await groupMembersRepository.updateRole(toMemberId, 'admin', client);
      // Demote current owner to member
      await groupMembersRepository.updateRole(currentMembership.id, 'member', client);

      // Notify new owner
      await notificationsRepository.create({
        userId: targetMember.user_id,
        groupId,
        type: 'ownership_transferred',
        title: 'Ownership Transferred',
        body: `You are now the admin of "${group.name}"`,
        entityType: 'group',
        entityId: groupId,
      }, client);

      await logActivity({
        groupId,
        actorUserId: userId,
        entityType: 'group',
        entityId: groupId,
        action: 'transfer',
        summary: `Transferred ownership to ${targetMember.full_name || 'member'}`,
        payload: { fromUserId: userId, toMemberId },
        ...getRequestMeta(req),
      }, client);

      await client.query('COMMIT');
      return { message: 'Ownership transferred successfully' };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // ============================================================
  // COVER IMAGE
  // ============================================================

  async uploadCoverImage(groupId, userId, file, req) {
    const group = await groupsRepository.findById(groupId);
    if (!group) throw notFound('Group');

    validateImageFile(file);

    const filePath = `groups/${groupId}/cover_${Date.now()}.${file.originalname.split('.').pop()}`;
    const url = await uploadFile(config.supabase.bucket, filePath, file.buffer, file.mimetype);

    await groupsRepository.update(groupId, { cover_image_url: url });

    await logActivity({
      groupId,
      actorUserId: userId,
      entityType: 'group',
      entityId: groupId,
      action: 'update',
      summary: 'Updated group cover image',
      ...getRequestMeta(req),
    });

    return { coverImageUrl: url };
  },

  // ============================================================
  // QR INVITE
  // ============================================================

  async generateQRInvite(groupId, userId, req) {
    // Generate share link first
    const { token } = await this.generateShareLink(groupId, userId, req);
    const joinUrl = `${config.frontendUrl}/join/${token}`;

    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(joinUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    return { token, joinUrl, qrDataUrl };
  },

  // ============================================================
  // MEMBERS
  // ============================================================

  async getMembers(groupId) {
    return groupMembersRepository.findByGroupId(groupId);
  },

  async updateMember(groupId, memberId, data, userId, req) {
    const member = await groupMembersRepository.findById(memberId);
    if (!member || member.group_id !== groupId) throw notFound('Member');

    if (data.role && data.role !== member.role) {
      if (member.role === 'admin' && data.role === 'member') {
        const adminCount = await groupMembersRepository.countAdmins(groupId);
        if (adminCount <= 1) throw badRequest('Cannot demote the last admin');
      }
      const updated = await groupMembersRepository.updateRole(memberId, data.role);

      await logActivity({
        groupId,
        actorUserId: userId,
        entityType: 'group_member',
        entityId: memberId,
        action: 'update',
        summary: `Changed ${member.full_name}'s role from ${member.role} to ${data.role}`,
        payload: { oldRole: member.role, newRole: data.role },
        ...getRequestMeta(req),
      });

      await logAudit({
        ...getRequestMeta(req),
        actorUserId: userId,
        action: 'member.role_update',
        entityType: 'group_member',
        entityId: memberId,
        beforeState: { role: member.role },
        afterState: { role: data.role },
      });

      return updated;
    }
    return member;
  },

  async removeMember(groupId, memberId, userId, req) {
    const member = await groupMembersRepository.findById(memberId);
    if (!member || member.group_id !== groupId) throw notFound('Member');

    if (member.role === 'admin') {
      const adminCount = await groupMembersRepository.countAdmins(groupId);
      if (adminCount <= 1) throw badRequest('Cannot remove the last admin');
    }

    await groupMembersRepository.remove(memberId);

    await logActivity({
      groupId,
      actorUserId: userId,
      entityType: 'group_member',
      entityId: memberId,
      action: 'delete',
      summary: `Removed member from group`,
      ...getRequestMeta(req),
    });

    return { id: memberId };
  },

  async leaveGroup(groupId, userId, req) {
    const membership = await groupMembersRepository.findActiveMembership(groupId, userId);
    if (!membership) throw notFound('Membership');

    if (membership.role === 'admin') {
      const adminCount = await groupMembersRepository.countAdmins(groupId);
      if (adminCount <= 1) throw badRequest('Transfer admin role before leaving');
    }

    await groupMembersRepository.leave(membership.id);

    await logActivity({
      groupId,
      actorUserId: userId,
      entityType: 'group_member',
      entityId: membership.id,
      action: 'leave',
      summary: `Left the group`,
      ...getRequestMeta(req),
    });

    return { id: membership.id };
  },

  // ============================================================
  // INVITATIONS
  // ============================================================

  async inviteMember(groupId, userId, { email }, req) {
    const contact = email.trim();
    
    const isEmail = contact.includes('@');
    const digitsCount = (contact.match(/\d/g) || []).length;
    const isPhone = digitsCount >= 7 && /^\+?[0-9\s\-()]+$/.test(contact);

    if (isEmail || isPhone) {
      let existingUser = null;
      if (isEmail) {
        existingUser = await usersRepository.findByEmail(contact);
      } else {
        existingUser = await usersRepository.findByPhone(contact);
      }
      
      if (existingUser) {
        const existing = await groupMembersRepository.findActiveMembership(groupId, existingUser.id);
        if (existing) throw conflict('User is already a member');
        
        const client = await getClient();
        try {
          await client.query('BEGIN');
          const membership = await groupMembersRepository.create(
            { groupId, userId: existingUser.id, invitedBy: userId, role: 'member' },
            client
          );
          
          const group = await groupsRepository.findById(groupId);
          await notificationsRepository.create({
            userId: existingUser.id,
            groupId,
            type: 'member_joined',
            title: 'Added to Group',
            body: `You have been added to "${group.name}"`,
            entityType: 'group',
            entityId: groupId,
          }, client);

          await logActivity({
            groupId,
            actorUserId: userId,
            entityType: 'group_member',
            entityId: membership.id,
            action: 'join',
            summary: `Added ${existingUser.full_name} to the group`,
            ...getRequestMeta(req),
          }, client);

          await client.query('COMMIT');
          return { message: 'User added to the group', autoAdded: true };
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      } else {
        const dbEmail = isEmail ? contact : `${contact}@phone.splitexpense.local`;
        const dbPhone = isEmail ? null : contact;
        const defaultName = isEmail ? contact.split('@')[0] : contact;

        const client = await getClient();
        try {
          await client.query('BEGIN');

          const { rows: userRows } = await client.query(
            `INSERT INTO users (email, password_hash, full_name, phone, is_active)
             VALUES ($1, NULL, $2, $3, false)
             RETURNING *`,
            [dbEmail.toLowerCase(), defaultName, dbPhone]
          );
          const shadowUser = userRows[0];

          const membership = await groupMembersRepository.create(
            { groupId, userId: shadowUser.id, invitedBy: userId, role: 'member' },
            client
          );

          const invitation = await invitationsRepository.create({
            groupId,
            invitedBy: userId,
            inviteeEmail: dbEmail,
            inviteeUserId: shadowUser.id,
          }, client);

          await logActivity({
            groupId,
            actorUserId: userId,
            entityType: 'group_member',
            entityId: membership.id,
            action: 'join',
            summary: `Added ${defaultName} (unregistered) to the group`,
            ...getRequestMeta(req),
          }, client);

          await client.query('COMMIT');
          return { message: 'Member added to the group', autoAdded: true, token: invitation.token };
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      }
    } else {
      const client = await getClient();
      try {
        await client.query('BEGIN');

        const guestEmail = `guest-${crypto.randomUUID()}@splitexpense.local`;
        const { rows: userRows } = await client.query(
          `INSERT INTO users (email, password_hash, full_name, phone, is_active)
           VALUES ($1, NULL, $2, NULL, false)
           RETURNING *`,
          [guestEmail, contact]
        );
        const guestUser = userRows[0];

        const membership = await groupMembersRepository.create(
          { groupId, userId: guestUser.id, invitedBy: userId, role: 'member' },
          client
        );

        await logActivity({
          groupId,
          actorUserId: userId,
          entityType: 'group_member',
          entityId: membership.id,
          action: 'join',
          summary: `Added guest "${contact}" to the group`,
          ...getRequestMeta(req),
        }, client);

        await client.query('COMMIT');
        return { message: 'Guest member added to the group', autoAdded: true, memberId: membership.id };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
  },

  async generateShareLink(groupId, userId, req) {
    const dummyEmail = `invite-link-${Date.now()}@splitexpense.local`;
    const invitation = await invitationsRepository.create({
      groupId,
      invitedBy: userId,
      inviteeEmail: dummyEmail,
      inviteeUserId: null,
      expiresInDays: 30,
    });

    await logActivity({
      groupId,
      actorUserId: userId,
      entityType: 'invitation',
      entityId: invitation.id,
      action: 'invite',
      summary: `Generated a shareable invite link`,
      ...getRequestMeta(req),
    });

    return { token: invitation.token };
  },

  async acceptInvitation(token, userId, req, bypassEmailCheck = false) {
    const invitation = await invitationsRepository.findByToken(token);
    if (!invitation) throw notFound('Invitation');
    if (invitation.status !== 'pending') throw badRequest('Invitation is no longer valid');
    if (new Date(invitation.expires_at) < new Date()) {
      await invitationsRepository.updateStatus(invitation.id, 'expired');
      throw badRequest('Invitation has expired');
    }

    const user = await usersRepository.findById(userId);
    const isGenericLink = invitation.invitee_email && invitation.invitee_email.endsWith('@splitexpense.local');

    if (invitation.invitee_email && !isGenericLink && !bypassEmailCheck) {
      if (!user.email || user.email.toLowerCase() !== invitation.invitee_email.toLowerCase()) {
        throw forbidden('This invitation is for a different email');
      }
    }

    const existing = await groupMembersRepository.findActiveMembership(invitation.group_id, userId);
    if (existing) {
      await invitationsRepository.updateStatus(invitation.id, 'accepted');
      throw conflict('You are already a member of this group');
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');
      const membership = await groupMembersRepository.create(
        { groupId: invitation.group_id, userId, role: 'member', invitedBy: invitation.invited_by },
        client
      );
      
      const group = await groupsRepository.findById(invitation.group_id);
      await notificationsRepository.create({
        userId: invitation.invited_by,
        groupId: invitation.group_id,
        type: 'member_joined',
        title: 'Invitation Accepted',
        body: `${user.full_name} joined "${group.name}"`,
        entityType: 'group_member',
        entityId: membership.id,
      }, client);

      await invitationsRepository.updateStatus(invitation.id, 'accepted');

      await logActivity({
        groupId: invitation.group_id,
        actorUserId: userId,
        entityType: 'group_member',
        entityId: membership.id,
        action: 'join',
        summary: `Joined the group via invitation`,
        ...getRequestMeta(req),
      }, client);

      await client.query('COMMIT');
      return { message: 'Successfully joined the group' };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async processPendingInvitations(user, req) {
    const emailsToCheck = [];
    if (user.email) emailsToCheck.push(user.email.toLowerCase());
    if (user.phone) {
      emailsToCheck.push(user.phone);
      emailsToCheck.push(`${user.phone}@phone.splitexpense.local`);
      
      const digitsOnly = user.phone.replace(/\D/g, '');
      if (digitsOnly !== user.phone) {
        emailsToCheck.push(digitsOnly);
        emailsToCheck.push(`${digitsOnly}@phone.splitexpense.local`);
      }
      
      if (digitsOnly.length >= 10) {
        const last10 = digitsOnly.slice(-10);
        emailsToCheck.push(last10);
        emailsToCheck.push(`${last10}@phone.splitexpense.local`);
      }
    }

    let processedCount = 0;
    for (const email of emailsToCheck) {
      const pending = await invitationsRepository.findPendingByEmail(email);
      for (const inv of pending) {
        try {
          await this.acceptInvitation(inv.token, user.id, req, true);
          processedCount++;
        } catch (err) {
          console.error(`Failed to auto-accept invitation ${inv.id}:`, err);
        }
      }
    }
    return processedCount;
  },

  async getInvitations(groupId) {
    return invitationsRepository.findByGroupId(groupId);
  },
};

export default groupsService;
