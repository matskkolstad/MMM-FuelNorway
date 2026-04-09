'use strict'

Module.register('MMM-FuelNorway', {
  defaults: {
    method: 'nearby',
    latitude: null,
    longitude: null,
    radius: 5,
    stationIds: [],
    updateInterval: 15 * 60 * 1000,
    retryDelay: 5000,
    retryAttempts: 3,
    displayMode: 'list',
    orientation: 'vertical',
    moduleSize: 'medium',
    fuelTypes: ['gasoline_price', 'diesel_price'],
    showStationName: true,
    showAddress: true,
    addressFormat: 'street',
    showLastUpdated: true,
    lastUpdatedFormat: 'relative',
    showBrandLogo: true,
    compactPriceFormat: false,
    highlightCheapest: true,
    priceHighlightColor: '#00ff00',
    currencyFormat: 'NOK',
    decimalPlaces: 2,
    maxStations: 5,
    debug: false
  },

  stationData: [],
  loading: true,
  error: null,
  updateTimer: null,

  getScripts() {
    return []
  },

  getStyles() {
    return [this.file('css/MMM-FuelNorway.css')]
  },

  getTranslations() {
    return {
      en: 'translations/en.json',
      no: 'translations/no.json',
      nb: 'translations/no.json',
      nn: 'translations/no.json'
    }
  },

  start() {
    Log.info(`[MMM-FuelNorway] Starting module`)
    this.stationData = []
    this.loading = true
    this.error = null
    this.sendSocketNotification('FUELNORWAY_FETCH_DATA', this.config)
    this.scheduleUpdate()
  },

  scheduleUpdate() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer)
    }
    const configuredInterval = Number(this.config.updateInterval)
    const interval = Number.isFinite(configuredInterval) && configuredInterval > 0
      ? configuredInterval
      : 15 * 60 * 1000
    this.updateTimer = setInterval(() => {
      this.loading = true
      this.updateDom()
      this.sendSocketNotification('FUELNORWAY_FETCH_DATA', this.config)
    }, interval)
  },

  socketNotificationReceived(notification, payload) {
    if (notification === 'FUELNORWAY_DATA_RECEIVED') {
      this.stationData = payload
      this.loading = false
      this.error = null
      this.updateDom()
    } else if (notification === 'FUELNORWAY_ERROR') {
      this.error = payload
      this.loading = false
      this.updateDom()
    }
  },

  getDom() {
    const wrapper = document.createElement('div')
    wrapper.className = 'MMM-FuelNorway'

    if (this.loading) {
      const loading = document.createElement('div')
      loading.className = 'mmm-fuelnorway-loading'
      loading.textContent = this.translate('LOADING')
      wrapper.appendChild(loading)
      return wrapper
    }

    if (this.error) {
      const errorEl = document.createElement('div')
      errorEl.className = 'mmm-fuelnorway-error'
      const message = this.error && typeof this.error.message === 'string' && this.error.message.length > 0
        ? `: ${this.error.message}`
        : ''
      errorEl.textContent = `${this.translate('ERROR')}${message}`
      wrapper.appendChild(errorEl)
      return wrapper
    }

    if (!this.stationData || this.stationData.length === 0) {
      const noData = document.createElement('div')
      noData.className = 'mmm-fuelnorway-empty'
      noData.textContent = this.translate('NO_STATIONS')
      wrapper.appendChild(noData)
      return wrapper
    }

    const container = document.createElement('div')
    const isGridMode = this.config.displayMode === 'grid'
    const displayMode = isGridMode ? 'mmm-fuelnorway-grid' : 'mmm-fuelnorway-list'
    const orientation = this.config.orientation === 'horizontal' ? 'mmm-fuelnorway-horizontal' : 'mmm-fuelnorway-vertical'
    const size = `mmm-fuelnorway-${this.config.moduleSize}`
    const baseClasses = [displayMode, orientation, size]
    if (!isGridMode) {
      baseClasses.push('mmm-fuelnorway-list-wrapper')
    }
    container.className = baseClasses.filter(Boolean).join(' ')
    container.style.setProperty('--mmm-fuelnorway-accent', this.config.priceHighlightColor || '#00ff00')

    const cheapestByFuelType = this.findCheapest(this.stationData, this.config.fuelTypes)
    const stations = this.stationData.slice(0, this.config.maxStations)

    if (isGridMode) {
      stations.forEach((station) => {
        const stationEl = this.buildStationElement(station, cheapestByFuelType, 'grid')
        container.appendChild(stationEl)
      })
    } else {
      const listCard = document.createElement('div')
      listCard.className = 'mmm-fuelnorway-list-card'
      const listBody = document.createElement('div')
      listBody.className = 'mmm-fuelnorway-list-body'

      stations.forEach((station) => {
        const stationEl = this.buildStationElement(station, cheapestByFuelType, 'list')
        listBody.appendChild(stationEl)
      })

      listCard.appendChild(listBody)
      container.appendChild(listCard)
    }

    wrapper.appendChild(container)
    return wrapper
  },

  findCheapest(stations, fuelTypes) {
    const cheapest = {}
    fuelTypes.forEach((fuelType) => {
      let minPrice = null
      stations.forEach((station) => {
        const price = station[fuelType]
        if (price !== null && price !== undefined) {
          if (minPrice === null || price < minPrice) {
            minPrice = price
          }
        }
      })
      cheapest[fuelType] = minPrice
    })
    return cheapest
  },

  buildStationElement(station, cheapestByFuelType, variant = 'grid') {
    const el = document.createElement('div')
    el.className = ['mmm-fuelnorway-station', variant === 'list' ? 'mmm-fuelnorway-list-item' : ''].filter(Boolean).join(' ')

    const header = document.createElement('div')
    header.className = 'mmm-fuelnorway-header'

    const heading = document.createElement('div')
    heading.className = 'mmm-fuelnorway-heading'

    if (this.config.showBrandLogo && station.logo) {
      const logoContainer = document.createElement('div')
      logoContainer.className = 'mmm-fuelnorway-logo'
      const logo = document.createElement('img')
      logo.src = station.logo
      logo.alt = this.getStationName(station)
      logoContainer.appendChild(logo)
      heading.appendChild(logoContainer)
    }

    if (this.config.showStationName) {
      const name = document.createElement('div')
      name.className = 'mmm-fuelnorway-name'
      name.textContent = this.getStationName(station)
      heading.appendChild(name)
    }

    if (heading.childElementCount > 0) {
      header.appendChild(heading)
    }

    if (station.distance !== null && station.distance !== undefined) {
      const dist = document.createElement('div')
      dist.className = 'mmm-fuelnorway-distance'
      dist.textContent = `${Number(station.distance).toFixed(1)} ${this.translate('KM_AWAY')}`
      header.appendChild(dist)
    }

    el.appendChild(header)

    const info = document.createElement('div')
    info.className = 'mmm-fuelnorway-info'

    if (this.config.showAddress && station.address) {
      const address = document.createElement('div')
      address.className = 'mmm-fuelnorway-address'
      address.textContent = this.formatAddress(station.address, this.config.addressFormat)
      info.appendChild(address)
    }

    const prices = document.createElement('div')
    prices.className = 'mmm-fuelnorway-prices' + (variant === 'list' ? ' mmm-fuelnorway-inline-prices' : '')

    this.config.fuelTypes.forEach((fuelType) => {
      const price = station[fuelType]
      const priceEl = document.createElement('div')
      const isCheapest = this.config.highlightCheapest && cheapestByFuelType[fuelType] !== null && price === cheapestByFuelType[fuelType]
      priceEl.className = 'mmm-fuelnorway-price' + (isCheapest ? ' mmm-fuelnorway-cheapest' : '')

      const label = document.createElement('div')
      label.className = 'mmm-fuelnorway-fuel-label'
      label.textContent = this.getFuelLabel(fuelType)

      const value = document.createElement('div')
      value.className = 'mmm-fuelnorway-fuel-value'
      const formattedPrice = this.formatPrice(price)
      const hasPrice = formattedPrice !== '-'
      value.textContent = formattedPrice
      if (!hasPrice) {
        priceEl.classList.add('mmm-fuelnorway-unavailable')
      }

      priceEl.appendChild(label)
      priceEl.appendChild(value)
      prices.appendChild(priceEl)
    })

    if (this.config.showLastUpdated && station.last_updated) {
      const formattedTimestamp = this.formatTimestamp(station.last_updated, this.config.lastUpdatedFormat)
      const updated = document.createElement('div')
      updated.className = 'mmm-fuelnorway-updated'
      updated.textContent = `${this.translate('LAST_UPDATED')}: ${formattedTimestamp || '-'}`
      info.appendChild(updated)
    }

    if (info.childElementCount > 0) {
      el.appendChild(info)
    }

    el.appendChild(prices)

    return el
  },

  getStationName(station) {
    const candidates = [
      station && station.name,
      station && station.station_name,
      station && station.stationName,
      station && station.address && station.address.street,
      station && station.id
    ]
    const resolved = candidates.find((value) => typeof value === 'string' && value.trim().length > 0)
    return resolved ? resolved.trim() : this.translate('UNKNOWN_STATION')
  },

  formatAddress(address, format) {
    if (!address) return ''
    if (format === 'full') {
      return [address.street, address.zip, address.city].filter(Boolean).join(', ')
    }
    if (format === 'city') {
      return address.city || ''
    }
    return address.street || ''
  },

  formatPrice(price) {
    if (price === null || price === undefined || price === '') return '-'
    const numeric = Number(price)
    if (!Number.isFinite(numeric)) return '-'
    const formatted = numeric.toFixed(this.config.decimalPlaces)
    if (this.config.compactPriceFormat) {
      return formatted
    }
    return `${formatted} ${this.config.currencyFormat}`
  },

  formatTimestamp(timestamp, format) {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) return ''
    if (format === 'relative') {
      const diffMs = Date.now() - date.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      if (diffMins < 1) return '< 1 min'
      if (diffMins < 60) return `${diffMins} min`
      const diffHours = Math.floor(diffMins / 60)
      if (diffHours < 24) return `${diffHours}h`
      return `${Math.floor(diffHours / 24)}d`
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  },

  getFuelLabel(fuelType) {
    const map = {
      gasoline_price: this.translate('FUEL_GASOLINE'),
      gasoline_95_price: this.translate('FUEL_GASOLINE_95'),
      gasoline_98_price: this.translate('FUEL_GASOLINE_98'),
      diesel_price: this.translate('FUEL_DIESEL'),
      hvo100_price: this.translate('FUEL_HVO100'),
      fd_price: this.translate('FUEL_FD')
    }
    return map[fuelType] || fuelType
  }
})
