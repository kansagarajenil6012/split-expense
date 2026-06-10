import usersRepository from '../repositories/users.repository.js';
import activityLogsRepository from '../repositories/activity-logs.repository.js';
import notificationsRepository from '../repositories/notifications.repository.js';
import categoriesRepository from '../repositories/categories.repository.js';
import { notFound } from '../utils/app-error.js';
import { getPagination } from '../utils/pagination.js';

export const usersService = {
  async updateProfile(userId, data) {
    const mapped = {
      full_name: data.fullName,
      phone: data.phone,
      default_currency: data.defaultCurrency,
      timezone: data.timezone,
      avatar_url: data.avatarUrl,
    };
    Object.keys(mapped).forEach((k) => mapped[k] === undefined && delete mapped[k]);
    const updated = await usersRepository.update(userId, mapped);
    if (!updated) throw notFound('User');
    return usersRepository.toPublic(updated);
  },

  async deleteAccount(userId) {
    await usersRepository.softDelete(userId);
    return { id: userId };
  },
};

export const activityService = {
  async getGroupActivity(groupId, query) {
    const { page, limit, offset } = getPagination(query);
    return activityLogsRepository.findByGroupId(groupId, { limit, offset, entityId: query.entityId });
  },

  async getUserActivity(userId, query) {
    const { limit, offset } = getPagination(query);
    return activityLogsRepository.findByUserId(userId, { limit, offset });
  },
};

export const notificationsService = {
  async getNotifications(userId, query) {
    const { page, limit, offset } = getPagination(query);
    const notifications = await notificationsRepository.findByUserId(userId, {
      limit, offset,
      unreadOnly: query.unreadOnly === 'true',
    });
    return { notifications, page, limit };
  },

  async getUnreadCount(userId) {
    return notificationsRepository.getUnreadCount(userId);
  },

  async markRead(userId, notificationId) {
    const n = await notificationsRepository.markRead(notificationId, userId);
    if (!n) throw notFound('Notification');
    return n;
  },

  async markAllRead(userId) {
    await notificationsRepository.markAllRead(userId);
    return { success: true };
  },

  async deleteNotification(userId, notificationId) {
    const n = await notificationsRepository.softDelete(notificationId, userId);
    if (!n) throw notFound('Notification');
    return n;
  },
};

export const categoriesService = {
  async getCategories(groupId) {
    return groupId
      ? categoriesRepository.findByGroupId(groupId)
      : categoriesRepository.findSystem();
  },

  async createCategory(groupId, data) {
    return categoriesRepository.create({ groupId, ...data });
  },
};
