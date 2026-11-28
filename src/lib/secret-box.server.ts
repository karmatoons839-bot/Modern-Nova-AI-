// AES-GCM helper for owner-saved API keys.
async function encryptionKey(secret: string) {
  return crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)), 'AES-GCM', false, ['encrypt','decrypt']);
}
export async function encryptSecret(token: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(secret), new TextEncoder().encode(token)));
  return `${btoa(String.fromCharCode(...iv))}.${btoa(String.fromCharCode(...encrypted))}`;
}
export async function decryptSecret(value: string, secret: string) {
  const [nonce, payload] = value.split('.');
  if (!nonce || !payload) throw new Error('Server credentials must be configured again');
  const bytes = (v: string) => Uint8Array.from(atob(v), c=>c.charCodeAt(0));
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(nonce) }, await encryptionKey(secret), bytes(payload)));
}
