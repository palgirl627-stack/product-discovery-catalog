# Aster & Row — Product Discovery Catalog

Aster & Row is a responsive product discovery application powered by the public FakeStoreAPI. It demonstrates modern asynchronous JavaScript, modular React application logic, browser storage, resilient API handling, and a polished responsive shopping surface.

## Features

- Products and categories loaded asynchronously from FakeStoreAPI
- Runtime response validation and friendly HTTP/network error states
- In-flight request deduplication to avoid unnecessary duplicate API calls
- Timestamped `localStorage` caching with expiry and cached-data fallback
- Live case-insensitive title search with clear-search control
- Dynamic category tabs from the API
- Combined search, category filtering, and sorting
- Sorting by featured order, price, name, and rating
- Product details dialog with image fallback
- Persistent cart with quantity controls, removal, clear, item count, and total
- Persistent theme, category, sort, and cart preferences
- Light and dark themes
- Loading skeletons, empty states, retry action, cached-data notice, and add-to-cart feedback
- Responsive layouts for 320px, 768px, 1024px, and 1440px viewports
- Semantic landmarks, accessible labels, focus states, and touch-friendly controls

## Technologies

- React + TypeScript
- Vite
- CSS custom properties and Tailwind CSS utilities
- Fetch API with `async`/`await`
- Browser `localStorage`
- FakeStoreAPI

## API endpoints

- `GET https://fakestoreapi.com/products`
- `GET https://fakestoreapi.com/products/categories`

API and cache behavior lives in `src/api.ts`. The main product surface, filters, sorting, cart state, preferences, and feedback states live in `src/App.tsx`.

## Run locally

```bash
npm install
npm run dev
```

The managed artifact workflow supplies `PORT` and `BASE_PATH`. For a standalone Vite run, use the same environment variables or run `vite` on its default port.

## Testing checklist

- [x] TypeScript typecheck passes
- [x] Production Vite build passes
- [x] Product and category API functions use `fetch` and `async`/`await`
- [x] API responses are validated before rendering
- [x] Cache entries include a timestamp and reject malformed or expired data
- [x] Search, categories, and sorting compose without a page reload
- [x] Cart quantities, removal, totals, and `localStorage` persistence are wired
- [x] Theme, category, and sorting preferences persist
- [x] Loading, empty, retry, cached fallback, and image fallback states are implemented
- [x] Responsive behavior is defined for mobile, tablet, laptop, and desktop

## Known limitations

- FakeStoreAPI is a demo service, so product inventory and availability are not transactional.
- Checkout is represented as the next-step interaction only; no payment provider or order backend is connected.
- The app uses the browser's local storage, so cart and preferences are device-local.