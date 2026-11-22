/**
 * App lock: a PIN (and optionally the device's fingerprint / face unlock) that
 * covers the app on this device. It is a privacy screen for a shared or
 * borrowed phone, not encryption: the account itself is protected by the password.
 *
 * Stored per user in localStorage: { salt, pinHash, pinLength, credentialId?, after }.
 */
const keyFor = (userId) => `sme_lock_${userId}`;
const UNLOCKED_KEY = 'sme_unlocked'; // sessionStorage: survives reloads, not an app restart

export const LOCK_AFTER_OPTIONS = [
  { value: 0, label: 'Immediately' },
  { value: 1, label: '1 min' },
  { value: 5, label: '5 min' },
];

export function getLock(userId) {
  try {
    return JSON.parse(localStorage.getItem(keyFor(userId)));
  } catch {
    return null;
  }
}

const saveLock = (userId, lock) => localStorage.setItem(keyFor(userId), JSON.stringify(lock));
export const removeLock = (userId) => localStorage.removeItem(keyFor(userId));

const toBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  return toBase64(await crypto.subtle.digest('SHA-256', data));
}

export const isValidPin = (pin) => /^\d{4,6}$/.test(pin);

export async function setPin(userId, pin) {
  const salt = toBase64(randomBytes(16));
  const current = getLock(userId) || { after: 1 };
  saveLock(userId, { ...current, salt, pinLength: pin.length, pinHash: await hashPin(pin, salt) });
}

export async function verifyPin(userId, pin) {
  const lock = getLock(userId);
  return Boolean(lock) && (await hashPin(pin, lock.salt)) === lock.pinHash;
}

export function setLockAfter(userId, after) {
  const lock = getLock(userId);
  if (lock) saveLock(userId, { ...lock, after });
}

// ---- Session state ----
export const markUnlocked = () => sessionStorage.setItem(UNLOCKED_KEY, '1');
export const markLocked = () => sessionStorage.removeItem(UNLOCKED_KEY);
export const isMarkedUnlocked = () => sessionStorage.getItem(UNLOCKED_KEY) === '1';

// ---- Fingerprint / face unlock (WebAuthn platform authenticator) ----
export async function biometricAvailable() {
  try {
    return Boolean(window.PublicKeyCredential) && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

/** Registers this device's fingerprint / face unlock for the lock screen. */
export async function enableBiometric(userId, username) {
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: 'See My EX-pense', id: window.location.hostname },
      user: { id: randomBytes(16), name: username, displayName: username },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
    },
  });
  const lock = getLock(userId);
  saveLock(userId, { ...lock, credentialId: toBase64(credential.rawId) });
}

export function disableBiometric(userId) {
  const { credentialId, ...lock } = getLock(userId) || {};
  if (lock.pinHash) saveLock(userId, lock);
}

/** Asks for the fingerprint / face; resolves true when the device confirmed it's the owner. */
export async function verifyBiometric(userId) {
  const lock = getLock(userId);
  if (!lock?.credentialId) return false;
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [{ type: 'public-key', id: fromBase64(lock.credentialId) }],
      userVerification: 'required',
      timeout: 60000,
    },
  });
  return Boolean(assertion);
}
