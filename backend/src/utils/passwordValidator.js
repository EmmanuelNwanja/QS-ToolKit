const logger = require('./logger');

/**
 * Strong password policy for QSToolkit.
 *
 * Rules:
 *  - Minimum 8 characters, maximum 128 (bcrypt truncates >72; 128 is a sane cap)
 *  - At least one uppercase letter
 *  - At least one lowercase letter
 *  - At least one digit
 *  - At least one special character
 *  - Must not contain obvious weak patterns (3+ repeated chars, common passwords,
 *    "password"/"qwerty" family, user's own email local-part)
 */

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

// Small denylist — blocks the most common leaked passwords without shipping
// a multi-megabyte wordlist. Extend as needed.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'passw0rd', 'p@ssw0rd',
  '12345678', '123456789', '1234567890', '12345678a',
  'qwerty123', 'qwertyuiop', 'qwerty12345',
  'iloveyou1', 'admin1234', 'letmein123', 'welcome123', 'welcome1',
  'abc123456', '11111111', '00000000', '1q2w3e4r', 'zaq12wsx',
  'nigeria123', 'lagos1234', 'abuja1234'
]);

const UPPER = /[A-Z]/;
const LOWER = /[a-z]/;
const DIGIT = /\d/;
const SPECIAL = /[^A-Za-z0-9]/;

/**
 * Validate a candidate password.
 *
 * @param {string} password
 * @param {{ email?: string, name?: string }} [context] optional user context for personal-info checks
 * @returns {{ valid: boolean, errors: string[], score: number }}
 *   score 0-4: 0 fail, 1 weak, 2 fair, 3 strong, 4 very strong (informational only)
 */
function validatePassword(password, context = {}) {
  const errors = [];
  const pw = String(password || '');

  if (pw.length < MIN_LENGTH) {
    errors.push(`Password must be at least ${MIN_LENGTH} characters long`);
  }
  if (pw.length > MAX_LENGTH) {
    errors.push(`Password must be at most ${MAX_LENGTH} characters long`);
  }
  if (!UPPER.test(pw)) errors.push('Password must contain at least one uppercase letter');
  if (!LOWER.test(pw)) errors.push('Password must contain at least one lowercase letter');
  if (!DIGIT.test(pw)) errors.push('Password must contain at least one number');
  if (!SPECIAL.test(pw)) errors.push('Password must contain at least one special character (e.g. !@#$%)');

  // Obvious patterns
  const lower = pw.toLowerCase();
  if (/(.)\1{2,}/.test(pw)) {
    errors.push('Password must not contain 3 or more repeated characters in a row');
  }
  if (COMMON_PASSWORDS.has(lower)) {
    errors.push('This password is too common. Please choose a stronger one');
  }
  if (/(password|qwerty|123456|letmein|welcome)/.test(lower) && lower.length <= 16) {
    errors.push('Password contains a common word or pattern. Please choose a stronger one');
  }

  // Personal info: email local-part and name must not appear verbatim
  const emailLocal = String(context.email || '').split('@')[0].toLowerCase().trim();
  if (emailLocal.length >= 4 && lower.includes(emailLocal)) {
    errors.push('Password must not contain your email address');
  }
  const name = String(context.name || '').toLowerCase().trim();
  if (name.length >= 4 && lower.includes(name)) {
    errors.push('Password must not contain your name');
  }

  // Informational strength score (not gating)
  let score = 0;
  if (pw.length >= MIN_LENGTH) score += 1;
  if (pw.length >= 12) score += 1;
  if (UPPER.test(pw) && LOWER.test(pw) && DIGIT.test(pw) && SPECIAL.test(pw)) score += 1;
  if (pw.length >= 16) score += 1;

  return { valid: errors.length === 0, errors, score: Math.min(score, 4) };
}

/**
 * Express middleware-style guard: returns the first error message or null.
 * Keeps controller code short.
 */
function firstPasswordError(password, context) {
  const result = validatePassword(password, context);
  return result.valid ? null : result.errors[0];
}

module.exports = { validatePassword, firstPasswordError, MIN_LENGTH, MAX_LENGTH };
