import { createClient } from '@supabase/supabase-js';
import config from '../config/index.js';
import { badRequest } from '../utils/app-error.js';

let supabase = null;

function getSupabase() {
  if (!supabase && config.supabase.url && config.supabase.serviceKey) {
    supabase = createClient(config.supabase.url, config.supabase.serviceKey);
  }
  return supabase;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_DOC_TYPES = [...ALLOWED_IMAGE_TYPES, 'application/pdf', 'image/svg+xml'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;  // 5MB
const MAX_DOC_SIZE = 10 * 1024 * 1024;   // 10MB

export async function uploadFile(bucket, filePath, buffer, contentType) {
  const client = getSupabase();
  if (!client) throw badRequest('File upload not configured');

  const { data, error } = await client.storage
    .from(bucket)
    .upload(filePath, buffer, {
      contentType,
      upsert: true,
    });

  if (error) throw badRequest(`Upload failed: ${error.message}`);

  const { data: urlData } = client.storage.from(bucket).getPublicUrl(filePath);
  return urlData.publicUrl;
}

export async function deleteFile(bucket, filePath) {
  const client = getSupabase();
  if (!client) return;

  await client.storage.from(bucket).remove([filePath]);
}

export function validateImageFile(file) {
  if (!file) throw badRequest('No file provided');
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    throw badRequest(`Invalid file type. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`);
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw badRequest(`File too large. Max size: ${MAX_IMAGE_SIZE / 1024 / 1024}MB`);
  }
}

export function validateDocFile(file) {
  if (!file) throw badRequest('No file provided');
  if (!ALLOWED_DOC_TYPES.includes(file.mimetype)) {
    throw badRequest(`Invalid file type. Allowed: ${ALLOWED_DOC_TYPES.join(', ')}`);
  }
  if (file.size > MAX_DOC_SIZE) {
    throw badRequest(`File too large. Max size: ${MAX_DOC_SIZE / 1024 / 1024}MB`);
  }
}

export default { uploadFile, deleteFile, validateImageFile, validateDocFile };
