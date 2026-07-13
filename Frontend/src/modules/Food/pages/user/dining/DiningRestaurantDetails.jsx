import { useEffect, useState, useMemo, useCallback } from "react"
import { createPortal } from "react-dom"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { restaurantAPI, diningAPI } from "@food/api"
import { useProfile } from "@food/context/ProfileContext"
import { getMenuFromResponse } from "@food/utils/menuItems"
import { getRestaurantAvailabilityStatus } from "@food/utils/restaurantAvailability"
import useAppBackNavigation from "@food/hooks/useAppBackNavigation"
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  Clock3,
  IndianRupee,
  Loader2,
  MapPin,
  Percent,
  Share2,
  Tag,
  X,
  MessageCircle,
  Send,
  Mail,
  Copy,
  Utensils,
} from "lucide-react"
import { Button } from "@food/components/ui/button"
import { toast } from "sonner"

const formatAddress = (restaurant) =>
  restaurant?.location?.formattedAddress ||
  restaurant?.location?.addressLine1 ||
  restaurant?.location?.address ||
  [restaurant?.location?.area || restaurant?.area, restaurant?.location?.city || restaurant?.city]
    .filter(Boolean)
    .join(", ")

const normalizeImageEntry = (entry) => {
  if (!entry) return null
  if (typeof entry === "string") {
    const url = entry.replace(/[`'"]/g, "").trim()
    return url ? url : null
  }
  const url = String(entry?.url || "").replace(/[`'"]/g, "").trim()
  if (!url) return null
  return url
}

const buildImageList = (restaurant) => {
  const profileImageCandidates = [
    restaurant?.profileImage,
  ]
  const coverImageCandidates = [
    restaurant?.coverImage,
    ...(Array.isArray(restaurant?.coverImages) ? restaurant.coverImages : []),
  ]
  const allCandidates = [
    ...profileImageCandidates,
    ...coverImageCandidates,
  ]
  const normalized = allCandidates
    .map(normalizeImageEntry)
    .filter(Boolean)
  return [...new Set(normalized)]
}

const buildMenuImageList = (restaurant) => {
  const menuImageCandidates = Array.isArray(restaurant?.menuImages) 
    ? restaurant.menuImages 
    : []
  
  const normalized = menuImageCandidates
    .map(normalizeImageEntry)
    .filter(Boolean)
  return [...new Set(normalized)]
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

const buildFacilities = (restaurant) => {
  const facilities = []
  const mealPeriods = normalizeMealPeriods(
    restaurant?.diningSettings?.mealPeriods,
    []
  )

  if (mealPeriods.length > 0) {
    mealPeriods.forEach((period) => {
      if (period === "breakfast") facilities.push("Breakfast")
      if (period === "lunch") facilities.push("Lunch")
      if (period === "dinner") facilities.push("Dinner")
    })
  }

  const parseTimeToMinutes = (value) => {
    if (!value) return null
    const raw = String(value).trim()
    const hhmmMatch = raw.match(/^(\d{1,2}):(\d{2})$/)
    if (hhmmMatch) {
      return Number(hhmmMatch[1]) * 60 + Number(hhmmMatch[2])
    }
    const meridiemMatch = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i)
    if (!meridiemMatch) return null
    let hour = Number(meridiemMatch[1])
    const minute = Number(meridiemMatch[2] || 0)
    const meridiem = meridiemMatch[3].toUpperCase()
    if (meridiem === "PM" && hour !== 12) hour += 12
    if (meridiem === "AM" && hour === 12) hour = 0
    return hour * 60 + minute
  }

  const openingMinutes = parseTimeToMinutes(
    restaurant?.outletTimings?.openingTime ||
    restaurant?.diningSettings?.openingTime ||
    restaurant?.openingTime ||
    "12:00"
  )
  const closingMinutes = parseTimeToMinutes(
    restaurant?.outletTimings?.closingTime ||
    restaurant?.diningSettings?.closingTime ||
    restaurant?.closingTime ||
    "23:59"
  )

  if (facilities.length === 0 && openingMinutes !== null && closingMinutes !== null) {
    if (openingMinutes < 11 * 60) facilities.push("Breakfast")
    if (openingMinutes < 17 * 60 && closingMinutes > 11 * 60) facilities.push("Lunch")
    if (closingMinutes > 17 * 60 || closingMinutes <= openingMinutes) facilities.push("Dinner")
  } else if (facilities.length === 0) {
    facilities.push("Breakfast", "Lunch", "Dinner")
  }

  if (restaurant?.diningSettings?.homeDeliveryAvailable || restaurant?.homeDeliveryAvailable) facilities.push("Home delivery")
  if (restaurant?.diningSettings?.takeawayAvailable || restaurant?.takeawayAvailable) facilities.push("Takeaway available")
  if (restaurant?.diningSettings?.vegOnly || restaurant?.vegOnly) facilities.push("Vegetarian only")
  if (restaurant?.diningSettings?.lessNoisy || restaurant?.ambience === "quiet") facilities.push("Less noisy")

  return facilities.length > 0
    ? facilities
    : ["Breakfast", "Lunch", "Dinner", "Home delivery", "Takeaway available", "Vegetarian only", "Less noisy"]
}

const formatTimeLabel = (value) => {
  if (!value) return null
  if (/[ap]m/i.test(value)) return value.toUpperCase()
  const date = new Date(`2000-01-01T${String(value).padStart(5, "0")}`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
}

const scrollToSection = (id) => {
  const element = document.getElementById(id)
  if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "start" })
  }
}

export default function DiningRestaurantDetails() {
  const { category, slug } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const goBack = useAppBackNavigation()
  const { addFavorite, removeFavorite, isFavorite } = useProfile()

  const [restaurant, setRestaurant] = useState(location.state?.restaurant || null)
  const [menuSections, setMenuSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState("menu")
  const [occupiedSeats, setOccupiedSeats] = useState(0)
  const [isFetchingBookings, setIsFetchingBookings] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [sharePayload, setSharePayload] = useState(null)
  const [showAllPhotos, setShowAllPhotos] = useState(false)
  const [showAllMenuPhotos, setShowAllMenuPhotos] = useState(false)

  const [availabilityTick, setAvailabilityTick] = useState(Date.now())

  const fetchRestaurantData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const routeRestaurant = location.state?.restaurant || null
      const preferredRestaurantLookup =
        routeRestaurant?._id ||
        routeRestaurant?.restaurantId ||
        routeRestaurant?.id ||
        slug

      const restaurantResponse = await restaurantAPI.getRestaurantById(preferredRestaurantLookup)
      if (!restaurantResponse?.data?.success) {
        setError("Restaurant not found")
        setRestaurant(null)
        return
      }

      const resolvedRestaurant =
            restaurantResponse?.data?.data?.restaurant ||
            restaurantResponse?.data?.data ||
            null

      if (!resolvedRestaurant) {
        setError("Restaurant not found")
        setRestaurant(null)
        return
      }

      const restaurantId = resolvedRestaurant?._id || resolvedRestaurant?.id || slug
      const outletTimingsResponse = await restaurantAPI.getOutletTimingsByRestaurantId(restaurantId).catch(() => null)
      const outletTimings =
        outletTimingsResponse?.data?.data?.outletTimings ||
        outletTimingsResponse?.data?.outletTimings ||
        null

      setRestaurant(
        outletTimings
          ? { ...resolvedRestaurant, outletTimings }
          : resolvedRestaurant
      )

      // Fetch Occupied Seats for Availability Check
      setIsFetchingBookings(true)
      try {
        const availabilityRes = await diningAPI.getOccupiedSeatsPublic(restaurantId)
        if (availabilityRes.data.success) {
          setOccupiedSeats(Number(availabilityRes.data.data?.occupiedSeats) || 0)
        }
      } catch (err) {
        console.error("Error fetching availability:", err)
      } finally {
        setIsFetchingBookings(false)
      }

      const menuResponse = await restaurantAPI.getMenuByRestaurantId(restaurantId).catch(() => null)
      const resolvedMenu = menuResponse ? getMenuFromResponse(menuResponse) : null
      setMenuSections(Array.isArray(resolvedMenu?.sections) ? resolvedMenu.sections : [])
    } catch {
      setError("Failed to load restaurant")
      setRestaurant(null)
    } finally {
      setLoading(false)
    }
  }, [location.state?.restaurant, slug])

  useEffect(() => {
    fetchRestaurantData()
  }, [fetchRestaurantData])

  useEffect(() => {
    const interval = setInterval(() => {
      setAvailabilityTick(Date.now())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const maxCapacity = restaurant?.diningSettings?.maxGuests || 6
  const remainingSeats = Math.max(0, maxCapacity - occupiedSeats)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7fb]">
        <Loader2 className="h-8 w-8 animate-spin text-[#FFC107]" />
      </div>
    )
  }

  if (error || !restaurant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f6f7fb] px-4 text-center">
        <h2 className="text-2xl font-bold text-[#23180f]">Restaurant not found</h2>
        <Button onClick={goBack} variant="outline">
          Go Back
        </Button>
      </div>
    )
  }

  const restaurantName = restaurant.name || restaurant.restaurantName || "Restaurant"
  const address = formatAddress(restaurant) || "Address unavailable"
  const imageGallery = buildImageList(restaurant)
  const menuImageGallery = buildMenuImageList(restaurant)
  const heroImage = imageGallery[0] || ""
  const cuisines =
    Array.isArray(restaurant?.cuisines) && restaurant.cuisines.length > 0
      ? restaurant.cuisines.join(", ")
      : ""
  const costForTwo =
    restaurant?.costForTwo
      ? `${"\u20B9"}${restaurant.costForTwo} for two`
      : restaurant?.featuredPrice
        ? `${"\u20B9"}${Math.round(Number(restaurant.featuredPrice) || 0)} for two`
        : restaurant?.priceRange || ""
  const hasPriceInfo = Boolean(costForTwo)
  const hasCuisineInfo = Boolean(cuisines)
  const facilities = buildFacilities(restaurant)
  const rating = Number(restaurant?.rating || restaurant?.avgRating || 0).toFixed(1)
  const reviewCount = restaurant?.totalRatings || restaurant?.reviewCount || restaurant?.reviewsCount || 0
  const isDiningEnabled = restaurant?.diningSettings?.isEnabled !== false
  const availability = getRestaurantAvailabilityStatus(restaurant, new Date(availabilityTick))
  const canBookTable = isDiningEnabled && availability.isOpen
  const offlineImageClass = !availability.isOpen ? "grayscale opacity-80" : ""
  const menuCountLabel = `${imageGallery.length} image${imageGallery.length === 1 ? "" : "s"}`

  const openingTime = formatTimeLabel(
    availability.openingTime ||
    restaurant?.diningSettings?.openingTime ||
    restaurant?.openingTime ||
    "12:00"
  )
  const closingTime = formatTimeLabel(
    availability.closingTime ||
    restaurant?.diningSettings?.closingTime ||
    restaurant?.closingTime ||
    "23:59"
  )
  const topTabs = [
    { id: "menu", label: "Menu", target: "restaurant-menu" },
    { id: "about", label: "About", target: "restaurant-about" },
  ]

  const tryNativeShare = async (payload) => {
    if (typeof navigator === "undefined" || !navigator.share) return false
    try {
      await navigator.share(payload)
      return true
    } catch (error) {
      if (error?.name === "AbortError") return true
      return false
    }
  }

  const isMobileDevice = () => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false
    const mobileUA = /Android|iPhone|iPad|iPod|Windows Phone|Opera Mini|IEMobile/i.test(navigator.userAgent)
    const smallViewport = window.matchMedia?.("(max-width: 768px)")?.matches
    return Boolean(mobileUA || smallViewport)
  }

  const openShareModal = (payload) => {
    setSharePayload(payload)
    setShowShareModal(true)
  }

  const openShareTarget = (target) => {
    if (!sharePayload?.url) return

    const text = sharePayload.text || ""
    const url = sharePayload.url
    const encodedText = encodeURIComponent(text)
    const encodedUrl = encodeURIComponent(url)

    let shareLink = ""

    if (target === "whatsapp") {
      shareLink = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`
    } else if (target === "telegram") {
      shareLink = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`
    } else if (target === "email") {
      shareLink = `mailto:?subject=${encodeURIComponent(sharePayload.title || "Check this out")}&body=${encodeURIComponent(`${text}\n\n${url}`)}`
    }

    if (shareLink) {
      window.open(shareLink, "_blank", "noopener,noreferrer")
      setShowShareModal(false)
    }
  }

  const copyShareLink = async () => {
    if (!sharePayload?.url) return
    try {
      await navigator.clipboard.writeText(sharePayload.url)
      toast.success("Link copied to clipboard!")
    } catch (error) {
      toast.error("Failed to copy link")
    }
    setShowShareModal(false)
  }

  const handleSystemShareFromModal = async () => {
    if (!sharePayload) return
    const shared = await tryNativeShare(sharePayload)
    if (shared) {
      setShowShareModal(false)
      toast.success("Shared successfully")
    }
  }

  const handleShare = async () => {
    const shareUrl = window.location.href
    const shareText = `Check out ${restaurantName} on Switcheats!`

    const payload = {
      title: restaurantName,
      text: shareText,
      url: shareUrl,
    }

    try {
      if (isMobileDevice()) {
        openShareModal(payload)
        return
      }

      const shared = await tryNativeShare(payload)
      if (shared) {
        toast.success("Shared successfully")
        return
      }

      openShareModal(payload)
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast.error("Failed to share")
      }
    }
  }

  const restaurantFavoriteSlug =
    restaurant?.restaurantNameNormalized ||
    restaurant?.slug ||
    slug

  const favorite = isFavorite(restaurantFavoriteSlug)

  const handleBack = () => {
    if (window.history.length > 1) {
      goBack()
      return
    }

    if (category) {
      navigate(`/food/user/dining/${category}`)
      return
    }

    navigate("/food/user/dining")
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb] dark:bg-slate-950 pb-20 transition-colors">
      <section className="mx-auto max-w-md bg-[#f6f7fb] dark:bg-slate-950 uppercase-fix">
        <div className="relative h-[280px] overflow-hidden">
          {heroImage ? (
            <img
              src={heroImage}
              alt={restaurantName}
              className={`h-full w-full object-cover transition-all ${offlineImageClass}`}
            />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(circle_at_top,#eadcc7,#a09279_58%,#655749)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/0" />

          <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-2 pt-2">
            <button
              onClick={handleBack}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#51586a]/75 text-white backdrop-blur-md transition-all active:scale-90"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <button
              onClick={handleShare}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#51586a]/75 text-white backdrop-blur-md transition-all active:scale-90"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>

          <div className="absolute inset-x-0 bottom-0 px-2 pb-3 text-white">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-black leading-none tracking-[-0.03em]">{restaurantName}</h1>
                <p className="mt-1 max-w-[94%] text-xs leading-4 text-white/90">{address}</p>
                {(costForTwo || cuisines) && (
                  <p className="mt-1 text-xs text-white/90">
                     {costForTwo}
                     {costForTwo && cuisines && <span className="mx-1 text-white/65">•</span>}
                     {cuisines}
                  </p>
                )}
                <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-black/25 px-2 py-0.5 text-xs font-medium backdrop-blur-sm">
                  <CheckCircle2 className="h-3 w-3 text-[#48d597]" />
                  <span>{availability.isOpen ? "Open now" : "Closed now"}</span>
                  <span className="text-white/70">|</span>
                  <span>{openingTime} to {closingTime}</span>
                </div>
              </div>

              <div className="mb-0.5 shrink-0 rounded-2xl bg-white dark:bg-slate-800 px-2.5 py-1.5 text-center text-[#1f2328] dark:text-slate-100 shadow-xl border border-white/20">
                <div className="flex items-center justify-center gap-0.5 text-2xl font-black leading-none">
                  <span>{rating}</span>
                  <span className="text-sm text-[#18b54f]">★</span>
                </div>
                <p className="mt-0.5 text-[11px] leading-3 text-[#6e7481] dark:text-slate-400">{reviewCount} Reviews</p>
              </div>
            </div>
          </div>
        </div>

        {!canBookTable && (
          <div className="px-2 pb-0 pt-2">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {isDiningEnabled
                ? "Restaurant is currently closed for this time/day."
                : "Dining bookings are currently turned off by the restaurant."}
            </div>
          </div>
        )}
      </section>

      <div className="sticky top-0 z-30 border-b border-[#ececf3] dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl transition-colors">
        <div className="mx-auto max-w-md px-2 pb-2 pt-2">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {topTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  scrollToSection(tab.target)
                }}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors ${activeTab === tab.id
                    ? "border-[#FFC107] bg-white dark:bg-slate-900 text-[#2a2018] dark:text-slate-100"
                    : "border-[#ece9e1] dark:border-slate-800 bg-[#fafafa] dark:bg-slate-900 text-[#8b8881] dark:text-slate-400"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md px-2 pt-3">
        <section id="restaurant-menu" className="border-t border-[#e8e8ef] dark:border-slate-800 pt-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black leading-none text-[#23180f] dark:text-slate-100">Restaurant Gallery</h2>
            </div>
            <div className="rounded-full bg-[#fff3e6] dark:bg-orange-950/30 px-2.5 py-0.5 text-[11px] font-semibold text-[#e58a2c] dark:text-orange-300">
              {menuCountLabel}
            </div>
          </div>

          {imageGallery.length > 0 ? (
            <>
              {!showAllPhotos ? (
                <div className="mt-3">
                  {imageGallery.length === 1 ? (
                    <div className="h-44 overflow-hidden rounded-xl bg-[#f6efe4] dark:bg-slate-800">
                      <img
                        src={imageGallery[0]}
                        alt={`${restaurantName} photo 1`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="h-44 overflow-hidden rounded-xl bg-[#f6efe4] dark:bg-slate-800">
                        <img
                          src={imageGallery[0]}
                          alt={`${restaurantName} photo 1`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <button
                        onClick={() => setShowAllPhotos(true)}
                        className="mt-2 w-full text-center text-xs font-semibold text-[#e58a2c] hover:underline"
                      >
                        Show all {imageGallery.length} photos
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="mt-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    {imageGallery.map((src, index) => (
                      <div key={index} className="h-40 overflow-hidden rounded-xl bg-[#f6efe4] dark:bg-slate-800">
                        <img
                          src={src}
                          alt={`${restaurantName} photo ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowAllPhotos(false)}
                    className="mt-2 w-full text-center text-xs font-semibold text-[#e58a2c] hover:underline"
                  >
                    Show less
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="mt-3 rounded-2xl border border-dashed border-[#e5e7ef] bg-white/80 dark:bg-slate-900 px-3 py-4 text-center text-xs text-[#7c8394] dark:text-slate-400">
              No restaurant images available yet.
            </div>
          )}
        </section>

        {/* Menu Gallery Section */}
        <section id="menu-gallery" className="mt-4 border-t border-[#e8e8ef] dark:border-slate-800 pt-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black leading-none text-[#23180f] dark:text-slate-100">Menu Gallery</h2>
            </div>
          </div>

          {menuImageGallery.length > 0 ? (
            <>
              {!showAllMenuPhotos ? (
                <div className="mt-3">
                  {menuImageGallery.length === 1 ? (
                    <div className="h-44 overflow-hidden rounded-xl bg-[#f6efe4] dark:bg-slate-800">
                      <img
                        src={menuImageGallery[0]}
                        alt={`${restaurantName} menu 1`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="h-44 overflow-hidden rounded-xl bg-[#f6efe4] dark:bg-slate-800">
                        <img
                          src={menuImageGallery[0]}
                          alt={`${restaurantName} menu 1`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <button
                        onClick={() => setShowAllMenuPhotos(true)}
                        className="mt-2 w-full text-center text-xs font-semibold text-[#e58a2c] hover:underline"
                      >
                        Show all {menuImageGallery.length} menu photos
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="mt-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    {menuImageGallery.map((src, index) => (
                      <div key={index} className="h-40 overflow-hidden rounded-xl bg-[#f6efe4] dark:bg-slate-800">
                        <img
                          src={src}
                          alt={`${restaurantName} menu ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowAllMenuPhotos(false)}
                    className="mt-2 w-full text-center text-xs font-semibold text-[#e58a2c] hover:underline"
                  >
                    Show less
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="mt-3 rounded-2xl border border-dashed border-[#e5e7ef] bg-white/80 dark:bg-slate-900 px-3 py-4 text-center text-xs text-[#7c8394] dark:text-slate-400">
              No menu photos available yet.
            </div>
          )}
        </section>

        <section id="restaurant-about" className="mt-4 border-t border-[#e8e8ef] dark:border-slate-800 pt-3">
          <h2 className="text-xl font-black leading-none text-[#23180f] dark:text-slate-100">About the restaurant</h2>
          <div className="mt-3 rounded-2xl border border-[#ececf4] dark:border-slate-800 bg-[#fafbff] dark:bg-slate-900 p-3 transition-colors">
            <div className="space-y-2.5 text-sm text-[#5f6474] dark:text-slate-400">
              {hasPriceInfo ? (
                <div className="flex items-start gap-2.5">
                  <IndianRupee className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#f0b500]" />
                  <p>{costForTwo}</p>
                </div>
              ) : (
                <div className="flex items-start gap-2.5">
                  <IndianRupee className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#f0b500]" />
                  <p className="text-[#8b92a5]">Price not available</p>
                </div>
              )}

              {hasCuisineInfo && (
                <div className="flex items-start gap-2.5">
                  <div className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#8a8f9d]" />
                  <p>{cuisines}</p>
                </div>
              )}

              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FFC107]" />
                <p>{address}</p>
              </div>
            </div>

            <div className="mt-4 border-t border-[#e8e8ef] dark:border-slate-800 pt-3">
              <h3 className="text-lg font-semibold text-[#23180f] dark:text-slate-100">Facilities</h3>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                {facilities.slice(0, 6).map((facility) => (
                  <div key={facility} className="flex items-center gap-2 text-sm text-[#5f6474] dark:text-slate-400">
                    <span className="inline-block h-[5px] w-[5px] rounded-full border border-[#8a8f9d]" />
                    <span>{facility}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#ebe5da] dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 p-3 backdrop-blur-xl transition-colors">
        <div className="mx-auto max-w-md">
          <Button
            onClick={() => {
              if (canBookTable) {
                navigate(`/food/user/dining/book/${slug}`, {
                  state: { 
                    restaurant,
                    backTo: location.pathname 
                  }
                });
              }
            }}
            disabled={!canBookTable}
            className={`h-11 w-full rounded-xl border text-sm font-medium transition-all ${canBookTable
                ? "border-[#b18da5] bg-white dark:bg-slate-900 text-[#FFC107] dark:text-purple-400 hover:bg-[#fdfafc] dark:hover:bg-slate-800"
                : "cursor-not-allowed border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 text-gray-400 dark:text-slate-600 opacity-80"
              }`}
          >
            {canBookTable ? "Book a table" : "Dining paused"}
          </Button>
        </div>
      </div>

      {/* Share Modal */}
      {typeof window !== "undefined" &&
        createPortal(
          showShareModal && sharePayload && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm px-4 pb-4 pt-10 sm:items-center">
              <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#121212] shadow-2xl overflow-hidden border dark:border-gray-800">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-4 py-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Share restaurant</h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Choose an app to share this restaurant</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowShareModal(false)}
                    className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                    aria-label="Close share modal"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="px-4 py-4 space-y-2.5 font-sans">
                  {typeof navigator !== "undefined" && navigator.share && (
                    <button
                      type="button"
                      onClick={handleSystemShareFromModal}
                      className="w-full rounded-xl bg-[#FFC107] px-3 py-2.5 text-xs font-semibold text-slate-900 flex items-center justify-center gap-1.5 hover:bg-[#E6AC00] transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Share via apps
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => openShareTarget("whatsapp")}
                      className="rounded-xl border border-gray-200 dark:border-gray-800 px-2.5 py-3 text-[11px] font-medium text-gray-700 dark:text-gray-200 flex flex-col items-center gap-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <MessageCircle className="w-4.5 h-4.5 text-green-600" />
                      WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => openShareTarget("telegram")}
                      className="rounded-xl border border-gray-200 dark:border-gray-800 px-2.5 py-3 text-[11px] font-medium text-gray-700 dark:text-gray-200 flex flex-col items-center gap-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <Send className="w-4.5 h-4.5 text-sky-500" />
                      Telegram
                    </button>
                    <button
                      type="button"
                      onClick={() => openShareTarget("email")}
                      className="rounded-xl border border-gray-200 dark:border-gray-800 px-2.5 py-3 text-[11px] font-medium text-gray-700 dark:text-gray-200 flex flex-col items-center gap-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <Mail className="w-4.5 h-4.5 text-rose-500" />
                      Email
                    </button>
                    <button
                      type="button"
                      onClick={copyShareLink}
                      className="rounded-xl border border-gray-200 dark:border-gray-800 px-2.5 py-3 text-[11px] font-medium text-gray-700 dark:text-gray-200 flex flex-col items-center gap-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <Copy className="w-4.5 h-4.5 text-gray-600 dark:text-gray-400" />
                      Copy link
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ),
          document.body
        )}
    </div>
  )
}
