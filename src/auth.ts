import {
  getSessionUser,
  readUsers,
  saveSessionEmail,
  saveUsers,
  type StoredUser,
} from './storage';

const demoEmail = 'demo@asterrow.com';
const demoPasswordHash =
  '7394a207c8a73f6ca2e6cf26ec2eaca9994251dc72aa4fb3e5508470ec7d3bfb';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string): Promise<string> {
  if (!window.crypto?.subtle) {
    throw new Error('Secure browser hashing is unavailable in this browser.');
  }
  const bytes = new TextEncoder().encode(password);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function ensureDemoAccount(): StoredUser {
  const users = readUsers();
  const existing = users.find((user) => user.email === demoEmail);
  if (existing) return existing;
  const demo: StoredUser = {
    id: 'demo-curator',
    name: 'Demo Curator',
    email: demoEmail,
    passwordHash: demoPasswordHash,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  saveUsers([...users, demo]);
  return demo;
}

export async function registerUser(
  name: string,
  email: string,
  password: string,
): Promise<StoredUser> {
  const normalizedEmail = normalizeEmail(email);
  const users = readUsers();
  if (users.some((user) => user.email === normalizedEmail)) {
    throw new Error('An account with this email already exists.');
  }
  const user: StoredUser = {
    id: `user-${Date.now()}`,
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  if (!saveUsers([...users, user]) || !saveSessionEmail(user.email)) {
    throw new Error('This browser could not save the demo account.');
  }
  return user;
}

export async function loginUser(
  email: string,
  password: string,
): Promise<StoredUser> {
  const normalizedEmail = normalizeEmail(email);
  const user = readUsers().find((candidate) => candidate.email === normalizedEmail);
  if (!user || user.passwordHash !== (await hashPassword(password))) {
    throw new Error('That email and password combination was not recognized.');
  }
  if (!saveSessionEmail(user.email)) {
    throw new Error('This browser could not save the demo session.');
  }
  return user;
}

export function logoutUser(): void {
  saveSessionEmail(null);
}

export { demoEmail, getSessionUser };