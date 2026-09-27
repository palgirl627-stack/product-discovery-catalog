import { useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Check,
  ChevronDown,
  CircleAlert,
  CircleX,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PackageOpen,
  Pencil,
  Plus,
  Search,
  Settings2,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getCategories, getProducts, type Product } from './api';
import {
  demoEmail,
  ensureDemoAccount,
  getSessionUser,
  loginUser,
  logoutUser,
  registerUser,
} from './auth';
import {
  readManagedProducts,
  saveManagedProducts,
  type ManagedProduct,
  type StoredUser,
} from './storage';

const queryClient = new QueryClient();
const storageKeys = {
  theme: 'atelier-cart.theme',
  category: 'atelier-cart.category',
  sort: 'atelier-cart.sort',
  cart: 'atelier-cart.cart',
};

type SortOption =
  | 'default'
  | 'price-asc'
  | 'price-desc'
  | 'name-asc'
  | 'name-desc'
  | 'rating';
type CartItem = { product: Product; quantity: number };
type View = 'catalog' | 'login' | 'register' | 'dashboard' | 'manage';
type ProductForm = {
  title: string;
  category: string;
  price: string;
  description: string;
  image: string;
};

const sortOptions: SortOption[] = [
  'default',
  'price-asc',
  'price-desc',
  'name-asc',
  'name-desc',
  'rating',
];

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
    // The app remains usable when browser storage is unavailable.
  }
}

function formatCategory(category: string): string {
  return category
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
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
      if (
        typeof candidate.quantity !== 'number' ||
        candidate.quantity < 1 ||
        !Number.isInteger(candidate.quantity)
      ) {
        return false;
      }
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

function isLocalProduct(product: Product): product is ManagedProduct {
  return product.id < 0;
}

function emptyProductForm(category = 'home & living'): ProductForm {
  return {
    title: '',
    category,
    price: '',
    description: '',
    image: '',
  };
}

function productToForm(product: ManagedProduct): ProductForm {
  return {
    title: product.title,
    category: product.category,
    price: String(product.price),
    description: product.description,
    image: product.image,
  };
}

function ProductImage({
  product,
  large = false,
}: {
  product: Product;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed || !product.image) {
    return (
      <div
        className={`flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground ${
          large ? 'min-h-64' : ''
        }`}
      >
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
    <span
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
      data-testid={`text-rating-${product.id}`}
    >
      <span
        className="inline-flex items-center gap-0.5 text-primary"
        aria-label={`${product.rating.rate} out of 5 stars`}
      >
        {Array.from({ length: 5 }, (_, index) => (
          <Star
            key={index}
            size={12}
            fill={index < rounded ? 'currentColor' : 'none'}
            strokeWidth={1.7}
            aria-hidden="true"
          />
        ))}
      </span>
      <span>
        {product.rating.rate.toFixed(1)} · {product.rating.count} reviews
      </span>
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
    <article
      className="product-card rise-in flex min-w-0 flex-col overflow-hidden rounded-2xl"
      data-testid={`card-product-${product.id}`}
    >
      <button
        type="button"
        className="product-image-wrap group relative h-64 w-full overflow-hidden border-b border-card-border text-left sm:h-72"
        onClick={() => onDetails(product)}
        aria-label={`View details for ${product.title}`}
      >
        <ProductImage product={product} />
        <span className="absolute right-4 top-4 rounded-full bg-card/90 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.15em] text-muted-foreground shadow-sm opacity-0 transition-opacity group-hover:opacity-100">
          View details
        </span>
      </button>
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-primary">
            {formatCategory(product.category)}
          </p>
          {isLocalProduct(product) && (
            <span className="rounded-full bg-accent px-2 py-1 text-[9px] font-extrabold uppercase tracking-[.12em] text-accent-foreground">
              Your product
            </span>
          )}
        </div>
        <button
          type="button"
          className="min-h-[3.4rem] text-left font-display text-xl leading-tight text-card-foreground transition-colors hover:text-primary"
          onClick={() => onDetails(product)}
        >
          {product.title}
        </button>
        <div className="mt-3">
          <Rating product={product} />
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <span className="text-lg font-extrabold tracking-tight text-card-foreground">
            {formatPrice(product.price)}
          </span>
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 active:translate-y-0"
            onClick={() => onAdd(product)}
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
        <div className="flex justify-between pt-3">
          <div className="skeleton h-6 w-16 rounded" />
          <div className="skeleton h-11 w-24 rounded-full" />
        </div>
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
      <button type="button" className="drawer-backdrop absolute inset-0 h-full w-full cursor-default" onClick={onClose} aria-label="Close cart" />
      <aside className="drawer absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-card text-card-foreground">
        <div className="flex items-center justify-between border-b border-card-border px-6 py-5">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-primary">Your selection</p>
            <h2 className="font-display text-3xl">Cart <span className="font-sans text-sm text-muted-foreground">({count})</span></h2>
          </div>
          <button type="button" className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onClose} aria-label="Close shopping cart"><X size={20} /></button>
        </div>
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <span className="mb-5 flex size-16 items-center justify-center rounded-full bg-accent text-foreground"><ShoppingBag size={27} strokeWidth={1.6} /></span>
            <h3 className="font-display text-2xl">Your cart is quiet.</h3>
            <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Save a few pieces here while you explore the collection.</p>
            <button type="button" className="mt-6 rounded-full border border-border px-5 py-2.5 text-sm font-bold hover:bg-muted" onClick={onClose}>Continue browsing</button>
          </div>
        ) : (
          <>
            <div className="hide-scrollbar flex-1 space-y-4 overflow-y-auto p-6">
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="flex gap-3">
                  <div className="h-20 w-20 shrink-0 rounded-xl bg-muted p-2"><ProductImage product={product} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{product.title}</p>
                    <p className="mt-1 text-sm font-extrabold text-primary">{formatPrice(product.price)}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="inline-flex items-center rounded-full border border-border">
                        <button type="button" className="size-8 text-lg text-muted-foreground hover:text-foreground" onClick={() => onChange(product.id, quantity - 1)} aria-label={`Decrease ${product.title} quantity`}>−</button>
                        <span className="w-7 text-center text-xs font-bold">{quantity}</span>
                        <button type="button" className="size-8 text-lg text-muted-foreground hover:text-foreground" onClick={() => onChange(product.id, quantity + 1)} aria-label={`Increase ${product.title} quantity`}>+</button>
                      </div>
                      <button type="button" className="text-xs font-bold text-muted-foreground underline-offset-2 hover:text-destructive hover:underline" onClick={() => onRemove(product.id)}>Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-card-border p-6">
              <div className="mb-5 flex items-center justify-between"><span className="text-sm text-muted-foreground">Estimated total</span><strong className="text-2xl">{formatPrice(total)}</strong></div>
              <button type="button" className="w-full rounded-full bg-primary py-3.5 text-sm font-extrabold text-primary-foreground hover:brightness-105" onClick={() => window.alert('Checkout is ready for your next step.')}>Continue to checkout</button>
              <button type="button" className="mt-3 w-full py-2 text-xs font-bold text-muted-foreground hover:text-destructive" onClick={onClear}>Clear cart</button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function DetailsDialog({
  product,
  onClose,
  onAdd,
}: {
  product: Product;
  onClose: () => void;
  onAdd: (product: Product) => void;
}) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);
  return (
    <div className="dialog-backdrop fixed inset-0 z-40 flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="details-title">
      <button type="button" className="absolute inset-0 h-full w-full cursor-default" onClick={onClose} aria-label="Close product details" />
      <section className="dialog-card relative max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-card text-card-foreground sm:rounded-3xl">
        <button type="button" className="absolute right-4 top-4 z-10 rounded-full bg-card/90 p-2 text-muted-foreground shadow-sm hover:text-foreground" onClick={onClose} aria-label="Close product details"><X size={20} /></button>
        <div className="grid md:grid-cols-[.85fr_1.15fr]">
          <div className="product-image-wrap flex min-h-72 items-center justify-center p-8 md:min-h-[30rem]"><ProductImage product={product} large /></div>
          <div className="flex flex-col p-7 sm:p-10">
            <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-primary">{formatCategory(product.category)}</p>
            <h2 id="details-title" className="mt-3 font-display text-4xl leading-[1.02] sm:text-5xl">{product.title}</h2>
            <div className="mt-5"><Rating product={product} /></div>
            <p className="mt-7 text-sm leading-7 text-muted-foreground">{product.description}</p>
            <div className="mt-auto flex flex-wrap items-center gap-4 pt-8"><strong className="text-3xl">{formatPrice(product.price)}</strong><button type="button" className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-extrabold text-primary-foreground hover:brightness-105 sm:flex-none" onClick={() => onAdd(product)}><ShoppingBag size={17} /> Add to cart</button></div>
          </div>
        </div>
      </section>
    </div>
  );
}

function AuthScreen({
  mode,
  onModeChange,
  onSuccess,
}: {
  mode: 'login' | 'register';
  onModeChange: (mode: 'login' | 'register') => void;
  onSuccess: (user: StoredUser) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState(mode === 'login' ? demoEmail : '');
  const [password, setPassword] = useState(mode === 'login' ? 'asterrow-demo' : '');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setError('');
    setEmail(mode === 'login' ? demoEmail : '');
    setPassword(mode === 'login' ? 'asterrow-demo' : '');
    setConfirmation('');
  }, [mode]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (mode === 'register' && !trimmedName) return setError('Please enter your name.');
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return setError('Enter a valid email address.');
    if (password.length < 8) return setError('Use at least 8 characters for your password.');
    if (mode === 'register' && password !== confirmation) return setError('Your password confirmations do not match.');
    setBusy(true);
    try {
      const user = mode === 'login'
        ? await loginUser(trimmedEmail, password)
        : await registerUser(trimmedName, trimmedEmail, password);
      onSuccess(user);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'We could not complete that request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-shell flex min-h-[calc(100dvh-73px)] items-center justify-center px-4 py-12 sm:px-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-card-border bg-card shadow-[var(--shadow-soft)] lg:grid-cols-[.9fr_1.1fr]">
        <div className="auth-intro flex flex-col justify-between p-7 sm:p-10">
          <div>
            <span className="brand-mark mb-8 flex size-11 items-center justify-center rounded-xl"><Sparkles size={20} /></span>
            <p className="text-[10px] font-extrabold uppercase tracking-[.22em] text-primary">A considered account</p>
            <h1 className="mt-4 font-display text-5xl leading-[.95] text-balance sm:text-6xl">{mode === 'login' ? 'Welcome back to the edit.' : 'Make the edit yours.'}</h1>
            <p className="mt-6 max-w-sm text-sm leading-7 text-muted-foreground">This educational demo keeps your account and product work in this browser only. No real payment or identity service is connected.</p>
          </div>
          <p className="mt-12 text-xs leading-5 text-muted-foreground">Aster & Row<br />Product discovery catalog</p>
        </div>
        <div className="p-7 sm:p-10">
          <div className="mb-8 flex items-center justify-between gap-3">
            <div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-primary">{mode === 'login' ? 'Sign in' : 'Create account'}</p><h2 className="mt-2 font-display text-3xl">{mode === 'login' ? 'Continue browsing' : 'Start your collection'}</h2></div>
            <button type="button" className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => onModeChange('login')} aria-label="Back to catalog"><X size={19} /></button>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            {mode === 'register' && <label className="block"><span className="form-label">Your name</span><input className="form-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Aster Row" autoComplete="name" /></label>}
            <label className="block"><span className="form-label">Email address</span><input className="form-input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" inputMode="email" /></label>
            <label className="block"><span className="form-label">Password</span><input className="form-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
            {mode === 'register' && <label className="block"><span className="form-label">Confirm password</span><input className="form-input" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Repeat your password" autoComplete="new-password" /></label>}
            {mode === 'login' && <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-xs leading-5 text-foreground"><strong>Demo access</strong><br />{demoEmail} · asterrow-demo</div>}
            {error && <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert"><CircleAlert className="mt-0.5 shrink-0" size={17} />{error}</div>}
            <button type="submit" disabled={busy} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-extrabold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Working…' : mode === 'login' ? 'Sign in to dashboard' : 'Create demo account'}</button>
          </form>
          <p className="mt-7 text-center text-sm text-muted-foreground">{mode === 'login' ? 'New to the edit?' : 'Already have an account?'} <button type="button" className="font-extrabold text-primary hover:underline" onClick={() => onModeChange(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
        </div>
      </div>
    </main>
  );
}

function DashboardView({
  user,
  products,
  localProducts,
  categories,
  onViewCatalog,
  onManage,
}: {
  user: StoredUser;
  products: Product[];
  localProducts: ManagedProduct[];
  categories: string[];
  onViewCatalog: () => void;
  onManage: () => void;
}) {
  const mine = localProducts.filter((product) => product.ownerEmail === user.email);
  const recentlyChanged = [...mine].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3);
  const stats: Array<{
    label: string;
    value: string | number;
    note: string;
    icon: ComponentType<{ size?: number; className?: string }>;
  }> = [
    { label: 'Catalog pieces', value: products.length, note: 'Available to browse', icon: LayoutDashboard },
    { label: 'Your products', value: mine.length, note: 'Local and editable', icon: Pencil },
    { label: 'Categories', value: categories.length, note: 'Across the edit', icon: BarChart3 },
    { label: 'Account status', value: 'Active', note: 'Demo session', icon: UserRound },
  ];
  return (
    <main className="mx-auto max-w-[1440px] px-4 pb-20 pt-10 sm:px-8 lg:px-12">
      <section className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><p className="text-[10px] font-extrabold uppercase tracking-[.22em] text-primary">Your studio</p><h1 className="mt-2 font-display text-5xl leading-none sm:text-6xl">Good morning, {user.name.split(' ')[0]}.</h1><p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">Keep browsing the shared edit or shape a few pieces of your own.</p></div>
        <button type="button" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-extrabold text-primary-foreground" onClick={onManage}><Plus size={16} /> Add a product</button>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, note, icon: Icon }) => (
          <div className="dashboard-card rounded-2xl p-5" key={label}><div className="mb-6 flex items-center justify-between"><p className="text-[10px] font-extrabold uppercase tracking-[.17em] text-muted-foreground">{label}</p><Icon size={18} className="text-primary" /></div><p className="font-display text-4xl">{value}</p><p className="mt-2 text-xs text-muted-foreground">{note}</p></div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <section className="dashboard-card rounded-2xl p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[.17em] text-primary">Recent work</p><h2 className="mt-2 font-display text-3xl">Your latest pieces</h2></div><button type="button" className="text-xs font-extrabold text-primary hover:underline" onClick={onManage}>Manage all</button></div>{recentlyChanged.length === 0 ? <div className="mt-6 rounded-xl border border-dashed border-card-border px-5 py-8 text-center text-sm text-muted-foreground">You have not created a product yet. Add one to see your work here.</div> : <div className="mt-6 space-y-3">{recentlyChanged.map((product) => <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3" key={product.id}><div className="h-14 w-14 shrink-0 rounded-lg bg-card p-1"><ProductImage product={product} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{product.title}</p><p className="mt-1 text-xs text-muted-foreground">{formatCategory(product.category)} · {formatPrice(product.price)}</p></div><Pencil size={16} className="text-muted-foreground" /></div>)}</div>}</section>
        <section className="dashboard-card rounded-2xl p-6"><p className="text-[10px] font-extrabold uppercase tracking-[.17em] text-primary">Quick links</p><h2 className="mt-2 font-display text-3xl">Keep exploring</h2><div className="mt-6 space-y-3"><button type="button" className="quick-link" onClick={onViewCatalog}><ShoppingBag size={18} /> View the complete catalog <ArrowLeft className="ml-auto rotate-180" size={16} /></button><button type="button" className="quick-link" onClick={onManage}><Settings2 size={18} /> Open product management <ArrowLeft className="ml-auto rotate-180" size={16} /></button></div><p className="mt-7 text-xs leading-5 text-muted-foreground">Dashboard numbers are calculated from the products loaded in this browser. They are not business analytics.</p></section>
      </div>
    </main>
  );
}

function ManageView({
  user,
  products,
  onSave,
  onDelete,
}: {
  user: StoredUser;
  products: ManagedProduct[];
  onSave: (form: ProductForm, existing?: ManagedProduct) => void;
  onDelete: (product: ManagedProduct) => void;
}) {
  const mine = products.filter((product) => product.ownerEmail === user.email);
  const [editing, setEditing] = useState<ManagedProduct | undefined>();
  const [form, setForm] = useState<ProductForm>(emptyProductForm());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const update = (key: keyof ProductForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const startEdit = (product: ManagedProduct) => { setEditing(product); setForm(productToForm(product)); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const reset = () => { setEditing(undefined); setForm(emptyProductForm()); setError(''); };
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const price = Number(form.price);
    if (!form.title.trim() || !form.category.trim() || !form.description.trim()) return setError('Title, category, and description are required.');
    if (!Number.isFinite(price) || price < 0) return setError('Enter a valid non-negative price.');
    setSaving(true);
    onSave({ ...form, price: price.toFixed(2) }, editing);
    setSaving(false);
    reset();
  };
  return (
    <main className="mx-auto max-w-[1440px] px-4 pb-20 pt-10 sm:px-8 lg:px-12">
      <section className="mb-8"><p className="text-[10px] font-extrabold uppercase tracking-[.22em] text-primary">Product management</p><h1 className="mt-2 font-display text-5xl leading-none sm:text-6xl">{editing ? 'Refine a piece.' : 'Add your own piece.'}</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">Local products are saved in this browser and marked separately from the read-only FakeStoreAPI collection.</p></section>
      <div className="grid gap-6 lg:grid-cols-[.78fr_1.22fr]">
        <section className="dashboard-card rounded-2xl p-6"><div className="mb-6 flex items-center justify-between"><div><p className="text-[10px] font-extrabold uppercase tracking-[.17em] text-primary">{editing ? 'Update product' : 'Create product'}</p><h2 className="mt-2 font-display text-3xl">{editing ? 'Edit details' : 'New catalog piece'}</h2></div>{editing && <button type="button" className="rounded-full p-2 text-muted-foreground hover:bg-muted" onClick={reset} aria-label="Cancel editing"><X size={18} /></button>}</div><form className="space-y-4" onSubmit={submit} noValidate><label className="block"><span className="form-label">Product name</span><input className="form-input" value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="Hand-thrown serving bowl" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="form-label">Category</span><input className="form-input" value={form.category} onChange={(event) => update('category', event.target.value.toLowerCase())} placeholder="home & living" /></label><label className="block"><span className="form-label">Price (USD)</span><input className="form-input" type="number" min="0" step="0.01" value={form.price} onChange={(event) => update('price', event.target.value)} placeholder="42.00" /></label></div><label className="block"><span className="form-label">Description</span><textarea className="form-input min-h-32 resize-y" value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="A short, useful description for the catalog." /></label><label className="block"><span className="form-label">Image URL <span className="font-normal text-muted-foreground">(optional)</span></span><input className="form-input" type="url" value={form.image} onChange={(event) => update('image', event.target.value)} placeholder="https://..." /></label>{error && <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert"><CircleAlert className="mt-0.5 shrink-0" size={17} />{error}</div>}<button type="submit" disabled={saving} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-extrabold text-primary-foreground disabled:opacity-60">{editing ? <Pencil size={16} /> : <Plus size={16} />}{editing ? 'Save changes' : 'Add to catalog'}</button></form></section>
        <section className="dashboard-card rounded-2xl p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[.17em] text-primary">Your inventory</p><h2 className="mt-2 font-display text-3xl">{mine.length} {mine.length === 1 ? 'piece' : 'pieces'}</h2></div><span className="rounded-full bg-accent px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.12em] text-accent-foreground">Editable</span></div>{mine.length === 0 ? <div className="mt-6 rounded-xl border border-dashed border-card-border px-5 py-10 text-center text-sm leading-6 text-muted-foreground">Nothing here yet. Use the form to create the first local product.</div> : <div className="mt-6 space-y-3">{mine.map((product) => <div className="flex items-center gap-3 rounded-xl border border-card-border p-3" key={product.id}><div className="h-16 w-16 shrink-0 rounded-lg bg-muted p-1"><ProductImage product={product} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{product.title}</p><p className="mt-1 text-xs text-muted-foreground">{formatPrice(product.price)} · {formatCategory(product.category)}</p></div><button type="button" className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => startEdit(product)} aria-label={`Edit ${product.title}`}><Pencil size={16} /></button><button type="button" className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => { if (window.confirm(`Delete ${product.title}?`)) onDelete(product); }} aria-label={`Delete ${product.title}`}><Trash2 size={16} /></button></div>)}</div>}</section>
      </div>
    </main>
  );
}

function CatalogView({
  products,
  categories,
  categoriesLoading,
  categoryError,
  productsLoading,
  productsFromCache,
  categoriesFromCache,
  error,
  search,
  setSearch,
  category,
  setCategory,
  sort,
  setSort,
  onRetryProducts,
  onRetryCategories,
  onAdd,
  onDetails,
}: {
  products: Product[];
  categories: string[];
  categoriesLoading: boolean;
  categoryError: string;
  productsLoading: boolean;
  productsFromCache: boolean;
  categoriesFromCache: boolean;
  error: string;
  search: string;
  setSearch: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  sort: SortOption;
  setSort: (value: SortOption) => void;
  onRetryProducts: () => void;
  onRetryCategories: () => void;
  onAdd: (product: Product) => void;
  onDetails: (product: Product) => void;
}) {
  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const haystack = `${product.title} ${product.category} ${product.description}`.toLowerCase();
      return (!query || haystack.includes(query)) && (category === 'all' || product.category === category);
    });
    return sort === 'default'
      ? filtered
      : [...filtered].sort((a, b) => {
          if (sort === 'price-asc') return a.price - b.price;
          if (sort === 'price-desc') return b.price - a.price;
          if (sort === 'name-asc') return a.title.localeCompare(b.title);
          if (sort === 'name-desc') return b.title.localeCompare(a.title);
          return b.rating.rate - a.rating.rate;
        });
  }, [products, search, category, sort]);

  return (
    <main className="mx-auto max-w-[1440px] px-4 pb-20 sm:px-8 lg:px-12">
      <section className="grid gap-8 py-12 sm:py-16 lg:grid-cols-[1.25fr_.75fr] lg:items-end lg:py-20"><div><p className="mb-5 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.22em] text-primary"><span className="h-px w-8 bg-primary" /> Good things, fewer things</p><h1 className="max-w-3xl font-display text-5xl leading-[.96] tracking-tight text-balance sm:text-7xl">Objects with a <em className="text-primary">point of view.</em></h1><p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">A compact edit of useful, beautiful pieces for everyday rituals. Take your time — there is no rush in a considered choice.</p></div><div className="hidden justify-self-end rounded-3xl border border-card-border bg-card/55 p-6 lg:block lg:max-w-xs"><div className="mb-5 flex size-11 items-center justify-center rounded-2xl bg-accent"><Sparkles size={20} /></div><p className="font-display text-2xl leading-tight">Small collection.<br />Clear decisions.</p><p className="mt-3 text-sm leading-6 text-muted-foreground">Every piece earns its place here, so you can browse with a little more calm.</p></div></section>
      <section className="control-surface rounded-2xl p-3 sm:p-4" aria-label="Product controls"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><label className="relative flex min-h-12 flex-1 items-center"><Search size={18} className="absolute left-4 text-muted-foreground" aria-hidden="true" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search names, categories, or descriptions" className="h-12 w-full rounded-xl border border-transparent bg-muted/60 pl-11 pr-11 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:bg-card" aria-label="Search products" />{search && <button type="button" className="absolute right-3 rounded-full p-1.5 text-muted-foreground hover:bg-card hover:text-foreground" onClick={() => setSearch('')} aria-label="Clear search"><CircleX size={17} /></button>}</label><div className="flex items-center gap-2"><SlidersHorizontal size={17} className="ml-1 text-muted-foreground" aria-hidden="true" /><label className="sr-only" htmlFor="sort-products">Sort products</label><div className="relative flex-1 sm:flex-none"><select id="sort-products" value={sort} onChange={(event) => setSort(event.target.value as SortOption)} className="h-12 w-full min-w-44 appearance-none rounded-xl border border-border bg-card px-4 pr-10 text-sm font-bold outline-none focus:border-primary"><option value="default">Featured</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name-asc">Name: A to Z</option><option value="name-desc">Name: Z to A</option><option value="rating">Rating: highest first</option></select><ChevronDown size={16} className="pointer-events-none absolute right-3 top-4 text-muted-foreground" aria-hidden="true" /></div></div></div><div className="hide-scrollbar mt-3 flex gap-2 overflow-x-auto border-t border-border/70 pt-3"><button type="button" className={`category-pill shrink-0 rounded-full px-4 py-2 text-xs font-extrabold ${category === 'all' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'}`} onClick={() => setCategory('all')}>All products</button>{categoriesLoading && <span className="skeleton h-8 w-24 shrink-0 rounded-full" aria-label="Loading categories" />}{!categoriesLoading && categories.map((item) => <button type="button" key={item} className={`category-pill shrink-0 rounded-full px-4 py-2 text-xs font-extrabold ${category === item ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'}`} onClick={() => setCategory(item)}>{formatCategory(item)}</button>)}</div></section>
      {categoryError && !categoriesFromCache && <div className="mt-4 flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between" role="status"><span className="flex items-center gap-2"><CircleAlert size={18} />{categoryError}</span><button type="button" className="self-start rounded-full border border-destructive/30 px-4 py-2 text-xs font-extrabold hover:bg-destructive/10 sm:self-auto" onClick={onRetryCategories}>Try again</button></div>}
      {(productsFromCache || categoriesFromCache) && <div className="mt-4 flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-foreground" role="status"><Check size={16} className="text-primary" />Showing your recently saved collection while we reconnect.</div>}
      {error && <div className="mt-4 flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between" role="alert"><span className="flex items-center gap-2"><CircleAlert size={18} />{error}</span><button type="button" className="self-start rounded-full border border-destructive/30 px-4 py-2 text-xs font-extrabold hover:bg-destructive/10 sm:self-auto" onClick={onRetryProducts}>Try again</button></div>}
      <div className="mb-5 mt-10 flex items-end justify-between gap-4"><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-primary">The edit</p><h2 className="mt-1 font-display text-3xl sm:text-4xl">{category === 'all' ? 'Everything worth a look' : formatCategory(category)}</h2></div><p className="text-right text-xs text-muted-foreground">{productsLoading ? 'Finding pieces…' : `${visibleProducts.length} ${visibleProducts.length === 1 ? 'piece' : 'pieces'}`}</p></div>
      {productsLoading ? <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <SkeletonCard key={index} />)}</div> : visibleProducts.length > 0 ? <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} onAdd={onAdd} onDetails={onDetails} />)}</div> : <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-card-border bg-card/55 px-6 text-center"><span className="mb-4 flex size-14 items-center justify-center rounded-full bg-accent"><Search size={24} /></span><h3 className="font-display text-2xl">Nothing in this corner yet.</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Try a different search or browse every piece in the collection.</p><button type="button" className="mt-5 rounded-full bg-foreground px-5 py-2.5 text-xs font-extrabold text-background" onClick={() => { setSearch(''); setCategory('all'); }}>Reset filters</button></div>}
    </main>
  );
}

function AppShell({
  view,
  setView,
  user,
  theme,
  setTheme,
  cartCount,
  setCartOpen,
  onLogout,
}: {
  view: View;
  setView: (view: View) => void;
  user: StoredUser | null;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  cartCount: number;
  setCartOpen: (open: boolean) => void;
  onLogout: () => void;
}) {
  const [mobileNav, setMobileNav] = useState(false);
  return (
    <header className="topbar sticky top-0 z-30">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 sm:px-8 lg:px-12">
        <button type="button" className="flex items-center gap-3 text-left" onClick={() => setView('catalog')}><span className="brand-mark flex size-10 items-center justify-center rounded-xl" aria-hidden="true"><Sparkles size={19} /></span><span><span className="block font-display text-2xl leading-none">Aster & Row</span><span className="mt-1 hidden text-[9px] font-extrabold uppercase tracking-[.18em] text-muted-foreground sm:block">A considered collection</span></span></button>
        <nav className={`${mobileNav ? 'flex' : 'hidden'} absolute left-4 right-4 top-[72px] flex-col gap-1 rounded-2xl border border-card-border bg-card p-3 shadow-xl sm:static sm:flex sm:flex-row sm:items-center sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none`} aria-label="Primary navigation">
          <button type="button" className={`nav-link ${view === 'catalog' ? 'active' : ''}`} onClick={() => { setView('catalog'); setMobileNav(false); }}>Catalog</button>
          {user && <><button type="button" className={`nav-link ${view === 'dashboard' ? 'active' : ''}`} onClick={() => { setView('dashboard'); setMobileNav(false); }}><LayoutDashboard size={15} /> Dashboard</button><button type="button" className={`nav-link ${view === 'manage' ? 'active' : ''}`} onClick={() => { setView('manage'); setMobileNav(false); }}><Settings2 size={15} /> Manage</button></>}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <button type="button" className="rounded-full p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>{theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}</button>
          <button type="button" className="relative rounded-full p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setCartOpen(true)} aria-label={`Open cart with ${cartCount} items`}><ShoppingBag size={20} /><span className="absolute right-0 top-0 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-extrabold text-primary-foreground">{cartCount}</span></button>
          {user ? <button type="button" className="hidden items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-extrabold text-foreground hover:bg-muted sm:inline-flex" onClick={onLogout}><UserRound size={15} /> {user.name.split(' ')[0]} <LogOut size={14} /></button> : <button type="button" className="hidden rounded-full border border-border px-4 py-2 text-xs font-extrabold hover:bg-muted sm:inline-flex" onClick={() => setView('login')}>Sign in</button>}
          <button type="button" className="rounded-full p-2.5 text-muted-foreground hover:bg-muted sm:hidden" onClick={() => setMobileNav((open) => !open)} aria-label="Toggle navigation">{mobileNav ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </div>
    </header>
  );
}

function Catalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [localProducts, setLocalProducts] = useState<ManagedProduct[]>(() => readManagedProducts());
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
  const [user, setUser] = useState<StoredUser | null>(() => getSessionUser());
  const [view, setView] = useState<View>(() => {
    const requestedView = new URLSearchParams(window.location.search).get('view');
    return requestedView === 'login' || requestedView === 'register' ? requestedView : 'catalog';
  });

  const loadProducts = async () => {
    setProductsLoading(true);
    setError('');
    try {
      const result = await getProducts();
      setProducts(result.data);
      setProductsFromCache(result.fromCache);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'We could not load the collection.');
    } finally {
      setProductsLoading(false);
    }
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
    } finally {
      setCategoriesLoading(false);
    }
  };

  useEffect(() => {
    ensureDemoAccount();
    void loadProducts();
    void loadCategories();
  }, []);
  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark'); writeStored(storageKeys.theme, theme); }, [theme]);
  useEffect(() => { writeStored(storageKeys.category, category); }, [category]);
  useEffect(() => { writeStored(storageKeys.sort, sort); }, [sort]);
  useEffect(() => { writeStored(storageKeys.cart, cart); }, [cart]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 2800); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => { if ((view === 'dashboard' || view === 'manage') && !user) setView('login'); }, [view, user]);

  const allProducts = useMemo(() => [...products, ...localProducts], [products, localProducts]);
  const allCategories = useMemo(() => Array.from(new Set([...categories, ...localProducts.map((product) => product.category)])), [categories, localProducts]);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const addToCart = (product: Product) => {
    setCart((current) => {
      const found = current.find((item) => item.product.id === product.id);
      return found ? current.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { product, quantity: 1 }];
    });
    setToast(`${product.title} added to your cart`);
  };
  const changeQuantity = (id: number, amount: number) => setCart((current) => amount < 1 ? current.filter((item) => item.product.id !== id) : current.map((item) => item.product.id === id ? { ...item, quantity: amount } : item));
  const handleSaveProduct = (form: ProductForm, existing?: ManagedProduct) => {
    if (!user) return;
    const now = new Date().toISOString();
    const product: ManagedProduct = {
      id: existing?.id ?? -Date.now(),
      title: form.title.trim(),
      price: Number(form.price),
      description: form.description.trim(),
      category: form.category.trim() || 'home & living',
      image: form.image.trim(),
      rating: existing?.rating ?? { rate: 0, count: 0 },
      source: 'local',
      ownerEmail: user.email,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const next = existing ? localProducts.map((item) => item.id === existing.id ? product : item) : [...localProducts, product];
    setLocalProducts(next);
    saveManagedProducts(next);
    setToast(existing ? 'Product changes saved' : 'Product added to your catalog');
  };
  const handleDeleteProduct = (product: ManagedProduct) => {
    const next = localProducts.filter((item) => item.id !== product.id);
    setLocalProducts(next);
    saveManagedProducts(next);
    setCart((current) => current.filter((item) => item.product.id !== product.id));
    setToast(`${product.title} removed`);
  };
  const handleLogout = () => { logoutUser(); setUser(null); setView('catalog'); setToast('You have been signed out'); };
  const handleAuthSuccess = (nextUser: StoredUser) => { setUser(nextUser); setView('dashboard'); setToast(`Welcome, ${nextUser.name.split(' ')[0]}`); };

  return (
    <div className="catalog-shell">
      <AppShell view={view} setView={setView} user={user} theme={theme} setTheme={setTheme} cartCount={cartCount} setCartOpen={setCartOpen} onLogout={handleLogout} />
      {view === 'login' || view === 'register' ? <AuthScreen mode={view} onModeChange={setView} onSuccess={handleAuthSuccess} /> : view === 'dashboard' && user ? <DashboardView user={user} products={allProducts} localProducts={localProducts} categories={allCategories} onViewCatalog={() => setView('catalog')} onManage={() => setView('manage')} /> : view === 'manage' && user ? <ManageView user={user} products={localProducts} onSave={handleSaveProduct} onDelete={handleDeleteProduct} /> : <CatalogView products={allProducts} categories={allCategories} categoriesLoading={categoriesLoading} categoryError={categoryError} productsLoading={productsLoading} productsFromCache={productsFromCache} categoriesFromCache={categoriesFromCache} error={error} search={search} setSearch={setSearch} category={category} setCategory={setCategory} sort={sort} setSort={setSort} onRetryProducts={() => void loadProducts()} onRetryCategories={() => void loadCategories()} onAdd={addToCart} onDetails={setDetails} />}
      {view === 'catalog' && <footer className="border-t border-border/80 px-4 py-8 text-center text-xs text-muted-foreground sm:px-8"><p className="font-display text-lg text-foreground">Aster & Row</p><p className="mt-2">A small, thoughtful place to browse.</p><p className="mt-3">Demo account data and locally managed products stay in this browser.</p></footer>}
      {cartOpen && <CartDrawer items={cart} onClose={() => setCartOpen(false)} onChange={changeQuantity} onRemove={(id) => changeQuantity(id, 0)} onClear={() => setCart([])} />}
      {details && <DetailsDialog product={details} onClose={() => setDetails(null)} onAdd={addToCart} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-4 py-3 text-xs font-bold text-background shadow-xl" role="status"><Check size={15} className="text-primary" />{toast}</div>}
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