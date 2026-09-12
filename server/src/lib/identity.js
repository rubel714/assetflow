const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  if (value == null) return null;
  const email = String(value).trim().toLowerCase();
  return email || null;
}

function isValidEmail(value) {
  return Boolean(value && EMAIL_PATTERN.test(value));
}

module.exports = { EMAIL_PATTERN, normalizeEmail, isValidEmail };
