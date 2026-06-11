import multer from 'multer';
import { badRequest } from '../utils/app-error.js';

const storage = multer.memoryStorage();

const imageFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(badRequest('Only image files (JPEG, PNG, WebP, GIF) are allowed'), false);
  }
};

const docFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'image/svg+xml'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(badRequest('Only image and PDF files are allowed'), false);
  }
};

export const uploadImage = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('file');

export const uploadDocument = multer({
  storage,
  fileFilter: docFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).single('file');

export const uploadDocuments = multer({
  storage,
  fileFilter: docFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).array('files', 5);

export default { uploadImage, uploadDocument, uploadDocuments };
