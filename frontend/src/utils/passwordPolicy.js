// Mirrors backend/src/utils/passwordValidator.js - keep in sync.
export const PASSWORD_RULES = [
  { key: 'length',  label: 'At least 8 characters',              test: (pw) => pw.length >= 8 },
  { key: 'upper',   label: 'One uppercase letter (A–Z)',          test: (pw) => /[A-Z]/.test(pw) },
  { key: 'lower',   label: 'One lowercase letter (a–z)',          test: (pw) => /[a-z]/.test(pw) },
  { key: 'digit',   label: 'One number (0–9)',                    test: (pw) => /\d/.test(pw) },
  { key: 'special', label: 'One special character (e.g. !@#$%)',  test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

const COMMON = new Set([
  'password', 'password1', 'password123', 'passw0rd', 'p@ssw0rd',
  '12345678', '123456789', '1234567890', '12345678a',
  'qwerty123', 'qwertyuiop', 'qwerty12345',
  'iloveyou1', 'admin1234', 'letmein123', 'welcome123', 'welcome1',
  'abc123456', '11111111', '00000000', '1q2w3e4r', 'zaq12wsx',
  'nigeria123', 'lagos1234', 'abuja1234',
]);

/** Returns { valid, errors, score (0-4) } for a candidate password. */
export function validatePassword(password, context = {}) {
  const pw = String(password || '');
  const errors = PASSWORD_RULES.filter((r) => !r.test(pw)).map((r) => r.label);

  if (/(.)\1{2,}/.test(pw)) errors.push('No 3+ repeated characters in a row');
  if (COMMON.has(pw.toLowerCase())) errors.push('This password is too common');

  const emailLocal = String(context.email || '').split('@')[0].toLowerCase().trim();
  if (emailLocal.length >= 4 && pw.toLowerCase().includes(emailLocal)) {
    errors.push('Password must not contain your email address');
  }
  const name = String(context.name || '').toLowerCase().trim();
  if (name.length >= 4 && pw.toLowerCase().includes(name)) {
    errors.push('Password must not contain your name');
  }

  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score += 1;
  if (pw.length >= 16) score += 1;

  return { valid: errors.length === 0, errors, score: Math.min(score, 4) };
}

export const STRENGTH_META = [
  { label: '',                   color: 'bg-gray-200' },
  { label: 'Too weak',           color: 'bg-red-500' },
  { label: 'Could be stronger',  color: 'bg-amber-500' },
  { label: 'Good',               color: 'bg-lime-500' },
  { label: 'Strong',             color: 'bg-emerald-500' },
];
