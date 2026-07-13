import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { Calendar, Clock, Users, Search, MessageSquare, CheckCircle2, Clock4, UploadCloud, ImagePlus, ChevronDown, ChevronUp, Sparkles, MapPin, Phone, Info, X, ArrowLeft, UtensilsCrossed, Star, Pencil, Sunrise, Sun, Moon } from "lucide-react"
import { diningAPI, restaurantAPI } from "@food/api"
import Loader from "@food/components/Loader"
import { Badge } from "@food/components/ui/badge"
import { toast } from "sonner"
const debugError = (...args) => {}

const getRestaurantFromResponse = (response) =>
    response?.data?.data?.restaurant ||
    response?.data?.restaurant ||
    response?.data?.data ||
    null

const normalizeImageEntry = (entry) => {
    if (!entry) return null
    if (typeof entry === "string") {
        const url = entry.trim()
        return url ? { url, publicId: null } : null
    }
    const url = String(entry?.url || "").trim()
    if (!url) return null
    return {
        url,
        publicId: entry?.publicId || null,
    }
}

const getProfilePhotoUrl = (restaurant) => {
    const candidate = restaurant?.profileImage
    if (!candidate) return ""
    if (typeof candidate === "string") return candidate.trim()
    return String(candidate?.url || "").trim()
}

const getCoverImages = (restaurant) => {
    const base = Array.isArray(restaurant?.coverImages) ? restaurant.coverImages : []
    return base
        .map(normalizeImageEntry)
        .filter(Boolean)
}

const getMenuImages = (restaurant) => {
    const base = Array.isArray(restaurant?.menuImages) ? restaurant.menuImages : []

    return base
        .map(normalizeImageEntry)
        .filter(Boolean)
}

const getBookerName = (booking) =>
    String(
        booking?.user?.name ||
        booking?.customerName ||
        booking?.bookedBy?.name ||
        booking?.name ||
        "Guest"
    ).trim()

const getBookerPhone = (booking) =>
    String(
        booking?.user?.phone ||
        booking?.phone ||
        booking?.phoneNumber ||
        booking?.mobile ||
        booking?.bookedBy?.phone ||
        ""
    ).trim()

const formatMealPreference = (value) => {
    const normalized = String(value || "").trim().toLowerCase()
    if (!normalized) return ""
    if (normalized === "breakfast") return "Breakfast"
    if (normalized === "lunch") return "Lunch"
    if (normalized === "dinner") return "Dinner"
    return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

const normalizeMealPeriods = (value, fallback = ["breakfast", "lunch", "dinner"]) => {
    const allowed = new Set(["breakfast", "lunch", "dinner"])
    const source = Array.isArray(value)
        ? value
        : String(value || "")
            .split(",")
            .map((item) => item.trim())

    const normalized = [...new Set(
        source
            .map((item) => String(item || "").trim().toLowerCase())
            .filter((item) => allowed.has(item))
    )]

    return normalized.length > 0 ? normalized : [...fallback]
}

const formatMealPeriodLabel = (value) => {
    const normalized = String(value || "").trim().toLowerCase()
    if (normalized === "breakfast") return "Breakfast"
    if (normalized === "lunch") return "Lunch"
    if (normalized === "dinner") return "Dinner"
    return normalized
}


const MAX_RESTAURANT_PHOTOS = 10
const MAX_MENU_PHOTOS = 10

export default function DiningReservations() {
    const navigate = useNavigate()
    const goBack = useRestaurantBackNavigation()
    const [bookings, setBookings] = useState([])
    const [loading, setLoading] = useState(true)
    const [restaurant, setRestaurant] = useState(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [restaurantPhoto, setRestaurantPhoto] = useState("")
    const [restaurantPhotos, setRestaurantPhotos] = useState([])
    const [menuPhotos, setMenuPhotos] = useState([])
    const [uploadingRestaurantPhoto, setUploadingRestaurantPhoto] = useState(false)
    const [uploadingMenuPhotos, setUploadingMenuPhotos] = useState(false)
    const [removingRestaurantPhoto, setRemovingRestaurantPhoto] = useState(false)
    const [removingMenuPhoto, setRemovingMenuPhoto] = useState(false)
    const [uploadMessage, setUploadMessage] = useState("")
    const [uploadError, setUploadError] = useState("")
    const [featuredPrice, setFeaturedPrice] = useState("")
    const [editingFeaturedPrice, setEditingFeaturedPrice] = useState(false)
    const [savingFeaturedPrice, setSavingFeaturedPrice] = useState(false)
    const [activeSection, setActiveSection] = useState("reservations")
    const [activeView, setActiveView] = useState("priority")
    const [showMediaPanel, setShowMediaPanel] = useState(false)
    const [diningEnabled, setDiningEnabled] = useState(false)
    const [maxGuestsLimit, setMaxGuestsLimit] = useState(6)
    const [savingDiningSettings, setSavingDiningSettings] = useState(false)
    const [diningSettingsMessage, setDiningSettingsMessage] = useState("")
    const [diningSettingsError, setDiningSettingsError] = useState("")
    const [diningType, setDiningType] = useState([])
    const [mealPeriods, setMealPeriods] = useState(["breakfast", "lunch", "dinner"])
    const [availableCategories, setAvailableCategories] = useState([])
    const [pendingRequest, setPendingRequest] = useState(null)
    const [fetchingRequest, setFetchingRequest] = useState(true)
    const [originalSettings, setOriginalSettings] = useState(null)
    
    useEffect(() => {
        console.log("diningType updated:", diningType)
        console.log("diningType is array?", Array.isArray(diningType))
        console.log("diningType items:", diningType.map((item, i) => `${i}: "${item}"`))
    }, [diningType])

    const syncRestaurantMediaState = (restaurantData, categoriesList = []) => {
        console.log("syncRestaurantMediaState called with restaurantData:", restaurantData)
        setRestaurant(restaurantData || null)
        const coverImages = getCoverImages(restaurantData)
        const profileImage = getProfilePhotoUrl(restaurantData)
        setRestaurantPhotos(coverImages)
        setRestaurantPhoto(coverImages[0]?.url || profileImage)
        setMenuPhotos(getMenuImages(restaurantData))
        setFeaturedPrice(
            restaurantData?.featuredPrice !== undefined && restaurantData?.featuredPrice !== null
                ? String(restaurantData.featuredPrice)
                : (
                    restaurantData?.costForTwo !== undefined && restaurantData?.costForTwo !== null
                        ? String(restaurantData.costForTwo)
                        : ""
                )
        )
        setEditingFeaturedPrice(false)
        
        const diningEnabled = Boolean(restaurantData?.diningSettings?.isEnabled)
        const maxGuestsLimit = Math.max(1, parseInt(restaurantData?.diningSettings?.maxGuests, 10) || 6)
        const rawDiningType = restaurantData?.diningSettings?.diningType
        
        console.log("syncRestaurantMediaState rawDiningType:", rawDiningType)
        
        // Parse diningType properly
        const allSlugs = []
        if (Array.isArray(rawDiningType)) {
            rawDiningType.forEach(item => {
                const strItem = String(item || '').trim()
                strItem.split(',').forEach(slug => {
                    const trimmed = slug.trim()
                    if (trimmed) allSlugs.push(trimmed)
                })
            })
        } else {
            const strItem = String(rawDiningType || '').trim()
            strItem.split(',').forEach(slug => {
                const trimmed = slug.trim()
                if (trimmed) allSlugs.push(trimmed)
            })
        }
        const diningType = [...new Set(allSlugs)]
        
        // Filter diningType to only include available categories in the system
        const activeCategories = categoriesList.length > 0 ? categoriesList : availableCategories
        const availableSlugs = new Set(activeCategories.map(c => c.slug))
        const filteredDiningType = availableSlugs.size > 0 
            ? diningType.filter(slug => availableSlugs.has(slug)) 
            : diningType

        const mealPeriods = normalizeMealPeriods(restaurantData?.diningSettings?.mealPeriods)
        
        setDiningEnabled(diningEnabled)
        setMaxGuestsLimit(maxGuestsLimit)
        setDiningType(filteredDiningType)
        setMealPeriods(mealPeriods)
        
        setOriginalSettings({
            isEnabled: diningEnabled,
            maxGuests: maxGuestsLimit,
            diningType: [...filteredDiningType].sort(),
            mealPeriods: [...mealPeriods].sort()
        })
    }

    useEffect(() => {
        const fetchAll = async (isPoll = false) => {
            try {
                if (!isPoll) setLoading(true)

                const resResponse = await restaurantAPI.getCurrentRestaurant()
                if (resResponse.data.success) {
                    const resData = getRestaurantFromResponse(resResponse)
                    const restaurantId = resData?._id || resData?.id

                    if (restaurantId) {
                        let categoriesList = availableCategories
                        if (!isPoll) {
                            const catRes = await diningAPI.getCategories()
                            if (catRes.data.success) {
                                categoriesList = catRes.data.data || []
                                setAvailableCategories(categoriesList)
                            }

                            const bookingsResponse = await diningAPI.getRestaurantBookings(resData)
                            if (bookingsResponse.data.success) {
                                setBookings(Array.isArray(bookingsResponse.data.data) ? bookingsResponse.data.data : [])
                            }
                        }

                        syncRestaurantMediaState(resData, categoriesList)

                        const requestRes = await restaurantAPI.getPendingDiningRequest()
                        const newPendingRequest = requestRes.data.success && requestRes.data.data ? requestRes.data.data : null

                        if (pendingRequest && !newPendingRequest) {
                            const updatedRes = await restaurantAPI.getCurrentRestaurant()
                            const updatedData = getRestaurantFromResponse(updatedRes)
                            
                            // Simple check: if isEnabled matches what we requested, it was likely approved
                            const requestedEnabled = pendingRequest.requestedSettings?.isEnabled
                            const currentEnabled = updatedData?.diningSettings?.isEnabled
                            
                            if (requestedEnabled === currentEnabled) {
                                toast.success("Dining settings updated and approved!")
                            } else {
                                toast.error("Your dining settings request was rejected by admin.")
                            }
                            
                            syncRestaurantMediaState(updatedData)
                        }

                        setPendingRequest(newPendingRequest)
                        console.log("Loading pending request:", newPendingRequest)
                    }
                }
            } catch (error) {
                if (!isPoll) debugError("Error fetching dining data:", error)
            } finally {
                if (!isPoll) {
                    setLoading(false)
                    setFetchingRequest(false)
                }
            }
        }

        fetchAll()
        let interval
        if (pendingRequest) {
            interval = setInterval(() => fetchAll(true), 15000)
        }
        return () => interval && clearInterval(interval)
    }, [pendingRequest?._id])

    const handleRestaurantPhotoUpload = async (event) => {
        const files = Array.from(event.target.files || [])
        if (files.length === 0) return

        const maxAllowed = MAX_RESTAURANT_PHOTOS - restaurantPhotos.length
        if (maxAllowed <= 0) {
            setUploadError(`You can only upload up to ${MAX_RESTAURANT_PHOTOS} restaurant photos. Please delete some first.`)
            toast.error(`Maximum ${MAX_RESTAURANT_PHOTOS} restaurant photos allowed`)
            event.target.value = ""
            return
        }

        if (files.length > maxAllowed) {
            setUploadError(`You can only upload ${maxAllowed} more restaurant photo(s).`)
            toast.error(`Only ${maxAllowed} more restaurant photo(s) allowed`)
            event.target.value = ""
            return
        }

        setUploadError("")
        setUploadMessage("")
        setUploadingRestaurantPhoto(true)

        try {
            await restaurantAPI.uploadCoverImages(files)
            const refreshedResponse = await restaurantAPI.getCurrentRestaurant()
            const refreshedRestaurant = getRestaurantFromResponse(refreshedResponse)
            syncRestaurantMediaState(refreshedRestaurant)
            setUploadMessage(`Uploaded ${files.length} restaurant photo(s) successfully.`)
            toast.success(`Uploaded ${files.length} restaurant photo(s) successfully`)
        } catch (error) {
            debugError("Error uploading restaurant photo:", error)
            setUploadError(error?.response?.data?.message || "Failed to upload restaurant photos.")
            toast.error(error?.response?.data?.message || "Failed to upload restaurant photos")
        } finally {
            setUploadingRestaurantPhoto(false)
            event.target.value = ""
        }
    }

    const handleMenuPhotosUpload = async (event) => {
        const files = Array.from(event.target.files || [])
        if (files.length === 0) return

        const maxAllowed = MAX_MENU_PHOTOS - menuPhotos.length
        if (maxAllowed <= 0) {
            setUploadError(`You can only upload up to ${MAX_MENU_PHOTOS} menu photos. Please delete some first.`)
            toast.error(`Maximum ${MAX_MENU_PHOTOS} menu photos allowed`)
            event.target.value = ""
            return
        }

        if (files.length > maxAllowed) {
            setUploadError(`You can only upload ${maxAllowed} more menu photo(s).`)
            toast.error(`Only ${maxAllowed} more menu photo(s) allowed`)
            event.target.value = ""
            return
        }

        setUploadError("")
        setUploadMessage("")
        setUploadingMenuPhotos(true)

        try {
            await restaurantAPI.uploadMenuImages(files)
            const refreshedResponse = await restaurantAPI.getCurrentRestaurant()
            syncRestaurantMediaState(getRestaurantFromResponse(refreshedResponse))
            setUploadMessage(`Uploaded ${files.length} menu photo(s) successfully.`)
            toast.success(`Uploaded ${files.length} menu photo(s) successfully`)
        } catch (error) {
            debugError("Error saving menu photos:", error)
            setUploadError(error?.response?.data?.message || "Failed to upload menu photos.")
            toast.error(error?.response?.data?.message || "Failed to upload menu photos")
        } finally {
            setUploadingMenuPhotos(false)
            event.target.value = ""
        }
    }

    const handleRemoveRestaurantPhoto = async (photoUrl) => {
        if (!photoUrl || removingRestaurantPhoto) return

        setUploadError("")
        setUploadMessage("")
        setRemovingRestaurantPhoto(true)

        try {
            const nextCoverImages = restaurantPhotos.filter((photo) => photo.url !== photoUrl)
            const currentProfileImage = getProfilePhotoUrl(restaurant)
            const nextPrimaryPhoto = nextCoverImages[0]?.url || ""
            const shouldClearProfileImage = !nextPrimaryPhoto && currentProfileImage === photoUrl

            const response = await restaurantAPI.updateProfile({
                coverImages: nextCoverImages.map((photo) => ({
                    url: photo.url,
                    ...(photo.publicId ? { publicId: photo.publicId } : {}),
                })),
                ...(shouldClearProfileImage ? { profileImage: "" } : {}),
            })

            const updatedRestaurant = getRestaurantFromResponse(response)
            if (updatedRestaurant) {
                syncRestaurantMediaState(updatedRestaurant)
            } else {
                const refreshedResponse = await restaurantAPI.getCurrentRestaurant()
                syncRestaurantMediaState(getRestaurantFromResponse(refreshedResponse))
            }

            setUploadMessage("Restaurant photo removed successfully.")
        } catch (error) {
            debugError("Error removing restaurant photo:", error)
            setUploadError(error?.response?.data?.message || "Failed to remove restaurant photo.")
        } finally {
            setRemovingRestaurantPhoto(false)
        }
    }

    const handleRemoveMenuPhoto = async (photoUrl) => {
        if (!photoUrl || removingMenuPhoto) return

        setUploadError("")
        setUploadMessage("")
        setRemovingMenuPhoto(true)

        try {
            const nextMenuPhotos = menuPhotos.filter((photo) => photo.url !== photoUrl)
            const response = await restaurantAPI.updateProfile({
                menuImages: nextMenuPhotos.map((photo) => ({
                    url: photo.url,
                    ...(photo.publicId ? { publicId: photo.publicId } : {}),
                })),
            })

            const updatedRestaurant = getRestaurantFromResponse(response)
            if (updatedRestaurant) {
                syncRestaurantMediaState(updatedRestaurant)
            } else {
                const refreshedResponse = await restaurantAPI.getCurrentRestaurant()
                syncRestaurantMediaState(getRestaurantFromResponse(refreshedResponse))
            }

            setUploadMessage("Menu photo removed successfully.")
        } catch (error) {
            debugError("Error removing menu photo:", error)
            setUploadError(error?.response?.data?.message || "Failed to remove menu photo.")
        } finally {
            setRemovingMenuPhoto(false)
        }
    }

    const handleSaveFeaturedPrice = async () => {
        if (!restaurant || savingFeaturedPrice) return

        const nextFeaturedPrice = Number(featuredPrice)
        if (!Number.isFinite(nextFeaturedPrice) || nextFeaturedPrice < 0) {
            setUploadError("Please enter a valid cost for two.")
            toast.error("Cost for two must be 0 or more")
            return
        }

        setUploadError("")
        setUploadMessage("")
        setSavingFeaturedPrice(true)

        try {
            const response = await restaurantAPI.updateProfile({
                featuredPrice: nextFeaturedPrice,
            })

            const updatedRestaurant = getRestaurantFromResponse(response)
            if (updatedRestaurant) {
                syncRestaurantMediaState(updatedRestaurant)
            } else {
                const refreshedResponse = await restaurantAPI.getCurrentRestaurant()
                syncRestaurantMediaState(getRestaurantFromResponse(refreshedResponse))
            }

            setUploadMessage(`Cost for two updated to ₹${nextFeaturedPrice}.`)
            toast.success("Cost for two saved")
            setEditingFeaturedPrice(false)
        } catch (error) {
            debugError("Error saving featured price:", error)
            setUploadError(error?.response?.data?.message || "Failed to save cost for two.")
            toast.error(error?.response?.data?.message || "Failed to save cost for two")
        } finally {
            setSavingFeaturedPrice(false)
        }
    }

    const hasChanges = () => {
        if (!originalSettings) return false
        const currentMaxGuests = parseInt(maxGuestsLimit, 10) || 0
        const maxGuestsChanged = originalSettings.maxGuests !== currentMaxGuests
        const isEnabledChanged = originalSettings.isEnabled !== Boolean(diningEnabled)
        const diningTypeChanged = JSON.stringify([...diningType].sort()) !== JSON.stringify(originalSettings.diningType)
        const mealPeriodsChanged = JSON.stringify([...normalizeMealPeriods(mealPeriods)].sort()) !== JSON.stringify(originalSettings.mealPeriods)
        return isEnabledChanged || maxGuestsChanged || diningTypeChanged || mealPeriodsChanged
    }

    const handleSaveDiningSettings = async () => {
        if (!restaurant || savingDiningSettings) return
        if (!hasChanges()) {
            toast.info("No changes to save")
            return
        }

        if (!diningType || diningType.length === 0) {
            setDiningSettingsError("Please select at least one dining category")
            toast.error("Dining category is required")
            return
        }
        if (!mealPeriods || mealPeriods.length === 0) {
            setDiningSettingsError("Please select at least one meal period")
            toast.error("Meal period is required")
            return
        }

        const nextMaxGuests = parseInt(maxGuestsLimit, 10) || 0

        if (diningEnabled && nextMaxGuests <= 0) {
            setDiningSettingsError("Guest limit must be at least 1 when dining is enabled")
            toast.error("Set at least 1 guest limit to enable dining")
            return
        }

        // Parse and sanitize diningType before sending
        const allSlugs = []
        if (Array.isArray(diningType)) {
            diningType.forEach(item => {
                const strItem = String(item || '').trim()
                strItem.split(',').forEach(slug => {
                    const trimmed = slug.trim()
                    if (trimmed) allSlugs.push(trimmed)
                })
            })
        } else {
            const strItem = String(diningType || '').trim()
            strItem.split(',').forEach(slug => {
                const trimmed = slug.trim()
                if (trimmed) allSlugs.push(trimmed)
            })
        }
        const availableSlugs = new Set(availableCategories.map(c => c.slug))
        const sanitizedDiningType = [...new Set(allSlugs)].filter(slug => availableSlugs.has(slug))
        
        const nextDiningSettings = {
            isEnabled: Boolean(diningEnabled),
            maxGuests: nextMaxGuests,
            diningType: sanitizedDiningType,
            mealPeriods: normalizeMealPeriods(mealPeriods),
        }
        console.log("handleSaveDiningSettings - sanitized diningType:", sanitizedDiningType)

        setDiningSettingsError("")
        setDiningSettingsMessage("")
        setSavingDiningSettings(true)

        try {
            const response = await restaurantAPI.requestDiningUpdate(nextDiningSettings)

            if (response.data.success) {
                const updatedRequest = response.data.data
                setPendingRequest(updatedRequest)
                setDiningSettingsMessage("Update request sent to admin for approval.")
                toast.success("Request sent for approval")
                
                if (originalSettings) {
                    setDiningEnabled(originalSettings.isEnabled)
                    setMaxGuestsLimit(originalSettings.maxGuests)
                    setDiningType([...originalSettings.diningType])
                    setMealPeriods([...originalSettings.mealPeriods])
                }
            }
        } catch (error) {
            debugError("Error requesting dining settings update:", error)
            setDiningSettingsError(error?.response?.data?.message || "Failed to submit request.")
            toast.error(error?.response?.data?.message || "Failed to submit request")
        } finally {
            setSavingDiningSettings(false)
        }
    }

    const handleStatusUpdate = async (bookingId, newStatus) => {
        try {
            const response = await diningAPI.updateBookingStatusRestaurant(bookingId, newStatus)
             if (response.data.success) {
                setBookings(prev => prev.map(b =>
                    b._id === bookingId ? { ...b, status: newStatus } : b
                ))
                toast.success(`Booking ${newStatus === 'accepted' ? 'confirmed' : 'declined'}`)
            }
        } catch (error) {
            debugError("Error updating status:", error)
            toast.error("Failed to update status")
        }
    }

    const getStatusPriority = (status) => {
        const key = String(status || "").toLowerCase()
        if (key === "pending") return 0
        if (key === "confirmed") return 1
        if (key === "accepted") return 2
        if (key === "checked-in") return 3
        if (key === "completed") return 4
        if (key === "cancelled") return 5
        return 6
    }

    const getBookingTimestamp = (booking) => {
        const createdAtTs = new Date(booking?.createdAt || "").getTime()
        if (!Number.isNaN(createdAtTs)) return createdAtTs
        const dateTs = new Date(booking?.date || "").getTime()
        if (!Number.isNaN(dateTs)) return dateTs
        return 0
    }

    const isToday = (value) => {
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) return false
        return date.toDateString() === new Date().toDateString()
    }

    const isNewRequest = (booking) => {
        if (String(booking?.status || "").toLowerCase() !== "pending") return false
        const createdAt = new Date(booking?.createdAt || booking?.date || "").getTime()
        if (Number.isNaN(createdAt)) return true
        return Date.now() - createdAt <= 2 * 60 * 60 * 1000
    }

    const sortedBookings = useMemo(() => {
        return [...bookings].sort((a, b) => {
            const priorityDiff = getStatusPriority(a?.status) - getStatusPriority(b?.status)
            if (priorityDiff !== 0) return priorityDiff
            return getBookingTimestamp(b) - getBookingTimestamp(a)
        })
    }, [bookings])

    const filteredBookings = useMemo(() => {
        const term = searchTerm.trim().toLowerCase()
        return sortedBookings
            .filter((booking) => {
                if (!term) return true
                return (
                    getBookerName(booking).toLowerCase().includes(term) ||
                    String(booking?.bookingId || "").toLowerCase().includes(term) ||
                    getBookerPhone(booking).toLowerCase().includes(term)
                )
            })
            .filter((booking) => {
                if (activeView === "today") return isToday(booking?.date)
                if (activeView === "pending") return String(booking?.status || "").toLowerCase() === "pending"
                return true
            })
    }, [sortedBookings, searchTerm, activeView])

    const newRequestsCount = useMemo(
        () => bookings.filter((booking) => isNewRequest(booking)).length,
        [bookings]
    )

    if (loading) return <Loader />

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-xl sticky top-0 z-30 border-b border-slate-100">
                <div className="max-w-7xl mx-auto px-4 py-2 flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2.5"
                    >
                        <button
                            onClick={goBack}
                            className="bg-slate-100 p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-all border border-slate-200"
                            aria-label="Back to explore"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div>
                            <h1 className="text-[17px] font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                                Table Reservations
                                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            </h1>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">Live Queue Management</p>
                        </div>
                    </motion.div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                type="text"
                                id="reservation-search"
                                name="reservation-search"
                                placeholder="Search guests..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full sm:w-56 pl-9 pr-3 py-1.5 bg-slate-100/50 border-2 border-transparent rounded-xl text-xs font-bold focus:bg-white focus:border-blue-500/20 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                            />
                        </div>
                        <div className="flex items-center gap-1 bg-slate-100/50 p-0.5 rounded-xl border border-slate-200/50">
                            <button
                                onClick={() => setActiveSection("reservations")}
                                className={`px-3 py-1 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeSection === "reservations" ? "bg-white text-slate-900 shadow-md shadow-slate-200/50 scale-[1.02]" : "text-slate-400 hover:text-slate-600"}`}
                            >
                                Queue
                            </button>
                            <button
                                onClick={() => setActiveSection("media")}
                                className={`px-3 py-1 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeSection === "media" ? "bg-white text-slate-900 shadow-md shadow-slate-200/50 scale-[1.02]" : "text-slate-400 hover:text-slate-600"}`}
                            >
                                Media
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-6">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-2.5 md:gap-4 mb-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="bg-white p-2.5 md:p-3.5 rounded-xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow"
                    >
                        <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50/50 rounded-bl-full -mr-6 -mt-6 transition-transform group-hover:scale-110" />
                        <div className="flex items-center gap-2 md:gap-3 relative">
                            <div className="bg-blue-600 p-1.5 md:p-2 rounded-lg text-white shadow-lg shadow-blue-200">
                                <Users className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-slate-500 text-[9px] md:text-xs font-bold uppercase tracking-wider">Bookings</p>
                                <p className="text-sm md:text-lg font-black text-slate-900 leading-none mt-0.5">{bookings.length}</p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                        className="bg-white p-2.5 md:p-3.5 rounded-xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow"
                    >
                        <div className="absolute top-0 right-0 w-16 h-16 bg-green-50/50 rounded-bl-full -mr-6 -mt-6 transition-transform group-hover:scale-110" />
                        <div className="flex items-center gap-2 md:gap-3 relative">
                            <div className="bg-emerald-600 p-1.5 md:p-2 rounded-lg text-white shadow-lg shadow-emerald-200">
                                <CheckCircle2 className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-slate-500 text-[9px] md:text-xs font-bold uppercase tracking-wider">Guests Today</p>
                                <p className="text-sm md:text-lg font-black text-slate-900 leading-none mt-0.5">
                                    {bookings
                                        .filter(b => new Date(b.date).toDateString() === new Date().toDateString() &&
                                            ['confirmed', 'accepted', 'checked-in'].includes(String(b.status || '').toLowerCase()))
                                        .reduce((sum, b) => sum + (Number(b.guests) || 0), 0)}
                                </p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.2 }}
                        className="bg-white p-2.5 md:p-3.5 rounded-xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow"
                    >
                        <div className="absolute top-0 right-0 w-16 h-16 bg-orange-50/50 rounded-bl-full -mr-6 -mt-6 transition-transform group-hover:scale-110" />
                        <div className="flex items-center gap-2 md:gap-3 relative">
                            <div className="bg-orange-600 p-1.5 md:p-2 rounded-lg text-white shadow-lg shadow-orange-200">
                                <Clock4 className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-slate-500 text-[9px] md:text-xs font-bold uppercase tracking-wider">Pending</p>
                                <p className="text-sm md:text-lg font-black text-slate-900 leading-none mt-0.5">
                                    {bookings.filter(b => String(b.status || '').toLowerCase() === 'pending').length}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {activeSection === "media" && (
                <div className="mb-4">
                    <button
                        onClick={() => setShowMediaPanel((prev) => !prev)}
                        className="w-full bg-white rounded-xl border border-slate-200 px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                        <div>
                            <h2 className="text-left text-sm font-bold text-slate-900">Photos & Menu Manager</h2>
                            <p className="text-left text-[11px] text-slate-500">Upload restaurant and menu images only when needed.</p>
                        </div>
                        {showMediaPanel ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </button>
                </div>
                )}

                {activeSection === "media" && showMediaPanel && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-sm font-bold text-slate-900">
                                    Restaurant Photos
                                    <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${restaurantPhotos.length >= MAX_RESTAURANT_PHOTOS ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                                        {restaurantPhotos.length}/{MAX_RESTAURANT_PHOTOS}
                                    </span>
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">Add multiple restaurant photos. First is main preview.</p>
                            </div>
                            <label className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white text-xs font-semibold cursor-pointer transition-colors shrink-0 ${restaurantPhotos.length >= MAX_RESTAURANT_PHOTOS ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800'}`}>
                                <UploadCloud className="w-3.5 h-3.5" />
                                {uploadingRestaurantPhoto ? "Uploading..." : "Add Photos"}
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    multiple
                                    onChange={handleRestaurantPhotoUpload}
                                    disabled={uploadingRestaurantPhoto || removingRestaurantPhoto || restaurantPhotos.length >= MAX_RESTAURANT_PHOTOS}
                                />
                            </label>
                        </div>

                        <div className="mt-3 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 h-44">
                            {restaurantPhoto ? (
                                <img
                                    src={restaurantPhoto}
                                    alt={restaurant?.restaurantName || restaurant?.name || "Restaurant"}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                    <ImagePlus className="w-6 h-6 mb-1" />
                                    <p className="text-xs font-medium">No restaurant photo added yet</p>
                                </div>
                            )}
                        </div>

                        {restaurantPhotos.length > 0 && (
                            <div className="mt-3 grid grid-cols-4 gap-2">
                                {restaurantPhotos.map((photo, index) => (
                                    <button
                                        key={`${photo.url}-${index}`}
                                        type="button"
                                        onClick={() => setRestaurantPhoto(photo.url)}
                                        className={`relative h-14 rounded-md overflow-hidden border bg-slate-50 transition-all ${restaurantPhoto === photo.url ? "border-slate-900 ring-1 ring-slate-200" : "border-slate-200"}`}
                                    >
                                        <img
                                            src={photo.url}
                                            alt={`Restaurant photo ${index + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                        <span className="absolute inset-x-0 bottom-0 bg-black/45 px-1 py-0.5 text-[8px] font-semibold text-white">
                                            {restaurantPhoto === photo.url ? "Main" : `Photo ${index + 1}`}
                                        </span>
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleRemoveRestaurantPhoto(photo.url)
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                    handleRemoveRestaurantPhoto(photo.url)
                                                }
                                            }}
                                            className="absolute right-0.5 top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/95 text-rose-600 shadow-sm"
                                        >
                                            <X className="h-2.5 w-2.5" />
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-sm font-bold text-slate-900">
                                    Menu Photos
                                    <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${menuPhotos.length >= MAX_MENU_PHOTOS ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                                        {menuPhotos.length}/{MAX_MENU_PHOTOS}
                                    </span>
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">Add menu photos and view previously uploaded photos.</p>
                            </div>
                            <label className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white text-xs font-semibold cursor-pointer transition-colors shrink-0 ${menuPhotos.length >= MAX_MENU_PHOTOS ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                                <UploadCloud className="w-3.5 h-3.5" />
                                {uploadingMenuPhotos ? "Uploading..." : "Add Photos"}
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    multiple
                                    onChange={handleMenuPhotosUpload}
                                    disabled={uploadingMenuPhotos || removingMenuPhoto || menuPhotos.length >= MAX_MENU_PHOTOS}
                                />
                            </label>
                        </div>

                        {menuPhotos.length > 0 ? (
                            <div className="mt-3 grid grid-cols-3 gap-2">
                                {menuPhotos.map((photo, index) => (
                                    <div key={`${photo.url}-${index}`} className="relative h-16 rounded-md overflow-hidden border border-slate-200 bg-slate-50">
                                        <img src={photo.url} alt={`Menu photo ${index + 1}`} className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveMenuPhoto(photo.url)}
                                            className="absolute right-0.5 top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/95 text-rose-600 shadow-sm"
                                            disabled={removingMenuPhoto}
                                        >
                                            <X className="h-2.5 w-2.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="mt-3 h-20 rounded-lg border border-dashed border-slate-350 bg-slate-50 flex flex-col items-center justify-center text-slate-400">
                                <ImagePlus className="w-5 h-5 mb-1" />
                                <p className="text-xs font-medium">No menu photos added yet</p>
                            </div>
                        )}
                    </div>

                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 lg:col-span-2">
                        <div className="flex flex-col gap-3">
                            <div className="max-w-xl">
                                <h2 className="text-sm font-bold text-slate-900">Cost for two</h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    This value is shown on the guest restaurant page as the dining price.
                                </p>
                            </div>

                            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                <span className="text-sm font-bold text-slate-500">₹</span>
                                {!editingFeaturedPrice ? (
                                    <>
                                        <span className="flex-1 text-sm font-semibold text-slate-900">
                                            {featuredPrice || "Not set"}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setEditingFeaturedPrice(true)}
                                            className="inline-flex items-center justify-center rounded-lg bg-slate-900 p-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={featuredPrice}
                                            onChange={(event) => setFeaturedPrice(event.target.value)}
                                            placeholder="300"
                                            className="flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0"
                                            autoFocus
                                        />
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingFeaturedPrice(false);
                                                    setFeaturedPrice(
                                                        restaurant?.featuredPrice !== undefined && restaurant?.featuredPrice !== null
                                                            ? String(restaurant.featuredPrice)
                                                            : (
                                                                restaurant?.costForTwo !== undefined && restaurant?.costForTwo !== null
                                                                    ? String(restaurant.costForTwo)
                                                                    : ""
                                                            )
                                                    );
                                                }}
                                                disabled={savingFeaturedPrice}
                                                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSaveFeaturedPrice}
                                                disabled={savingFeaturedPrice}
                                                className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                {savingFeaturedPrice ? "Saving..." : "Save"}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                )}

                {activeSection === "reservations" && (
                    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                        <div className="max-w-xl mb-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Dining Controls</p>
                            <h2 className="mt-0.5 text-sm font-black text-slate-900">Manage dining availability and booking limit</h2>
                            <p className="mt-0.5 text-xs text-slate-500">
                                These settings update the same dining profile the guest booking flow reads, so restaurant changes are reflected on the user side too.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mb-4">
                            <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                                <span className={`h-2 w-2 rounded-full ${diningEnabled ? "bg-emerald-500" : "bg-rose-500"}`} />
                                <span className="text-[11px] font-semibold text-slate-700">
                                    {diningEnabled ? "Dining enabled" : "Dining paused"}
                                </span>
                            </div>

                            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
                                <span className="text-[11px] font-medium text-slate-700">Turn dining on/off</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                    const newState = !diningEnabled
                                    setDiningEnabled(newState)
                                    if (!newState) {
                                        setMaxGuestsLimit(0)
                                    } else if (maxGuestsLimit === 0) {
                                        setMaxGuestsLimit(6)
                                    }
                                }}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${diningEnabled ? "bg-emerald-600" : "bg-slate-300"}`}
                                    aria-pressed={diningEnabled}
                                >
                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${diningEnabled ? "translate-x-4.5" : "translate-x-0.5"}`} />
                                </button>
                            </div>
                        </div>

                        {/* Dining Categories Selection */}
                        <div className="mt-4 border-t border-slate-100 pt-4">
                            <label className="block text-xs font-bold text-slate-900 mb-2.5">
                                Choose Dining Categories (Pick Multiple)
                            </label>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                {availableCategories.map((cat) => {
                                    const isSelected = Array.isArray(diningType) && diningType.includes(cat.slug)
                                    return (
                                        <button
                                            key={cat._id}
                                            type="button"
                                            onClick={() => {
                                                if (isSelected) {
                                                    setDiningType(diningType.filter(s => s !== cat.slug))
                                                } else {
                                                    setDiningType([...diningType, cat.slug])
                                                }
                                            }}
                                            className={`group relative flex items-center justify-center p-2 rounded-xl border-2 transition-all ${
                                                isSelected 
                                                    ? "border-red-500 bg-red-50/50 shadow-md scale-[1.02]" 
                                                    : "border-slate-200 bg-white hover:border-slate-300 active:scale-95"
                                            }`}
                                        >
                                            <span className={`text-[11px] font-bold text-center leading-tight transition-colors ${isSelected ? "text-red-600" : "text-slate-500"}`}>
                                                {cat.name}
                                            </span>
                                            {isSelected && (
                                                <div className="absolute top-1.5 right-1.5 animate-in zoom-in duration-200">
                                                    <div className="bg-red-500 rounded-full p-0.5 shadow-sm">
                                                        <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                                                    </div>
                                                </div>
                                            )}
                                        </button>
                                    )
                                })}
                                {availableCategories.length === 0 && (
                                    <div className="col-span-full py-6 text-center text-slate-400 text-xs font-medium border border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                                        No categories available. Please contact support.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Meal Period Facilities */}
                        <div className="mt-4 border-t border-slate-100 pt-4">
                            <label className="block text-xs font-bold text-slate-900 mb-2.5">
                                Meal Facilities / Service Periods
                            </label>
                            <p className="mb-2 text-[10px] font-medium text-slate-500">
                                Choose when this restaurant serves table bookings and guest requests.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {["breakfast", "lunch", "dinner"].map((period) => {
                                    const isSelected = mealPeriods.includes(period)
                                    const getIcon = () => {
                                        if (period === "breakfast") return <Sunrise className="w-3.5 h-3.5" />
                                        if (period === "lunch") return <Sun className="w-3.5 h-3.5" />
                                        if (period === "dinner") return <Moon className="w-3.5 h-3.5" />
                                        return null
                                    }
                                    return (
                                        <button
                                            key={period}
                                            type="button"
                                            onClick={() => {
                                                setMealPeriods((current) => {
                                                    const normalizedCurrent = normalizeMealPeriods(current, [])
                                                    return isSelected
                                                        ? normalizedCurrent.filter((item) => item !== period)
                                                        : [...normalizedCurrent, period]
                                                })
                                            }}
                                            className={`rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                                                isSelected
                                                    ? "border-red-500 bg-red-50/50 text-red-600 shadow-sm"
                                                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                                            }`}
                                        >
                                            {getIcon()}
                                            {formatMealPeriodLabel(period)}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100 pt-4">
                            <div className="flex items-center gap-4">
                                <div className="space-y-0.5">
                                    <label className="block text-xs font-bold text-slate-900">Maximum Guest Limit</label>
                                    <p className="text-[10px] text-slate-500 font-medium">Guests allowed per reservation</p>
                                </div>
                                <div className="flex items-center gap-3 bg-slate-100/80 p-1 rounded-xl border border-slate-200 shadow-inner">
                                    <button 
                                    type="button"
                                    onClick={() => {
                                        setMaxGuestsLimit(Math.max(0, maxGuestsLimit - 1))
                                    }}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white shadow-sm text-slate-600 hover:text-slate-900 active:scale-90 transition-all font-black text-base">
                                        −
                                    </button>
                                    <span className="w-6 text-center text-sm font-black text-slate-800">{maxGuestsLimit}</span>
                                    <button 
                                    type="button"
                                    onClick={() => {
                                        setMaxGuestsLimit(parseInt(maxGuestsLimit) + 1)
                                    }}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white shadow-sm text-slate-600 hover:text-slate-900 active:scale-90 transition-all font-black text-base">
                                        +
                                    </button>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleSaveDiningSettings}
                                disabled={savingDiningSettings || !hasChanges()}
                                className="rounded-full bg-slate-900 px-6 py-2 text-xs font-black text-white transition-all hover:bg-slate-800 hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 shadow-xl shadow-slate-200 uppercase tracking-widest">
                                {savingDiningSettings ? "Saving..." : pendingRequest ? "Update Request" : "Save settings"}
                            </button>
                        </div>

                        {pendingRequest && (
                            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-xs font-semibold text-amber-800 flex flex-col gap-2.5">
                                <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
                                    <Clock4 className="w-4 h-4 text-amber-600 animate-pulse" />
                                    Dining Update Request Pending Approval
                                </div>
                                <p className="text-amber-700 font-medium">
                                    You have submitted a request to update your dining settings. These settings will become active once approved by the admin.
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1 bg-white border border-amber-100 p-3 rounded-xl shadow-sm">
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Requested Categories</p>
                                        <p className="text-slate-800 font-bold text-xs mt-0.5">
                                            {(() => {
                                                const reqType = pendingRequest.requestedSettings?.diningType;
                                                const allSlugs = [];
                                                if (Array.isArray(reqType)) {
                                                    reqType.forEach(item => {
                                                        const strItem = String(item || '').trim();
                                                        strItem.split(',').forEach(slug => {
                                                            const trimmed = slug.trim();
                                                            if (trimmed) allSlugs.push(trimmed);
                                                        });
                                                    });
                                                } else {
                                                    const strItem = String(reqType || '').trim();
                                                    strItem.split(',').forEach(slug => {
                                                        const trimmed = slug.trim();
                                                        if (trimmed) allSlugs.push(trimmed);
                                                    });
                                                }
                                                const slugs = [...new Set(allSlugs)];
                                                const names = slugs.map(slug => {
                                                    const cat = availableCategories.find(c => c.slug === slug);
                                                    return cat ? cat.name : slug;
                                                });
                                                return names.length > 0 ? names.join(', ') : 'None';
                                            })()}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Maximum Guest Limit</p>
                                        <p className="text-slate-800 font-bold text-xs mt-0.5">
                                            {pendingRequest.requestedSettings?.maxGuests ?? 6} guests
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Dining Status</p>
                                        <p className="text-slate-800 font-bold text-xs mt-0.5">
                                            {pendingRequest.requestedSettings?.isEnabled ? 'Enabled' : 'Paused/Disabled'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Meal Periods</p>
                                        <p className="text-slate-800 font-bold text-xs mt-0.5">
                                            {normalizeMealPeriods(pendingRequest.requestedSettings?.mealPeriods || []).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
                                        </p>
                                    </div>
                                </div>
                                <p className="text-[10px] text-amber-600 font-medium italic">
                                    * The form below displays your currently approved active settings. Saving changes below will update and overwrite this pending request.
                                </p>
                            </div>
                        )}

                        {(diningSettingsMessage || diningSettingsError) && (
                            <div className={`mt-3 rounded-xl border px-3 py-2 text-xs font-medium ${diningSettingsError
                                ? "border-rose-200 bg-rose-50 text-rose-700"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700"
                                }`}>
                                {diningSettingsError || diningSettingsMessage}
                            </div>
                        )}
                    </div>
                )}

                {(uploadMessage || uploadError) && (
                    <div className={`mb-4 rounded-xl px-3 py-2 text-xs font-medium border ${uploadError
                        ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-green-50 text-green-700 border-green-200"
                        }`}>
                        {uploadError || uploadMessage}
                    </div>
                )}

                {/* Bookings List */}
                {activeSection === "reservations" && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="font-bold text-xs md:text-sm text-slate-800">Reservation Queue</h2>
                        <div className="flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 p-0.5">
                            <button
                                onClick={() => setActiveView("priority")}
                                className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-colors ${activeView === "priority" ? "bg-slate-900 text-white" : "text-slate-500"}`}
                            >
                                Priority
                            </button>
                            <button
                                onClick={() => setActiveView("pending")}
                                className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-colors ${activeView === "pending" ? "bg-slate-900 text-white" : "text-slate-500"}`}
                            >
                                Pending
                            </button>
                            <button
                                onClick={() => setActiveView("today")}
                                className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-colors ${activeView === "today" ? "bg-slate-900 text-white" : "text-slate-500"}`}
                            >
                                Today
                            </button>
                        </div>
                    </div>

                    {filteredBookings.length > 0 ? (
                        <>
                            {/* Desktop View Table */}
                            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">ID</th>
                                            <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Guest Details</th>
                                            <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Schedule</th>
                                            <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Guests</th>
                                            <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                            <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        <AnimatePresence mode="popLayout">
                                            {filteredBookings.map((booking) => (
                                                <motion.tr 
                                                    layout
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    key={booking._id} 
                                                    className={`hover:bg-slate-50/50 transition-colors`}
                                                >
                                                    <td className="px-3 py-2.5 font-mono text-[10px] font-bold text-slate-400 text-center">#{booking.bookingId}</td>
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6.5 h-6.5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-[10px] uppercase shrink-0">
                                                                {getBookerName(booking).charAt(0) || '?'}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-xs text-slate-900 leading-tight">{getBookerName(booking)}</p>
                                                                <div className="flex items-center gap-1 mt-0.5">
                                                                    <Phone className="w-2.5 h-2.5 text-slate-400" />
                                                                    <p className="text-[10px] text-slate-500">{getBookerPhone(booking) || 'No phone'}</p>
                                                                </div>
                                                                {booking.specialRequest && (
                                                                    <div className="mt-1 flex items-start gap-1 p-1 rounded-md bg-blue-50 border border-blue-100/50 max-w-[140px]">
                                                                        <MessageSquare className="w-2.5 h-2.5 text-blue-600 mt-0.5 shrink-0" />
                                                                        <p className="text-[9px] font-bold text-blue-700 leading-tight">{booking.specialRequest}</p>
                                                                    </div>
                                                                )}
                                                                {booking.review?.rating && (
                                                                    <div className="mt-1 flex flex-col gap-0.5 p-1.5 rounded-md bg-yellow-50/50 border border-yellow-100/50 max-w-[160px]">
                                                                        <div className="flex items-center gap-1">
                                                                            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400 shrink-0" />
                                                                            <span className="text-[10px] font-bold text-yellow-850">{booking.review.rating}/5</span>
                                                                        </div>
                                                                        {booking.review.comment && (
                                                                            <p className="text-[9px] text-slate-600 italic leading-tight" style={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>
                                                                                "{booking.review.comment}"
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                                                                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                                                                {new Date(booking.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                                                                <Clock className="w-3.5 h-3.5 text-blue-500" />
                                                                {booking.timeSlot}
                                                            </div>
                                                            {booking.mealPreference && (
                                                                <div className="inline-flex w-fit items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-100">
                                                                    {formatMealPreference(booking.mealPreference)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center">
                                                        <div className="inline-flex items-center justify-center gap-1 font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                                                            <Users className="w-2.5 h-2.5" />
                                                            {booking.guests}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <Badge className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                                                String(booking.status || '').toLowerCase() === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100 ring-1 ring-amber-100' :
                                                                ['accepted', 'confirmed'].includes(String(booking.status || '').toLowerCase()) ? 'bg-emerald-100 text-emerald-700' :
                                                                String(booking.status || '').toLowerCase() === 'checked-in' ? 'bg-orange-100 text-orange-700' :
                                                                String(booking.status || '').toLowerCase() === 'completed' ? 'bg-blue-100 text-blue-700' :
                                                                'bg-rose-100 text-rose-700'
                                                            } shadow-sm`}>
                                                                {String(booking.status || '').toLowerCase() === 'pending' ? 'APPROVAL REQD' : 
                                                                 ['accepted', 'confirmed'].includes(String(booking.status || '').toLowerCase()) ? 'CONFIRMED' : 
                                                                 booking.status}
                                                            </Badge>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right">
                                                        <div className="flex justify-end gap-1.5">
                                                            {String(booking.status || '').toLowerCase() === 'pending' && (
                                                                <>
                                                                    <button
                                                                        onClick={() => handleStatusUpdate(booking._id, 'accepted')}
                                                                        className="px-2 py-1 rounded bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[9px] uppercase tracking-wider active:scale-95 transition-all shadow-sm shadow-emerald-100"
                                                                    >
                                                                        Accept
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleStatusUpdate(booking._id, 'cancelled')}
                                                                        className="px-2 py-1 rounded bg-rose-500 hover:bg-rose-600 text-white font-black text-[9px] uppercase tracking-wider active:scale-95 transition-all"
                                                                    >
                                                                        Decline
                                                                    </button>
                                                                </>
                                                            )}
                                                            {['accepted', 'confirmed'].includes(String(booking.status || '').toLowerCase()) && (
                                                                <button
                                                                    onClick={() => handleStatusUpdate(booking._id, 'checked-in')}
                                                                    className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white font-black text-[9px] uppercase tracking-wider active:scale-95 transition-all"
                                                                >
                                                                    Mark Checked In
                                                                </button>
                                                            )}
                                                            {String(booking.status || '').toLowerCase() === 'checked-in' && (
                                                                <button
                                                                    onClick={() => handleStatusUpdate(booking._id, 'completed')}
                                                                    className="px-2.5 py-1 rounded bg-blue-500 hover:bg-blue-600 text-white font-black text-[9px] uppercase tracking-wider active:scale-95 transition-all"
                                                                >
                                                                    Complete Visit
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </AnimatePresence>
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile View Cards */}
                            <div className="md:hidden space-y-3">
                                <AnimatePresence mode="popLayout">
                                    {filteredBookings.map((booking) => (
                                        <motion.div
                                            layout
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            key={booking._id}
                                            className={`bg-white rounded-xl p-3 shadow-sm border border-slate-100`}
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white font-black text-xs uppercase shrink-0">
                                                        {getBookerName(booking).charAt(0) || '?'}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-black text-sm text-slate-900 leading-none">{getBookerName(booking)}</h3>
                                                        <p className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">#{booking.bookingId}</p>
                                                    </div>
                                                </div>
                                                <Badge className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                                                    String(booking.status || '').toLowerCase() === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                                    ['accepted', 'confirmed'].includes(String(booking.status || '').toLowerCase()) ? 'bg-emerald-100 text-emerald-700' :
                                                    String(booking.status || '').toLowerCase() === 'checked-in' ? 'bg-orange-100 text-orange-700' :
                                                    String(booking.status || '').toLowerCase() === 'completed' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-rose-100 text-rose-700'
                                                }`}>
                                                    {String(booking.status || '').toLowerCase() === 'pending' ? 'WAITING' : 
                                                     ['accepted', 'confirmed'].includes(String(booking.status || '').toLowerCase()) ? 'CONFIRMED' : 
                                                     booking.status}
                                                </Badge>
                                            </div>

                                            <div className="grid grid-cols-2 gap-1.5 p-2 bg-slate-50 rounded-lg mb-2.5">
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar className="w-3.5 h-3.5 text-blue-500" />
                                                    <span className="text-[11px] font-bold text-slate-700">
                                                        {new Date(booking.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                                                    <span className="text-[11px] font-bold text-slate-700">{booking.timeSlot}</span>
                                                </div>
                                                {booking.mealPreference && (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[11px] font-bold text-amber-700">{formatMealPreference(booking.mealPreference)}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-1.5">
                                                    <Users className="w-3.5 h-3.5 text-blue-500" />
                                                    <span className="text-[11px] font-bold text-slate-700">{booking.guests} Guests</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Phone className="w-3.5 h-3.5 text-blue-500" />
                                                    <span className="text-[11px] font-bold text-slate-700 truncate">{getBookerPhone(booking) || 'No phone'}</span>
                                                </div>
                                            </div>

                                            {booking.specialRequest && (
                                                <div className="flex items-start gap-1.5 p-2 bg-blue-50 text-blue-700 rounded-lg mb-2.5 text-[11px] font-medium border border-blue-100">
                                                    <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                                    <p>{booking.specialRequest}</p>
                                                </div>
                                            )}

                                            {booking.review?.rating && (
                                                <div className="flex flex-col gap-1 p-2 bg-yellow-50/50 text-slate-800 rounded-lg mb-2.5 text-[11px] border border-yellow-100">
                                                    <div className="flex items-center gap-1.5 font-bold text-yellow-800">
                                                        <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400 shrink-0" />
                                                        <span>{booking.review.rating} / 5 Rating</span>
                                                    </div>
                                                    {booking.review.comment && (
                                                        <p className="text-slate-600 italic" style={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>
                                                            "{booking.review.comment}"
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex gap-2">
                                                {String(booking.status || '').toLowerCase() === 'pending' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleStatusUpdate(booking._id, 'accepted')}
                                                            className="flex-1 py-2 bg-emerald-500 text-white rounded-lg text-xs font-black uppercase tracking-wider"
                                                        >
                                                            Accept
                                                        </button>
                                                        <button
                                                            onClick={() => handleStatusUpdate(booking._id, 'cancelled')}
                                                            className="flex-1 py-2 bg-rose-500 text-white rounded-lg text-xs font-black uppercase tracking-wider"
                                                        >
                                                            Decline
                                                        </button>
                                                    </>
                                                )}
                                                {['accepted', 'confirmed'].includes(String(booking.status || '').toLowerCase()) && (
                                                    <button
                                                        onClick={() => handleStatusUpdate(booking._id, 'checked-in')}
                                                        className="w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-black uppercase tracking-wider"
                                                    >
                                                        Mark Checked In
                                                    </button>
                                                )}
                                                {String(booking.status || '').toLowerCase() === 'checked-in' && (
                                                    <button
                                                        onClick={() => handleStatusUpdate(booking._id, 'completed')}
                                                        className="w-full py-2 bg-blue-500 text-white rounded-lg text-xs font-black uppercase tracking-wider"
                                                    >
                                                        Complete Visit
                                                    </button>
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </>
                    ) : (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-2xl p-8 text-center border border-slate-100 shadow-sm"
                        >
                            <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Calendar className="w-6 h-6 text-slate-350" />
                            </div>
                            <h3 className="text-base font-black text-slate-800">No reservations found</h3>
                            <p className="text-slate-500 mt-1 max-w-xs mx-auto text-xs">When guests book a table, they will appear here in your live queue.</p>
                        </motion.div>
                    )}
                </div>
            )}
        </div>
    </div>
    )
}
