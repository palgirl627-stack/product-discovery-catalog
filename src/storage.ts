import type { Product } from './api';

export type StoredUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

export type ManagedProduct = Product & {
  source: 'local';
  ownerEmail: string;
  createdAt: string;
  updatedAt: string;
};

const keys = {
  users: 'aster-row.users.v1',
  session: 'aster-row.session.v1',
  products: 'aster-row.managed-products.v1',
} as const;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function isStoredUser(value: unknown): value is StoredUser {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<StoredUser>;
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.email === 'string' &&
    typeof item.passwordHash === 'string' &&
    typeof item.createdAt === 'string'
  );
}

function isManagedProduct(value: unknown): value is ManagedProduct {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ManagedProduct>;
  return (
    item.source === 'local' &&
    typeof item.ownerEmail === 'string' &&
    typeof item.createdAt === 'string' &&
    typeof item.updatedAt === 'string' &&
    typeof item.id === 'number' &&
    typeof item.title === 'string' &&
    typeof item.price === 'number' &&
    typeof item.description === 'string' &&
    typeof item.category === 'string' &&
    typeof item.image === 'string' &&
    !!item.rating &&
    typeof item.rating.rate === 'number' &&
    typeof item.rating.count === 'number'
  );
}

export function readUsers(): StoredUser[] {
  const value = readJson<unknown>(keys.users, []);
  return Array.isArray(value) ? value.filter(isStoredUser) : [];
}

export function saveUsers(users: StoredUser[]): boolean {
  return writeJson(keys.users, users);
}

export function readSessionEmail(): string | null {
  const value = readJson<unknown>(keys.session, null);
  return typeof value === 'string' ? value : null;
}

export function saveSessionEmail(email: string | null): boolean {
  if (email === null) {
    try {
      window.localStorage.removeItem(keys.session);
      return true;
    } catch {
      return false;
    }
  }
  return writeJson(keys.session, email);
}

export function readManagedProducts(): ManagedProduct[] {
  const value = readJson<unknown>(keys.products, []);
  return Array.isArray(value) ? value.filter(isManagedProduct) : [];
}

export function saveManagedProducts(products: ManagedProduct[]): boolean {
  return writeJson(keys.products, products);
}

export function getSessionUser(): StoredUser | null {
  const email = readSessionEmail();
  if (!email) return null;
  return readUsers().find((user) => user.email === email) ?? null;
}