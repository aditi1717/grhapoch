import { useCallback } from "react"
import { useLocation, useNavigate } from "react-router-dom"

const toFoodPath = (value) => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("/food/")) return trimmed
  if (trimmed === "/food") return trimmed
  if (trimmed.startsWith("/user/")) return `/food${trimmed}`
  if (trimmed === "/user") return "/food/user"
  return null
}

const getNormalizedUserPath = (pathname) => {
  if (pathname.startsWith("/food")) {
    return pathname.slice(5) || "/"
  }
  return pathname || "/"
}

const resolveBackPath = ({ pathname, search, state }) => {
  const normalizedPath = getNormalizedUserPath(pathname)
  const explicitBackPath = toFoodPath(state?.backTo) || toFoodPath(state?.from)
  if (explicitBackPath && explicitBackPath !== pathname) {
    return explicitBackPath
  }
  const searchParams = new URLSearchParams(search || "")

  if (
    normalizedPath === "/user/profile/payments/new" ||
    /^\/user\/profile\/payments\/[^/]+\/edit$/.test(normalizedPath)
  ) {
    return "/food/user/profile/payments"
  }

  if (
    /^\/user\/profile\/(edit|favorites|support|coupons|about|report-safety-emergency|accessibility|logout|refer-earn|payments)$/.test(
      normalizedPath,
    )
  ) {
    return "/food/user/profile"
  }

  if (
    /^\/user\/profile\/(terms|privacy|refund|shipping|cancellation)$/.test(
      normalizedPath,
    )
  ) {
    return explicitBackPath || "/food/user/profile"
  }

  if (normalizedPath === "/user/wallet") {
    return "/food/user/profile"
  }

  if (normalizedPath === "/user/notifications") {
    return explicitBackPath || "/food/user"
  }

  if (/^\/user\/restaurants\/[^/]+$/.test(normalizedPath)) {
    if (searchParams.get("under250") === "true") {
      return "/food/user/switch-99"
    }
    if (typeof window !== "undefined" && window.sessionStorage) {
      const lastUserPage = window.sessionStorage.getItem("lastUserPage")
      if (lastUserPage && lastUserPage !== pathname) {
        return lastUserPage
      }
    }
    return explicitBackPath || "/food/user"
  }

  if (normalizedPath === "/user/dining/book-confirmation") {
    return explicitBackPath || -1
  }

  if (/^\/user\/dining\/book\/[^/]+$/.test(normalizedPath)) {
    return explicitBackPath || -1
  }

  if (normalizedPath.startsWith("/user/dining")) {
    return explicitBackPath || "/food/user/dining"
  }

  if (normalizedPath === "/user/under-250" || normalizedPath === "/user/switch-99") {
    return "/food/user"
  }

  if (normalizedPath === "/user/orders") {
    if (explicitBackPath) return explicitBackPath;
    if (searchParams.has("rateOrderId")) return -1;
    if (typeof window !== "undefined" && window.history && window.history.length > 1) {
      return -1;
    }
    return "/food/user";
  }

  if (/^\/user\/orders\/[^/]+(\/invoice|\/details)?$/.test(normalizedPath)) {
    return "/food/user/orders"
  }

  if (normalizedPath === "/user/cart") {
    if (explicitBackPath === "/food/user/profile") {
      return "/food/user/profile"
    }
    return "/food/user"
  }

  if (
    normalizedPath === "/user/cart/select-address" ||
    normalizedPath === "/user/cart/address-selector"
  ) {
    return "/food/user/cart"
  }

  if (/^\/user\/collections\/[^/]+$/.test(normalizedPath)) {
    return "/food/user/collections"
  }

  if (normalizedPath === "/user/categories") {
    return "/food/user"
  }

  if (/^\/user\/category\/[^/]+$/.test(normalizedPath)) {
    return "/food/user/categories"
  }

  if (
    normalizedPath === "/user/offers" ||
    normalizedPath === "/user/gourmet" ||
    normalizedPath === "/user/coffee"
  ) {
    return "/food/user"
  }

  if (/^\/user\/product\/[^/]+$/.test(normalizedPath)) {
    return explicitBackPath || "/food/user"
  }

  if (/^\/user\/complaints(\/|$)/.test(normalizedPath)) {
    return explicitBackPath || "/food/user/orders"
  }

  if (explicitBackPath && explicitBackPath !== pathname) {
    return explicitBackPath
  }

  return "/food/user"
}

export default function useAppBackNavigation() {
  const navigate = useNavigate()
  const location = useLocation()

  return useCallback(() => {
    const target = resolveBackPath(location)
    if (target === -1) {
      navigate(-1)
    } else {
      navigate(target, { state: { isBack: true } })
    }
  }, [location, navigate])
}
