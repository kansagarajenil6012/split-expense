export const getPagination = (query) => {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

export const getSort = (query, allowedFields, defaultSort = '-created_at') => {
  const sortParam = query.sort || defaultSort;
  const desc = sortParam.startsWith('-');
  const field = desc ? sortParam.slice(1) : sortParam;
  if (!allowedFields.includes(field)) return { field: 'created_at', desc: true };
  return { field, desc };
};
