const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.details,
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized access',
    });
  }

  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal server error',
  });
}

module.exports = { errorHandler };
