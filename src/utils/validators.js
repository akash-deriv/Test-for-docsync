function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePassword(password) {
  // At least 8 characters, one uppercase, one lowercase, one number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
}

function validateTaskPriority(priority) {
  return ['low', 'medium', 'high', 'urgent'].includes(priority);
}

function validateTaskStatus(status) {
  return ['todo', 'in_progress', 'completed', 'archived'].includes(status);
}

module.exports = {
  validateEmail,
  validatePassword,
  validateTaskPriority,
  validateTaskStatus,
};
