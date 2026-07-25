const toArray = (value) => (Array.isArray(value) ? value : [])

export const normalizeFoodVariants = (value) =>
  toArray(value)
    .map((entry = {}, index) => {
      const id = String(entry?.id || entry?._id || `variant-${index}`)
      const name = String(entry?.name || "").trim()
      const price = Number(entry?.price)
      if (!name || !Number.isFinite(price) || price <= 0) return null

      return {
        id,
        _id: id,
        name,
        price,
      }
    })
    .filter(Boolean)

export const getFoodVariants = (item = {}) =>
  normalizeFoodVariants(item?.variants || item?.variations || [])

export const hasFoodVariants = (item = {}) => getFoodVariants(item).length > 0

export const getDefaultFoodVariant = (item = {}) => getFoodVariants(item)[0] || null

export const formatFoodPrice = (rawPrice) => {
  const price = Number(rawPrice)
  if (!Number.isFinite(price) || price <= 0) return 0
  if (price > 99999) return 99999
  return Math.round(price)
}

export const getFoodDisplayPrice = (item = {}) => {
  const variants = getFoodVariants(item)
  if (variants.length > 0) {
    return Math.min(...variants.map((variant) => formatFoodPrice(variant.price)))
  }

  return formatFoodPrice(item?.price)
}

export const getFoodPriceLabel = (item = {}) => {
  const price = getFoodDisplayPrice(item)
  return hasFoodVariants(item) ? `Starting from ₹${price}` : `₹${price}`
}

export const buildCartLineId = (itemId, variantId = "") =>
  `${String(itemId || "")}::${String(variantId || "base")}`
