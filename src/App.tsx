import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  CircleAlert,
  CircleX,
  Moon,
  PackageOpen,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  X,
} from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getCategories, getProducts, type Product } from './api';

const queryClient = new QueryClient();
const storageKeys = {
  theme: 'atelier-cart.theme',
  category: 'atelier-cart.category',
  sort: 'atelier-cart.sort',
  cart: 'atelier-cart.cart',
};

type SortOption = 'default' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc' | 'rating';
type CartItem = { product: Product; quantity: number };
const sortOptions: SortOption[] = ['default', 'price-asc', 'price-desc', 'name-asc', 'name-desc', 'rating'];

function readStored<T>(
  key: string,
  fallback: T,
  isValid?: (value: unknown) => value is T,
): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const value: unknown = JSON.parse(raw);
    return !isValid || isValid(value) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Browsing remains fully usable if storage is unavailable.
  }
}

function formatCategory(category: string): string {
  return category
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
}

function isSortOption(value: unknown): value is SortOption {
  return typeof value === 'string' && sortOptions.includes(value as SortOption);
}

function isTheme(value: unknown): value is 'light' | 'dark' {
  return value === 'light' || value === 'dark';
}

function isCategorySelection(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isCart(value: unknown): value is CartItem[] {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!item || typeof item !== 'object') return false;
      const candidate = item as { product?: unknown; quantity?: unknown };
      if (typeof candidate.quantity !== 'number' || candidate.quantity < 1 || !Number.isInteger(candidate.quantity)) return false;
      if (!candidate.product || typeof candidate.product !== 'object') return false;
      const product = candidate.product as Partial<Product>;
      return (
        typeof product.id === 'number' &&
        typeof product.title === 'string' &&
        typeof product.price === 'number' &&
        typeof product.category === 'string' &&
        typeof product.image === 'string' &&
        !!product.rating &&
        typeof product.rating.rate === 'number' &&
        typeof product.rating.count === 'number'
      );
    })
  );
}

function ProductImage({ product, large = false }: { product: Product; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed || !product.image) {
    return (
      <div className={`flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground ${large ? 'min-h-64' : ''}`}>
        <PackageOpen size={34} strokeWidth={1.4} aria-hidden="true" />
        <span className="text-xs">Image unavailable</span>
      </div>
    );
  }
  return (
    <img
      src={product.image}
      alt={product.title}
      className="product-image h-full w-full object-contain p-7"
      onError={() => setFailed(true)}
    />
  );
}

function Rating({ product }: { product: Product }) {
  const rounded = Math.round(product.rating.rate);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" data-testid={`text-rating-${product.id}`}>
      <span className="inline-flex items-center gap-0.5 text-primary" aria-label={`${product.rating.rate} out of 5 stars`}>
        {Array.from({ length: 5 }, (_, index) => (
          <Star key={index} size={12} fill={index < rounded ? 'currentColor' : 'none'} strokeWidth={1.7} aria-hidden="true" />
        ))}
      </span>
      <span>{product.rating.rate.toFixed(1)} · {product.rating.count} reviews</span>
    </span>
  );
}

function ProductCard({
  product,
  onAdd,
  onDetails,
}: {
  product: Product;
  onAdd: (product: Product) => void;
  onDetails: (product: Product) => void;
}) {
  return (
    <article className="product-card rise-in flex min-w-0 flex-col overflow-hidden rounded-2xl" data-testid={`card-product-${product.id}`}>
      <button
        type="button"
        className="product-image-wrap group relative h-64 w-full overflow-hidden border-b border-card-border text-left sm:h-72"
        onClick={() => onDetails(product)}
        aria-label={`View details for ${product.title}`}
        data-testid={`button-details-image-${product.id}`}
      >
        <ProductImage product={product} />
        <span className="absolute right-4 top-4 rounded-full bg-card/90 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.15em] text-muted-foreground shadow-sm opacity-0 transition-opacity group-hover:opacity-100">
          View details
        </span>
      </button>
      <div className="flex flex-1 flex-col p-5">
        <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[.18em] text-primary">{formatCategory(product.category)}</p>
        <button
          type="button"
          className="min-h-[3.4rem] text-left font-display text-xl leading-tight text-card-foreground transition-colors hover:text-primary"
          onClick={() => onDetails(product)}
          data-testid={`button-details-title-${product.id}`}
        >
          {product.title}
        </button>
        <div className="mt-3"><Rating product={product} /></div>
        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <span className="text-lg font-extrabold tracking-tight text-card-foreground" data-testid={`text-price-${product.id}`}>{formatPrice(product.price)}</span>
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 active:translate-y-0"
            onClick={() => onAdd(product)}
            data-testid={`button-add-cart-${product.id}`}
          >
            <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
            <span className="hidden sm:inline">Add to cart</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-card-border bg-card" aria-hidden="true">
      <div className="skeleton h-64 sm:h-72" />
      <div className="space-y-3 p-5">
        <div className="skeleton h-3 w-20 rounded" />
        <div className="skeleton h-5 w-full rounded" />
        <div className="skeleton h-5 w-3/4 rounded" />
        <div className="skeleton h-4 w-28 rounded" />
        <div className="flex justify-between pt-3"><div className="skeleton h-6 w-16 rounded" /><div className="skeleton h-11 w-24 rounded-full" /></div>
      </div>
    </div>
  );
}

function CartDrawer({
  items,
  onClose,
  onChange,
  onRemove,
  onClear,
}: {
  items: CartItem[];
  onClose: () => void;
  onChange: (id: number, amount: number) => void;
  onRemove: (id: number) => void;
  onClear: () => void;
}) {
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <button type="button" className="drawer-backdrop absolute inset-0 h-full w-full cursor-default" onClick={onClose} aria-label="Close cart" data-testid="button-close-cart-backdrop" />
      <aside className="drawer absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-card text-card-foreground" data-testid="panel-cart">
        <div className="flex items-center justify-between border-b border-card-border px-6 py-5">
          <div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-primary">Your selection</p><h2 className="font-display text-3xl">Cart <span className="font-sans text-sm text-muted-foreground">({count})</span></h2></div>
          <button type="button" className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onClose} aria-label="Close shopping cart" data-testid="button-close-cart"><X size={20} /></button>
        </div>
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <span className="mb-5 flex size-16 items-center justify-center rounded-full bg-accent text-foreground"><ShoppingBag size={27} strokeWidth={1.6} /></span>
            <h3 className="font-display text-2xl">Your cart is quiet.</h3>
            <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Save a few pieces here while you explore the collection.</p>
            <button type="button" className="mt-6 rounded-full border border-border px-5 py-2.5 text-sm font-bold hover:bg-muted" onClick={onClose} data-testid="button-continue-shopping">Continue browsing</button>
          </div>
        ) : (
          <>
            <div className="hide-scrollbar flex-1 space-y-4 overflow-y-auto p-6">
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="flex gap-3" data-testid={`row-cart-${product.id}`}>
                  <div className="h-20 w-20 shrink-0 rounded-xl bg-muted p-2"><ProductImage product={product} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{product.title}</p>
                    <p className="mt-1 text-sm font-extrabold text-primary">{formatPrice(product.price)}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="inline-flex items-center rounded-full border border-border">
                        <button type="button" className="size-8 text-lg text-muted-foreground hover:text-foreground" onClick={() => onChange(product.id, quantity - 1)} aria-label={`Decrease ${product.title} quantity`} data-testid={`button-decrease-${product.id}`}>−</button>
                        <span className="w-7 text-center text-xs font-bold" data-testid={`text-quantity-${product.id}`}>{quantity}</span>
                        <button type="button" className="size-8 text-lg text-muted-foreground hover:text-foreground" onClick={() => onChange(product.id, quantity + 1)} aria-label={`Increase ${product.title} quantity`} data-testid={`button-increase-${product.id}`}>+</button>
                      </div>
                      <button type="button" className="text-xs font-bold text-muted-foreground underline-offset-2 hover:text-destructive hover:underline" onClick={() => onRemove(product.id)} data-testid={`button-remove-${product.id}`}>Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-card-border p-6">
              <div className="mb-5 flex items-center justify-between"><span className="text-sm text-muted-foreground">Estimated total</span><strong className="text-2xl">{formatPrice(total)}</strong></div>
              <button type="button" className="w-full rounded-full bg-primary py-3.5 text-sm font-extrabold text-primary-foreground hover:brightness-105" onClick={() => window.alert('Checkout is ready for your next step.')} data-testid="button-checkout">Continue to checkout</button>
              <button type="button" className="mt-3 w-full py-2 text-xs font-bold text-muted-foreground hover:text-destructive" onClick={onClear} data-testid="button-clear-cart">Clear cart</button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function DetailsDialog({ product, onClose, onAdd }: { product: Product; onClose: () => void; onAdd: (product: Product) => void }) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);
  return (
    <div className="dialog-backdrop fixed inset-0 z-40 flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="details-title">
      <button type="button" className="absolute inset-0 h-full w-full cursor-default" onClick={onClose} aria-label="Close product details" data-testid="button-close-details-backdrop" />
      <section className="dialog-card relative max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-card text-card-foreground sm:rounded-3xl" data-testid={`dialog-product-${product.id}`}>
        <button type="button" className="absolute right-4 top-4 z-10 rounded-full bg-card/90 p-2 text-muted-foreground shadow-sm hover:text-foreground" onClick={onClose} aria-label="Close product details" data-testid="button-close-details"><X size={20} /></button>
        <div className="grid md:grid-cols-[.85fr_1.15fr]">
          <div className="product-image-wrap flex min-h-72 items-center justify-center p-8 md:min-h-[30rem]"><ProductImage product={product} large /></div>
          <div className="flex flex-col p-7 sm:p-10">
            <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-primary">{formatCategory(product.category)}</p>
            <h2 id="details-title" className="mt-3 font-display text-4xl leading-[1.02] sm:text-5xl">{product.title}</h2>
            <div className="mt-5"><Rating product={product} /></div>
            <p className="mt-7 text-sm leading-7 text-muted-foreground">{product.description}</p>
            <div className="mt-auto flex flex-wrap items-center gap-4 pt-8"><strong className="text-3xl">{formatPrice(product.price)}</strong><button type="button" className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-extrabold text-primary-foreground hover:brightness-105 sm:flex-none" onClick={() => onAdd(product)} data-testid={`button-add-details-${product.id}`}><ShoppingBag size={17} /> Add to cart</button></div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Catalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [productsFromCache, setProductsFromCache] = useState(false);
  const [categoriesFromCache, setCategoriesFromCache] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(() => readStored(storageKeys.category, 'all', isCategorySelection));
  const [sort, setSort] = useState<SortOption>(() => readStored(storageKeys.sort, 'default', isSortOption));
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const previewTheme = new URLSearchParams(window.location.search).get('theme');
    if (previewTheme === 'dark' || previewTheme === 'light') return previewTheme;
    return readStored(storageKeys.theme, 'light', isTheme);
  });
  const [cart, setCart] = useState<CartItem[]>(() => readStored(storageKeys.cart, [], isCart));
  const [cartOpen, setCartOpen] = useState(false);
  const [details, setDetails] = useState<Product | null>(null);
  const [toast, setToast] = useState('');

  const loadProducts = async () => {
    setProductsLoading(true);
    setError('');
    try {
      const result = await getProducts();
      setProducts(result.data);
      setProductsFromCache(result.fromCache);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'We could not load the collection.');
    } finally { setProductsLoading(false); }
  };

  const loadCategories = async () => {
    setCategoriesLoading(true);
    setCategoryError('');
    try {
      const result = await getCategories();
      setCategories(result.data);
      setCategoriesFromCache(result.fromCache);
    } catch (loadError) {
      setCategoryError(loadError instanceof Error ? loadError.message : 'Categories are unavailable.');
    } finally { setCategoriesLoading(false); }
  };

  useEffect(() => { void loadProducts(); void loadCategories(); }, []);
  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark'); writeStored(storageKeys.theme, theme); }, [theme]);
  useEffect(() => { writeStored(storageKeys.category, category); }, [category]);
  useEffect(() => { writeStored(storageKeys.sort, sort); }, [sort]);
  useEffect(() => { writeStored(storageKeys.cart, cart); }, [cart]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const matchesSearch = !query || product.title.toLowerCase().includes(query);
      const matchesCategory = category === 'all' || product.category === category;
      return matchesSearch && matchesCategory;
    });
    return filtered.sort((a, b) => {
      if (sort === 'price-asc') return a.price - b.price;
      if (sort === 'price-desc') return b.price - a.price;
      if (sort === 'name-asc') return a.title.localeCompare(b.title);
      if (sort === 'name-desc') return b.title.localeCompare(a.title);
      if (sort === 'rating') return b.rating.rate - a.rating.rate;
      return a.id - b.id;
    });
  }, [products, search, category, sort]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const addToCart = (product: Product) => {
    setCart((current) => {
      const found = current.find((item) => item.product.id === product.id);
      return found
        ? current.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { product, quantity: 1 }];
    });
    setToast(`${product.title} added to your cart`);
  };
  const changeQuantity = (id: number, amount: number) => {
    if (amount < 1) setCart((current) => current.filter((item) => item.product.id !== id));
    else setCart((current) => current.map((item) => item.product.id === id ? { ...item, quantity: amount } : item));
  };

  return (
    <div className="catalog-shell">
      <header className="topbar sticky top-0 z-30">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 sm:px-8 lg:px-12">
          <div className="flex items-center gap-3">
            <span className="brand-mark flex size-10 items-center justify-center rounded-xl" aria-hidden="true"><Sparkles size={19} /></span>
            <div><p className="font-display text-2xl leading-none">Aster & Row</p><p className="mt-1 hidden text-[9px] font-extrabold uppercase tracking-[.18em] text-muted-foreground sm:block">A considered collection</p></div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button type="button" className="rounded-full p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} data-testid="button-toggle-theme">{theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}</button>
            <button type="button" className="relative rounded-full p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setCartOpen(true)} aria-label={`Open cart with ${cartCount} items`} data-testid="button-open-cart"><ShoppingBag size={20} /><span className="absolute right-0 top-0 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-extrabold text-primary-foreground" data-testid="text-cart-count">{cartCount}</span></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 pb-20 sm:px-8 lg:px-12">
        <section className="grid gap-8 py-12 sm:py-16 lg:grid-cols-[1.25fr_.75fr] lg:items-end lg:py-20">
          <div>
            <p className="mb-5 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.22em] text-primary"><span className="h-px w-8 bg-primary" /> Good things, fewer things</p>
            <h1 className="max-w-3xl font-display text-5xl leading-[.96] tracking-tight text-balance sm:text-7xl">Objects with a <em className="text-primary">point of view.</em></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">A compact edit of useful, beautiful pieces for everyday rituals. Take your time — there is no rush in a considered choice.</p>
          </div>
          <div className="hidden justify-self-end rounded-3xl border border-card-border bg-card/55 p-6 lg:block lg:max-w-xs"><div className="mb-5 flex size-11 items-center justify-center rounded-2xl bg-accent"><Sparkles size={20} /></div><p className="font-display text-2xl leading-tight">Small collection.<br />Clear decisions.</p><p className="mt-3 text-sm leading-6 text-muted-foreground">Every piece earns its place here, so you can browse with a little more calm.</p></div>
        </section>

        <section className="control-surface rounded-2xl p-3 sm:p-4" aria-label="Product controls">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative flex min-h-12 flex-1 items-center">
              <Search size={18} className="absolute left-4 text-muted-foreground" aria-hidden="true" />
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the collection" className="h-12 w-full rounded-xl border border-transparent bg-muted/60 pl-11 pr-11 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:bg-card" aria-label="Search products by title" data-testid="input-search" />
              {search && <button type="button" className="absolute right-3 rounded-full p-1.5 text-muted-foreground hover:bg-card hover:text-foreground" onClick={() => setSearch('')} aria-label="Clear search" data-testid="button-clear-search"><CircleX size={17} /></button>}
            </label>
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={17} className="ml-1 text-muted-foreground" aria-hidden="true" />
              <label className="sr-only" htmlFor="sort-products">Sort products</label>
              <div className="relative flex-1 sm:flex-none">
                <select id="sort-products" value={sort} onChange={(event) => setSort(event.target.value as SortOption)} className="h-12 w-full min-w-44 appearance-none rounded-xl border border-border bg-card px-4 pr-10 text-sm font-bold outline-none focus:border-primary" data-testid="select-sort"><option value="default">Featured</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name-asc">Name: A to Z</option><option value="name-desc">Name: Z to A</option><option value="rating">Rating: highest first</option></select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-4 text-muted-foreground" aria-hidden="true" />
              </div>
            </div>
          </div>
          <div className="hide-scrollbar mt-3 flex gap-2 overflow-x-auto border-t border-border/70 pt-3">
            <button type="button" className={`category-pill shrink-0 rounded-full px-4 py-2 text-xs font-extrabold ${category === 'all' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'}`} onClick={() => setCategory('all')} data-testid="button-category-all">All products</button>
            {categoriesLoading && <span className="skeleton h-8 w-24 shrink-0 rounded-full" aria-label="Loading categories" />}
            {!categoriesLoading && categories.map((item) => <button type="button" key={item} className={`category-pill shrink-0 rounded-full px-4 py-2 text-xs font-extrabold ${category === item ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'}`} onClick={() => setCategory(item)} data-testid={`button-category-${item.replace(/\s+/g, '-')}`}>{formatCategory(item)}</button>)}
          </div>
        </section>

        {categoryError && !categoriesFromCache && <div className="mt-4 flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between" role="status" data-testid="status-category-error"><span className="flex items-center gap-2"><CircleAlert size={18} />{categoryError}</span><button type="button" className="self-start rounded-full border border-destructive/30 px-4 py-2 text-xs font-extrabold hover:bg-destructive/10 sm:self-auto" onClick={() => void loadCategories()} data-testid="button-retry-categories">Try again</button></div>}
        {(productsFromCache || categoriesFromCache) && <div className="mt-4 flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-foreground" role="status" data-testid="status-cached-products"><Check size={16} className="text-primary" />Showing your recently saved collection while we reconnect.</div>}
        {error && <div className="mt-4 flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between" role="alert" data-testid="banner-products-error"><span className="flex items-center gap-2"><CircleAlert size={18} />{error}</span><button type="button" className="self-start rounded-full border border-destructive/30 px-4 py-2 text-xs font-extrabold hover:bg-destructive/10 sm:self-auto" onClick={() => void loadProducts()} data-testid="button-retry-products">Try again</button></div>}

        <div className="mb-5 mt-10 flex items-end justify-between gap-4"><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-primary">The edit</p><h2 className="mt-1 font-display text-3xl sm:text-4xl">{category === 'all' ? 'Everything worth a look' : formatCategory(category)}</h2></div><p className="text-right text-xs text-muted-foreground" data-testid="text-results-count">{productsLoading ? 'Finding pieces…' : `${visibleProducts.length} ${visibleProducts.length === 1 ? 'piece' : 'pieces'}`}</p></div>

        {productsLoading ? <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <SkeletonCard key={index} />)}</div> : visibleProducts.length > 0 ? <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} onAdd={addToCart} onDetails={setDetails} />)}</div> : <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-card-border bg-card/55 px-6 text-center" data-testid="empty-products"><span className="mb-4 flex size-14 items-center justify-center rounded-full bg-accent"><Search size={24} /></span><h3 className="font-display text-2xl">Nothing in this corner yet.</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Try a different search or browse every piece in the collection.</p><button type="button" className="mt-5 rounded-full bg-foreground px-5 py-2.5 text-xs font-extrabold text-background" onClick={() => { setSearch(''); setCategory('all'); }} data-testid="button-reset-filters">Reset filters</button></div>}
      </main>

      <footer className="border-t border-border/80 px-4 py-8 text-center text-xs text-muted-foreground sm:px-8"><p className="font-display text-lg text-foreground">Aster & Row</p><p className="mt-2">A small, thoughtful place to browse.</p></footer>
      {cartOpen && <CartDrawer items={cart} onClose={() => setCartOpen(false)} onChange={changeQuantity} onRemove={(id) => changeQuantity(id, 0)} onClear={() => setCart([])} />}
      {details && <DetailsDialog product={details} onClose={() => setDetails(null)} onAdd={addToCart} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-4 py-3 text-xs font-bold text-background shadow-xl" role="status" data-testid="status-add-success"><Check size={15} className="text-primary" />{toast}</div>}
    </div>
  );
}

function Router() {
  return <ErrorBoundary><Catalog /></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><Router /><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;