# Changelog

All notable changes to MMM-FuelNorway will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.0]: https://github.com/YOUR_USERNAME/MMM-FuelNorway/releases/tag/v1.0.0
