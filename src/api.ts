export interface ProductRating {
  rate: number;
  count: number;
}

export interface Product {
  id: number;
  title: string;
  price: number;
  description: string;
  category: string;
  image: string;
  rating: ProductRating;
}

export interface ApiResult<T> {
  data: T;
  fromCache: boolean;
}

const PRODUCTS_URL = 'https://fakestoreapi.com/products';
const CATEGORIES_URL = 'https://fakestoreapi.com/products/categories';
const CACHE_TTL = 15 * 60 * 1000;
const productsCacheKey = 'atelier-cart.products.v1';
const categoriesCacheKey = 'atelier-cart.categories.v1';

const inFlight = new Map<string, Promise<ApiResult<unknown>>>();

function readStorage(key: string): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing and full storage should not prevent browsing.
  }
}

function readCache<T>(
  key: string,
  validator: (value: unknown) => value is T,
): T | null {
  try {
    const raw = readStorage(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('timestamp' in parsed) ||
      !('data' in parsed) ||
      typeof parsed.timestamp !== 'number' ||
      Date.now() - parsed.timestamp > CACHE_TTL ||
      !validator(parsed.data)
    ) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  const rating = item.rating as Record<string, unknown> | undefined;
  return (
    typeof item.id === 'number' &&
    typeof item.title === 'string' &&
    typeof item.price === 'number' &&
    typeof item.description === 'string' &&
    typeof item.category === 'string' &&
    typeof item.image === 'string' &&
    !!rating &&
    typeof rating.rate === 'number' &&
    typeof rating.count === 'number'
  );
}

function isProductList(value: unknown): value is Product[] {
  return Array.isArray(value) && value.length > 0 && value.every(isProduct);
}

function isCategoryList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

async function request<T>(
  url: string,
  cacheKey: string,
  validator: (value: unknown) => value is T,
): Promise<ApiResult<T>> {
  const cached = readCache(cacheKey, validator);
  if (cached) return { data: cached, fromCache: true };

  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Catalog service returned ${response.status}.`);
    const body: unknown = await response.json();
    if (!validator(body)) throw new Error('Catalog service returned an unexpected response.');
    writeStorage(cacheKey, { timestamp: Date.now(), data: body });
    return { data: body, fromCache: false };
  } catch (error) {
    if (cached) return { data: cached, fromCache: true };
    if (error instanceof TypeError) {
      throw new Error('We could not reach the catalog. Check your connection and try again.');
    }
    throw error instanceof Error
      ? error
      : new Error('The catalog is unavailable right now. Please try again.');
  }
}

function deduplicated<T>(
  url: string,
  cacheKey: string,
  validator: (value: unknown) => value is T,
): Promise<ApiResult<T>> {
  const current = inFlight.get(url) as Promise<ApiResult<T>> | undefined;
  if (current) return current;
  const promise = request(url, cacheKey, validator).finally(() => inFlight.delete(url));
  inFlight.set(url, promise as Promise<ApiResult<unknown>>);
  return promise;
}

export function getProducts(): Promise<ApiResult<Product[]>> {
  return deduplicated(PRODUCTS_URL, productsCacheKey, isProductList);
}

export function getCategories(): Promise<ApiResult<string[]>> {
  return deduplicated(CATEGORIES_URL, categoriesCacheKey, isCategoryList);
}