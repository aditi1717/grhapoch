import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Search, ChevronRight, MapPin, X, Bell, Utensils } from "lucide-react"
import { restaurantAPI } from "@food/api"
import { getCachedSettings, getModuleLogoUrl, loadBusinessSettings } from "@food/utils/businessSettings"
import useNotificationInbox from "@food/hooks/useNotificationInbox"
import { useRestaurantNotifications } from "@food/hooks/useRestaurantNotifications"

const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const extractRestaurantPayload = (response) =>
  response?.data?.data?.restaurant ||
  response?.data?.restaurant ||
  response?.data?.data?.user ||
  response?.data?.user ||
  response?.data?.data ||
  null


export default function RestaurantNavbar({
  restaurantName: propRestaurantName,
  location: propLocation,
  showSearch = true,
  showOfflineOnlineTag = true,
  showNotifications = true,
}) {
  const navigate = useNavigate()
  const [isSearchActive, setIsSearchActive] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  const [status, setStatus] = useState("Offline")
  const [restaurantData, setRestaurantData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [companyName, setCompanyName] = useState("")
  const [logoUrl, setLogoUrl] = useState(null)
  const { unreadCount } = useNotificationInbox("restaurant", { limit: 20, pollMs: 5 * 60 * 1000 })
  const { newReservation, clearNewReservation } = useRestaurantNotifications()

  // Load business settings for branding
  useEffect(() => {
    const loadSettings = async () => {
      const cached = getCachedSettings()
      if (cached) {
        if (cached.companyName) setCompanyName(cached.companyName)
        const resolvedLogo = getModuleLogoUrl("restaurant")
        if (resolvedLogo) setLogoUrl(resolvedLogo)
      } else {
        const settings = await loadBusinessSettings()
        if (settings) {
          if (settings.companyName) setCompanyName(settings.companyName)
          const resolvedLogo = getModuleLogoUrl("restaurant")
          if (resolvedLogo) setLogoUrl(resolvedLogo)
        }
      }
    }
    loadSettings()

    const handleSettingsUpdate = () => {
      const cached = getCachedSettings()
      if (cached) {
        if (cached.companyName) setCompanyName(cached.companyName)
        const resolvedLogo = getModuleLogoUrl("restaurant")
        if (resolvedLogo) setLogoUrl(resolvedLogo)
      }
    }
    window.addEventListener('businessSettingsUpdated', handleSettingsUpdate)
    return () => window.removeEventListener('businessSettingsUpdated', handleSettingsUpdate)
  }, [])

  // Fetch restaurant data on mount
  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        setLoading(true)
        const response = await restaurantAPI.getCurrentRestaurant()
        const data = extractRestaurantPayload(response)
        if (data) {
          setRestaurantData(data)
        }
      } catch (error) {
        if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNABORTED' && !error.message?.includes('timeout')) {
          debugError("Error fetching restaurant data:", error)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchRestaurantData()
  }, [])

  // Format full address from location object
  const formatAddress = (location) => {
    if (!location) return ""
    
    if (location.formattedAddress && location.formattedAddress.trim() !== "" && location.formattedAddress !== "Select location") {
      const isCoordinates = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(location.formattedAddress.trim())
      if (!isCoordinates) {
        return location.formattedAddress.trim()
      }
    }
    
    if (location.address && location.address.trim() !== "") {
      return location.address.trim()
    }
    
    const parts = []
    
    if (location.addressLine1) {
      parts.push(location.addressLine1.trim())
    } else if (location.street) {
      parts.push(location.street.trim())
    }
    
    if (location.addressLine2) {
      parts.push(location.addressLine2.trim())
    }
    
    if (location.area) {
      parts.push(location.area.trim())
    }
    
    if (location.landmark) {
      parts.push(location.landmark.trim())
    }
    
    if (location.city) {
      const city = location.city.trim()
      const cityAlreadyIncluded = parts.some(part => part.toLowerCase().includes(city.toLowerCase()))
      if (!cityAlreadyIncluded) {
        parts.push(city)
      }
    }
    
    if (location.state) {
      const state = location.state.trim()
      const stateAlreadyIncluded = parts.some(part => part.toLowerCase().includes(state.toLowerCase()))
      if (!stateAlreadyIncluded) {
        parts.push(state)
      }
    }
    
    if (location.zipCode || location.pincode || location.postalCode) {
      const zip = (location.zipCode || location.pincode || location.postalCode).trim()
      parts.push(zip)
    }
    
    return parts.length > 0 ? parts.join(", ") : ""
  }

  const restaurantName = propRestaurantName || restaurantData?.name || "Restaurant"
  const [location, setLocation] = useState("")

  useEffect(() => {
    let newLocation = ""
    
    if (propLocation && propLocation.trim() !== "") {
      newLocation = propLocation.trim()
    }
    else if (restaurantData) {
      if (restaurantData.location) {
        if (restaurantData.location.formattedAddress && 
            restaurantData.location.formattedAddress.trim() !== "" && 
            restaurantData.location.formattedAddress !== "Select location") {
          const isCoordinates = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(restaurantData.location.formattedAddress.trim())
          if (!isCoordinates) {
            newLocation = restaurantData.location.formattedAddress.trim()
          }
        }
        
        if (!newLocation) {
          const formatted = formatAddress(restaurantData.location)
          if (formatted && formatted.trim() !== "") {
            newLocation = formatted.trim()
          }
        }
        
        if (!newLocation && restaurantData.location.address && restaurantData.location.address.trim() !== "") {
          newLocation = restaurantData.location.address.trim()
        }
      }
      
      if (!newLocation && restaurantData.address && restaurantData.address.trim() !== "") {
        newLocation = restaurantData.address.trim()
      }
    }
    
    setLocation(newLocation)
  }, [restaurantData, propLocation])

  // Load status from localStorage on mount and listen for changes
  useEffect(() => {
    const updateStatus = () => {
      try {
        const savedStatus = localStorage.getItem('restaurant_online_status')
        if (savedStatus !== null) {
          const isOnline = JSON.parse(savedStatus)
          setStatus(isOnline ? "Online" : "Offline")
          return
        }
      } catch (error) {
        debugError("Error loading restaurant status:", error)
      }

      const operational = restaurantData?.operationalStatus
      if (operational) {
        setStatus(operational.isEffectivelyOnline ? "Online" : "Offline")
        return
      }

      const isOnline = Boolean(restaurantData?.isAcceptingOrders)
      setStatus(isOnline ? "Online" : "Offline")
    }

    updateStatus()

    const handleStatusChange = (event) => {
      const isOnline =
        event.detail?.isEffectivelyOnline ??
        event.detail?.isOnline ??
        false
      setStatus(isOnline ? "Online" : "Offline")
    }

    window.addEventListener('restaurantStatusChanged', handleStatusChange)
    
    return () => {
      window.removeEventListener('restaurantStatusChanged', handleStatusChange)
    }
  }, [restaurantData])

  const handleStatusClick = () => {
    navigate("/restaurant/status")
  }

  const handleSearchClick = () => {
    setIsSearchActive(true)
  }

  const handleSearchClose = () => {
    setIsSearchActive(false)
    setSearchValue("")
  }

  const handleSearchChange = (e) => {
    setSearchValue(e.target.value)
  }

  const handleNotificationsClick = () => {
    navigate("/restaurant/notifications")
  }

  if (isSearchActive) {
    return (
      <div className="w-full bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchValue}
            onChange={handleSearchChange}
            placeholder="Search by order ID"
            className="w-full px-4 py-2 text-gray-900 placeholder-gray-500 focus:outline-none"
            autoFocus
          />
        </div>

        <button
          onClick={handleSearchClose}
          className="w-6 h-6 bg-black rounded-full flex items-center justify-center shrink-0"
          aria-label="Close search"
        >
          <X className="w-3 h-3 text-white" />
        </button>
      </div>
    )
  }

  return (
    <div className="w-full bg-white/95 backdrop-blur-md border-b border-gray-100 px-4 py-3.5 flex items-center justify-between sticky top-0 z-[60]">
      {/* Left Side - Restaurant Info */}
      <div className="flex-1 min-w-0 pr-2 flex items-center gap-2.5">
        {logoUrl && (
          <img 
            src={logoUrl} 
            alt="Logo" 
            onClick={() => window.location.reload()}
            className="h-9 w-9 object-contain rounded-lg shadow-sm cursor-pointer active:scale-95 transition-transform" 
          />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <h1 className="text-[14px] font-bold text-gray-900 truncate leading-none">
              {loading ? "Loading..." : (restaurantName || "Restaurant")}
            </h1>
          </div>
          {!loading && location && location.trim() !== "" && (
            <div className="flex items-center gap-1 mt-1 opacity-70">
              <MapPin className="w-2 h-2 text-gray-400 shrink-0" />
              <p className="text-[9px] text-gray-500 truncate font-medium max-w-[150px]" title={location}>
                {location}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Interactive Elements */}
      <div className="flex items-center gap-0.5">
        {showOfflineOnlineTag && (
          <button
            onClick={handleStatusClick}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-xl hover:opacity-80 transition-all ${
              status === "Online" 
                ? "bg-green-50 border-green-100" 
                : "bg-gray-50 border-gray-200"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${
              status === "Online" ? "bg-green-500 animate-pulse" : "bg-gray-400"
            }`}></span>
            <span className={`text-[12px] font-bold hidden sm:inline ${
              status === "Online" ? "text-green-700" : "text-gray-600"
            }`}>
              {status}
            </span>
            <ChevronRight className={`w-3.5 h-3.5 ${
              status === "Online" ? "text-green-500" : "text-gray-400"
            }`} />
          </button>
        )}

        <div className="flex items-center">
          {showSearch && (
            <button
              onClick={handleSearchClick}
              className="p-1.5 hover:bg-gray-50 rounded-full transition-colors"
              aria-label="Search"
            >
              <Search className="w-5 h-5 text-gray-600" />
            </button>
          )}

          {showNotifications && (
            <button
              onClick={handleNotificationsClick}
              className="relative p-1.5 hover:bg-gray-50 rounded-full transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 border border-white" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Real-time Dining Booking Popup */}
      {newReservation && (
        <div className="fixed top-20 left-4 right-4 z-[100] animate-in slide-in-from-top duration-300">
          <div className="bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-amber-500/10 overflow-hidden">
            <div className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0">
                <Utensils className="w-6 h-6 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-black text-slate-900 text-sm">New Table Request!</h4>
                <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                  {newReservation.user?.name || "A Guest"} has requested a table for {newReservation.guests} people.
                </p>
              </div>
              <button 
                onClick={clearNewReservation}
                className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-slate-50 p-3 flex gap-2">
              <button 
                onClick={() => {
                  clearNewReservation();
                  navigate("/food/restaurant/reservations");
                }}
                className="flex-1 h-10 bg-amber-500 text-slate-950 text-xs font-bold rounded-xl uppercase tracking-widest"
              >
                View Request
              </button>
              <button 
                onClick={clearNewReservation}
                className="px-4 h-10 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-xl uppercase tracking-widest"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
