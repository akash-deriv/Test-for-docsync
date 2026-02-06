const multer = require('multer');
const { UPLOAD_DIR, MAX_FILE_SIZE, generateFileName, validateFileType, validateFileSize } = require('../utils/fileUtils');

// Configure storage
const storage = multer.memoryStorage(); // Store in memory for validation before saving

// File filter
const fileFilter = (req, file, cb) => {
  const typeValidation = validateFileType(file.mimetype, file.originalname);

  if (!typeValidation.valid) {
    return cb(new Error(typeValidation.error), false);
  }

  cb(null, true);
};

// Create multer instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5, // Max 5 files per request
  },
  fileFilter: fileFilter,
});

// Error handler middleware
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024);
      return res.status(400).json({
        error: `File size exceeds maximum allowed size of ${maxSizeMB}MB.`
      });
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files. Maximum 5 files per upload.'
      });
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Unexpected field in upload.'
      });
    }

    return res.status(400).json({ error: err.message });
  }

  if (err) {
    return res.status(400).json({ error: err.message });
  }

  next();
};

module.exports = {
  upload,
  handleUploadError,
};
