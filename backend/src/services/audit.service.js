import activityLogsRepository from '../repositories/activity-logs.repository.js';
import auditLogsRepository from '../repositories/audit-logs.repository.js';

export async function logActivity(data, client = null) {
  return activityLogsRepository.create(data, client);
}

export async function logAudit(data, client = null) {
  return auditLogsRepository.create(data, client);
}

export function getChangedFields(before, after) {
  if (!before || !after) return [];
  return Object.keys(after).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
}

export function getRequestMeta(req) {
  return {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    requestId: req.requestId,
  };
}

export default { logActivity, logAudit, getChangedFields, getRequestMeta };
