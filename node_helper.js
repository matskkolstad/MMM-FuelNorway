'use strict'

const NodeHelper = require('node_helper')
const https = require('https')

const BASE_URL = 'https://api.drivstoffappen.no/api'

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

module.exports = NodeHelper.create({
  start() {
    console.log(`[MMM-FuelNorway] Node helper started`)
    this.cache = null
    this.cacheTime = null
    this.config = null
  },

  socketNotificationReceived(notification, payload) {
    if (notification === 'FUELNORWAY_FETCH_DATA') {
      this.fetchData(payload)
    }
  },

  isCacheValid() {
    if (!this.cache || !this.cacheTime || !this.config) return false
    const age = Date.now() - this.cacheTime
    return age < (this.config.updateInterval ?? 15 * 60 * 1000)
  },

  fetchData(config) {
    const updateInterval = toNumber(config.updateInterval)
    const retryAttempts = toNumber(config.retryAttempts)
    const retryDelay = toNumber(config.retryDelay)
    const apiKey = typeof config.apiKey === 'string' && config.apiKey.trim().length > 0 ? config.apiKey.trim() : null
    const normalizedConfig = {
      ...config,
      latitude: toNumber(config.latitude),
      longitude: toNumber(config.longitude),
      radius: toNumber(config.radius) ?? 5,
      updateInterval: updateInterval ?? 15 * 60 * 1000,
      retryAttempts: retryAttempts ?? 3,
      retryDelay: retryDelay ?? 5000,
      apiKey,
      countryCode: (config.countryCode || 'NO').toUpperCase()
    }
    this.config = normalizedConfig

    if (this.isCacheValid()) {
      if (this.config.debug) {
        console.log('[MMM-FuelNorway] Serving from cache')
      }
      this.sendSocketNotification('FUELNORWAY_DATA_RECEIVED', this.cache)
      return
    }

    if (!apiKey) {
      this.sendSocketNotification('FUELNORWAY_ERROR', { message: 'Configuration error: apiKey is required for Drivstoffappen API' })
      return
    }

    if (config.method === 'nearby' && (normalizedConfig.latitude === null || normalizedConfig.longitude === null)) {
      this.sendSocketNotification('FUELNORWAY_ERROR', { message: 'Configuration error: latitude and longitude required for nearby method' })
      return
    }

    if (config.method === 'manual' && (!Array.isArray(config.stationIds) || config.stationIds.length === 0)) {
      this.sendSocketNotification('FUELNORWAY_ERROR', { message: 'Configuration error: stationIds array required for manual method' })
      return
    }

    if (config.method !== 'nearby' && config.method !== 'manual') {
      this.sendSocketNotification('FUELNORWAY_ERROR', { message: `Unknown method: ${config.method}` })
      return
    }

    this.fetchStations(normalizedConfig)
  },

  resolveStationName(raw) {
    const address = this.buildAddress(raw)
    const locationAddress = raw && raw.location && typeof raw.location.address === 'string'
      ? raw.location.address
      : (typeof raw.location === 'string' ? raw.location : '')
    const candidates = [
      raw && raw.name,
      raw && raw.station_name,
      raw && raw.stationName,
      raw && raw.discountInfo,
      raw && raw.station && raw.station.name,
      address.street,
      raw && raw.location && raw.location.name,
      locationAddress,
      raw && raw.id
    ]
    const match = candidates.find((value) => typeof value === 'string' && value.trim().length > 0)
    return match ? match.trim() : 'Unknown station'
  },

  buildAddress(raw) {
    const location = (raw && raw.location) || {}
    const locationString = typeof raw.location === 'string' ? raw.location : ''
    const addressLine = typeof location.address === 'string' ? location.address : locationString
    const [addressStreet, ...addressRest] = addressLine
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)

    const street = raw.street || addressStreet || ''
    const city = raw.city || (addressRest.length > 0 ? addressRest.join(', ') : '')
    const zip = raw.zip || ''

    return { street, city, zip }
  },

  extractPrices(raw) {
    const result = {
      gasoline_price: null,
      gasoline_95_price: null,
      gasoline_98_price: null,
      diesel_price: null,
      hvo100_price: null,
      fd_price: null,
      last_updated: null
    }

    const updateLastUpdated = (value) => {
      if (value === null || value === undefined) return
      const numeric = toNumber(value)
      const date = Number.isFinite(numeric) ? new Date(numeric) : new Date(value)
      if (!Number.isNaN(date.getTime())) {
        const iso = date.toISOString()
        if (!result.last_updated || new Date(iso).getTime() > new Date(result.last_updated).getTime()) {
          result.last_updated = iso
        }
      }
    }

    if (raw && raw.prices && typeof raw.prices === 'object') {
      Object.assign(result, {
        gasoline_price: raw.prices.gasoline_price !== undefined ? toNumber(raw.prices.gasoline_price) : null,
        gasoline_95_price: raw.prices.gasoline_95_price !== undefined ? toNumber(raw.prices.gasoline_95_price) : null,
        gasoline_98_price: raw.prices.gasoline_98_price !== undefined ? toNumber(raw.prices.gasoline_98_price) : null,
        diesel_price: raw.prices.diesel_price !== undefined ? toNumber(raw.prices.diesel_price) : null,
        hvo100_price: raw.prices.hvo100_price !== undefined ? toNumber(raw.prices.hvo100_price) : null,
        fd_price: raw.prices.fd_price !== undefined ? toNumber(raw.prices.fd_price) : null,
        last_updated: raw.prices.last_updated || null
      })
      updateLastUpdated(result.last_updated)
    }

    if (Array.isArray(raw && raw.stationDetails)) {
      raw.stationDetails.forEach((detail) => {
        const type = typeof detail.type === 'string' ? detail.type.toUpperCase() : String(detail.type || '').toUpperCase()
        const price = toNumber(detail.price)
        if (price === null) return
        switch (type) {
          case '95':
            result.gasoline_95_price = price
            break
          case '98':
            result.gasoline_98_price = price
            break
          case '100':
          case 'HVO':
          case 'HVO100':
            result.hvo100_price = price
            break
          case 'FD':
          case 'E':
          case 'ELECTRIC':
            result.fd_price = price
            break
          case 'D':
          case 'DIESEL':
          case 'EN590':
            result.diesel_price = price
            break
          default:
            // Unknown type, ignore
            break
        }
        updateLastUpdated(detail.lastUpdated || detail.last_updated)
      })
    }

    if (result.gasoline_price === null) {
      result.gasoline_price = result.gasoline_95_price ?? result.gasoline_98_price
    }

    return result
  },

  // Normalise a raw API station object into the flat format the front-end expects.
  // The real API nests prices under station.prices and the address as separate flat
  // fields (street / city / zip), so we flatten everything here.
  normalizeStation(raw, userLat, userLng) {
    const prices = this.extractPrices(raw)
    const location = (raw && raw.location) || {}
    const stationLat = toNumber(location.latitude ?? raw.latitude)
    const stationLng = toNumber(location.longitude ?? raw.longitude)
    const userLatNum = toNumber(userLat)
    const userLngNum = toNumber(userLng)
    const resolvedName = this.resolveStationName(raw)
    const address = this.buildAddress(raw)

    let distance = null
    if (userLatNum !== null && userLngNum !== null && stationLat !== null && stationLng !== null) {
      distance = Math.round(this.haversineDistance(userLatNum, userLngNum, stationLat, stationLng) * 10) / 10
    }

    return {
      id: raw.id,
      name: resolvedName,
      address,
      latitude: stationLat,
      longitude: stationLng,
      distance,
      gasoline_price: prices.gasoline_price,
      gasoline_95_price: prices.gasoline_95_price,
      gasoline_98_price: prices.gasoline_98_price,
      diesel_price: prices.diesel_price,
      hvo100_price: prices.hvo100_price,
      fd_price: prices.fd_price,
      last_updated: prices.last_updated,
      logo: raw.logo || raw.pictureUrl || null
    }
  },

  // Haversine formula – returns distance in kilometres between two lat/lng points.
  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371
    const toRad = (deg) => (deg * Math.PI) / 180
    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  },

  fetchStations(config, attempt = 1) {
    const endpoint = `${BASE_URL}/stations?stationType=0&countryCode=${encodeURIComponent(config.countryCode)}`

    if (config.debug) {
      console.log(`[MMM-FuelNorway] Fetching stations: ${endpoint} (attempt ${attempt})`)
    }

    this.httpsGet(endpoint, config, (err, data) => {
      if (err) {
        const retryAttempts = config.retryAttempts ?? 3
        if (attempt < retryAttempts) {
          console.log(`[MMM-FuelNorway] Retry ${attempt}/${retryAttempts} after error: ${err.message}`)
          setTimeout(() => this.fetchStations(config, attempt + 1), config.retryDelay ?? 5000)
        } else {
          this.sendSocketNotification('FUELNORWAY_ERROR', { message: err.message })
        }
        return
      }

      let stations
      try {
        stations = JSON.parse(data)
      } catch (_e) {
        this.sendSocketNotification('FUELNORWAY_ERROR', { message: 'Failed to parse API response' })
        return
      }

      if (!Array.isArray(stations)) {
        stations = stations ? [stations] : []
      }

      const normalized = stations
        .map((s) => this.normalizeStation(s, config.latitude, config.longitude))
        .filter(Boolean)

      let result
      if (config.method === 'nearby') {
        result = normalized
          .filter((s) => s.distance !== null && s.distance <= (config.radius ?? 5))
          .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
      } else {
        const idSet = new Set((config.stationIds || []).map((id) => String(id)))
        result = normalized.filter((s) => idSet.has(String(s.id)))
      }

      if (!result || result.length === 0) {
        this.sendSocketNotification('FUELNORWAY_ERROR', { message: 'No stations found for the provided criteria' })
        return
      }

      this.cache = result
      this.cacheTime = Date.now()
      this.sendSocketNotification('FUELNORWAY_DATA_RECEIVED', result)
    })
  },

  httpsGet(endpoint, config, callback) {
    const parsedUrl = new URL(endpoint)
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MMM-FuelNorway/1.1.1'
      }
    }

    if (config && config.apiKey) {
      options.headers['X-API-KEY'] = config.apiKey
    }

    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          callback(null, body)
        } else {
          callback(new Error(`HTTP ${res.statusCode}: ${body}`), null)
        }
      })
    })

    req.on('error', (err) => {
      callback(err, null)
    })

    req.setTimeout(10000, () => {
      req.destroy(new Error('Request timed out'))
    })

    req.end()
  }
})
