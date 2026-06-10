import apiClient from './api-client.js';

export const authApi = {
  register: (data) => apiClient.post('/auth/register', data),
  login: (data) => apiClient.post('/auth/login', data),
  googleLogin: (idToken) => apiClient.post('/auth/google', { idToken }),
  firebaseLogin: (idToken) => apiClient.post('/auth/firebase', { idToken }),
  refresh: (refreshToken) => apiClient.post('/auth/refresh', { refreshToken }),
  logout: (refreshToken) => apiClient.post('/auth/logout', { refreshToken }),
  getMe: () => apiClient.get('/auth/me'),
  saveFCMToken: (fcmToken, refreshToken) => apiClient.post('/auth/fcm-token', { fcmToken, refreshToken }),
};

export const groupsApi = {
  list: () => apiClient.get('/groups'),
  get: (groupId) => apiClient.get(`/groups/${groupId}`),
  create: (data) => apiClient.post('/groups', data),
  update: (groupId, data) => apiClient.patch(`/groups/${groupId}`, data),
  delete: (groupId) => apiClient.delete(`/groups/${groupId}`),
  getMembers: (groupId) => apiClient.get(`/groups/${groupId}/members`),
  invite: (groupId, email) => apiClient.post(`/groups/${groupId}/invitations`, { email }),
  generateShareLink: (groupId) => apiClient.post(`/groups/${groupId}/share-link`),
  leave: (groupId) => apiClient.post(`/groups/${groupId}/leave`),
  acceptInvite: (token) => apiClient.post(`/invitations/${token}/accept`),
};

export const expensesApi = {
  list: (groupId, params) => apiClient.get(`/groups/${groupId}/expenses`, { params }),
  get: (groupId, expenseId) => apiClient.get(`/groups/${groupId}/expenses/${expenseId}`),
  create: (groupId, data) => apiClient.post(`/groups/${groupId}/expenses`, data),
  update: (groupId, expenseId, data) => apiClient.patch(`/groups/${groupId}/expenses/${expenseId}`, data),
  delete: (groupId, expenseId) => apiClient.delete(`/groups/${groupId}/expenses/${expenseId}`),
  restore: (groupId, expenseId) => apiClient.post(`/groups/${groupId}/expenses/${expenseId}/restore`),
  getCategories: (groupId) => apiClient.get(`/groups/${groupId}/categories`),
};

export const settlementsApi = {
  getBalances: (groupId) => apiClient.get(`/groups/${groupId}/balances`),
  getSuggestions: (groupId) => apiClient.get(`/groups/${groupId}/settlements/suggestions`),
  list: (groupId, params) => apiClient.get(`/groups/${groupId}/settlements`, { params }),
  create: (groupId, data) => apiClient.post(`/groups/${groupId}/settlements`, data),
  cancel: (groupId, settlementId) => apiClient.patch(`/groups/${groupId}/settlements/${settlementId}/cancel`),
  restore: (groupId, settlementId) => apiClient.post(`/groups/${groupId}/settlements/${settlementId}/restore`),
};

export const reportsApi = {
  summary: (groupId) => apiClient.get(`/groups/${groupId}/reports/summary`),
  members: (groupId) => apiClient.get(`/groups/${groupId}/reports/members`),
  monthly: (groupId, year) => apiClient.get(`/groups/${groupId}/reports/monthly`, { params: { year } }),
  categories: (groupId) => apiClient.get(`/groups/${groupId}/reports/categories`),
};

export const activityApi = {
  group: (groupId, params) => apiClient.get(`/groups/${groupId}/activity`, { params }),
  user: (params) => apiClient.get('/users/me/activity', { params }),
};

export const notificationsApi = {
  list: (params) => apiClient.get('/notifications', { params }),
  unreadCount: () => apiClient.get('/notifications/unread-count'),
  markRead: (id) => apiClient.patch(`/notifications/${id}/read`),
  markAllRead: () => apiClient.patch('/notifications/read-all'),
};

export const budgetsApi = {
  list: (groupId, params) => apiClient.get(`/groups/${groupId}/budgets`, { params }),
  get: (groupId, budgetId) => apiClient.get(`/groups/${groupId}/budgets/${budgetId}`),
  getActive: (groupId) => apiClient.get(`/groups/${groupId}/budgets/active`),
  getAlerts: (groupId) => apiClient.get(`/groups/${groupId}/budgets/alerts`),
  create: (groupId, data) => apiClient.post(`/groups/${groupId}/budgets`, data),
  update: (groupId, budgetId, data) => apiClient.patch(`/groups/${groupId}/budgets/${budgetId}`, data),
  delete: (groupId, budgetId) => apiClient.delete(`/groups/${groupId}/budgets/${budgetId}`),
  restore: (groupId, budgetId) => apiClient.post(`/groups/${groupId}/budgets/${budgetId}/restore`),
};

export const recurringApi = {
  list: (groupId, params) => apiClient.get(`/groups/${groupId}/recurring-expenses`, { params }),
  get: (groupId, id) => apiClient.get(`/groups/${groupId}/recurring-expenses/${id}`),
  create: (groupId, data) => apiClient.post(`/groups/${groupId}/recurring-expenses`, data),
  update: (groupId, id, data) => apiClient.patch(`/groups/${groupId}/recurring-expenses/${id}`, data),
  delete: (groupId, id) => apiClient.delete(`/groups/${groupId}/recurring-expenses/${id}`),
  processDue: (groupId) => apiClient.post(`/groups/${groupId}/recurring-expenses/process`),
};

export const usersApi = {
  updateProfile: (data) => apiClient.patch('/users/me', data),
};

export const eventsApi = {
  list: (groupId) => apiClient.get(`/groups/${groupId}/events`),
  get: (groupId, eventId) => apiClient.get(`/groups/${groupId}/events/${eventId}`),
  create: (groupId, data) => apiClient.post(`/groups/${groupId}/events`, data),
  update: (groupId, eventId, data) => apiClient.patch(`/groups/${groupId}/events/${eventId}`, data),
  delete: (groupId, eventId) => apiClient.delete(`/groups/${groupId}/events/${eventId}`),
  saveAttendance: (groupId, eventId, attendance) => apiClient.post(`/groups/${groupId}/events/${eventId}/attendance`, { attendance }),
  getAttendance: (groupId, eventId) => apiClient.get(`/groups/${groupId}/events/${eventId}/attendance`),
  getLedger: (groupId, eventId) => apiClient.get(`/groups/${groupId}/events/${eventId}/ledger`),
};

export const corporateApi = {
  getDepartments: (groupId) => apiClient.get(`/groups/${groupId}/corporate/departments`),
  createDepartment: (groupId, data) => apiClient.post(`/groups/${groupId}/corporate/departments`, data),
  getCostCenters: (groupId) => apiClient.get(`/groups/${groupId}/corporate/cost-centers`),
  createCostCenter: (groupId, data) => apiClient.post(`/groups/${groupId}/corporate/cost-centers`, data),
  getPending: (groupId) => apiClient.get(`/groups/${groupId}/corporate/manager/pending`),
  approve: (groupId, expenseId) => apiClient.patch(`/groups/${groupId}/corporate/expenses/${expenseId}/approve`),
  reject: (groupId, expenseId) => apiClient.patch(`/groups/${groupId}/corporate/expenses/${expenseId}/reject`),
  payrollExport: (groupId) => apiClient.get(`/groups/${groupId}/corporate/payroll/export`, { responseType: 'blob' }),
};
