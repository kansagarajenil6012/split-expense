export const success = (res, data, statusCode = 200, meta = null) => {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
};

export const created = (res, data, meta = null) => success(res, data, 201, meta);

export const noContent = (res) => res.status(204).send();

export const paginated = (res, data, { page, limit, total }) =>
  success(res, data, 200, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
