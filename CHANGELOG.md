# Changelog

All notable changes to MMM-FuelNorway will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-04-16

### Changed

- Implemented the new Figma-based module styling in the production module UI.
- Reworked station cards to match the new redesign: cleaner frosted cards, simplified metadata row, and refined fuel price chips.
- Updated rendering so `displayMode: 'list'` now shows stacked station cards, while `displayMode: 'grid'` keeps tiled cards.
- Kept cheapest-price highlighting logic intact and mapped it to the new green visual treatment.
- Excluded `MMM-FuelNorway-Design/**` from root ESLint checks so CI linting targets module code only.
- Updated documentation (`README.md`, `docs/CONFIGURATION.md`) to reflect the redesigned layout behavior.

---

## [1.1.0] - 2026-04-09

### Fixed

- **Prices not displaying** — The Drivstoff API nests prices under a `prices` sub-object
  (`station.prices.gasoline_price`, etc.) and stores `last_updated` there too. The module
  previously tried to read prices from the top level, so all prices showed as `–`. A
  `normalizeStation()` function in `node_helper.js` now flattens the response into the
  flat format the front-end expects.
- **Address format** — The API returns address parts as separate top-level fields
  (`street`, `city`, `zip`) rather than a nested `address` object. Normalization now
  maps these into the expected `{ street, city, zip }` shape.
- **Logos too large** — Changed logo `<img>` from `max-width`/`max-height` (which left
  the intrinsic size unset for SVG and variable-size images) to explicit `width`/`height`
  matching the container. Logos are now always constrained to exactly 32 × 32 px (medium),
  20 × 20 px (small), or 44 × 44 px (large).
- **moduleSize had no visible effect** — The three size variants are now more distinct:
  `small` → 0.65 em, `medium` → 0.85 em, `large` → 1.1 em (previously 0.75 / 0.9 / 1.05 em).
- **Horizontal orientation styling** — Station cards in `list + horizontal` mode now use
  a card border (matching grid style) instead of a bottom border, so the layout looks
  correct when items sit side-by-side.

### Added

- **`normalizeStation()` in `node_helper.js`** — Transforms the raw API response into the
  flat format expected by the front-end. Handles missing/null price fields and address
  parts gracefully.
- **Haversine distance calculation** — For the `nearby` method, the module now computes
  each station's distance from the user's coordinates and exposes it as `station.distance`
  (rounded to 0.1 km). The API does not return a distance field.
- **`gasoline_95_price` and `gasoline_98_price` fuel types** — The API returns 95-octane
  and 98-octane petrol as separate fields. Both are now supported in `fuelTypes` config
  and labelled "Petrol 95" / "Petrol 98" (English) and "Bensin 95" / "Bensin 98"
  (Norwegian).
- **New translation keys** — `FUEL_GASOLINE_95` and `FUEL_GASOLINE_98` added to both
  `en.json` and `no.json`.
- **Haversine and station-normalisation tests** — `test/node_helper.test.js` expanded
  with 15 new tests covering distance calculation and all normalization edge cases.
- **Updated test fixtures** — `test/fixtures/nearby-response.json` and
  `test/fixtures/station-response.json` updated to match the real API response format.
- **Visual screenshots** — `docs/screenshots/` directory with 15 screenshots showing
  every supported configuration variant.

### Changed

- `test/node_helper.test.js` now loads test fixtures from disk rather than using
  inline data, ensuring tests stay in sync with the real API format.
- `docs/CONFIGURATION.md` updated with `gasoline_95_price` and `gasoline_98_price` fuel
  type keys and notes about the API response structure.
- `README.md` updated with the real API endpoint format, available fuel type keys, and
  new troubleshooting notes.

---

## [1.0.0] - 2024-03-15

### Added

#### Core module
- `MMM-FuelNorway.js` – MagicMirror² front-end module using `Module.register`
- `node_helper.js` – Back-end Node.js helper using built-in `https` module

#### Data fetching
- **Nearby mode** – fetch stations by latitude/longitude and configurable radius via `GET /stations/fuel/nearby`
- **Manual mode** – fetch one or more specific stations by ID via `GET /stations/fuel/{id}`
- Smart **caching** – avoids redundant API calls within the configured `updateInterval`
- **Retry logic** – configurable `retryAttempts` and `retryDelay` on API failure
- Optional **debug logging** controlled by `config.debug`

#### Display
- **List layout** (default) and **grid layout** (`displayMode`)
- **Vertical** (default) and **horizontal** orientation (`orientation`)
- Three size variants: `small`, `medium` (default), `large` (`moduleSize`)
- Configurable maximum number of stations (`maxStations`)

#### Station details
- Station name, address (street / city / full), distance from search point
- Brand logo display (`showBrandLogo`)
- Last-updated timestamp in relative (e.g. "5 min") or absolute (HH:MM) format

#### Pricing
- Support for `gasoline_price`, `diesel_price`, `hvo100_price`, `fd_price`
- Cheapest-price highlighting with configurable colour (`highlightCheapest`, `priceHighlightColor`)
- Configurable decimal places and currency label
- Compact price format (no currency label)

#### Internationalisation
- English (`en`) translation
- Norwegian (`no` / `nb` / `nn`) translation

#### CSS
- `css/MMM-FuelNorway.css` – full stylesheet for all layout modes, size variants, and states (loading, error, empty)

#### Tests
- `test/MMM-FuelNorway.test.js` – front-end utility tests via Node.js built-in test runner
- `test/node_helper.test.js` – back-end utility tests via Node.js built-in test runner
- `test/fixtures/nearby-response.json` – sample nearby API response
- `test/fixtures/station-response.json` – sample single-station API response

#### Tooling & documentation
- `eslint.config.mjs` – ESLint flat config (ESLint 9+)
- `docs/CONFIGURATION.md` – full configuration reference
- `README.md` – comprehensive documentation
- `CHANGELOG.md` – this file
- `LICENSE` – MIT

[1.2.0]: https://github.com/matskkolstad/MMM-FuelNorway/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/matskkolstad/MMM-FuelNorway/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/matskkolstad/MMM-FuelNorway/releases/tag/v1.0.0
