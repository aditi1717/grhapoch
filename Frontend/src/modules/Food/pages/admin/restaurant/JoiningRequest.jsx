import { useState, useMemo, useEffect, useRef } from "react"
import { 
  Search, Filter, Eye, Check, X, UtensilsCrossed, ArrowUpDown, Loader2,
  FileText, Image as ImageIcon, ExternalLink, CreditCard, Calendar, Star, Building2, User, Phone, Mail, MapPin, Clock
} from "lucide-react"
import { adminAPI, restaurantAPI } from "@food/api"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const formatTime12Hour = (timeStr) => {
  if (!timeStr || typeof timeStr !== "string" || !timeStr.includes(":")) return "--:-- --"
  const [h, m] = timeStr.split(":").map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return timeStr
  const period = h >= 12 ? "PM" : "AM"
  const hour = h % 12 || 12
  return `${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`
}


export default function JoiningRequest() {
  const [activeTab, setActiveTab] = useState("pending")
  const [searchQuery, setSearchQuery] = useState("")
  const [pendingRequests, setPendingRequests] = useState([])
  const [rejectedRequests, setRejectedRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [restaurantDetails, setRestaurantDetails] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [showFilterDialog, setShowFilterDialog] = useState(false)
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: ""
  })

  // Track first render to avoid duplicate fetch in React StrictMode
  const hasFetchedOnceRef = useRef(false)

  // Fetch restaurant join requests
  useEffect(() => {
    // On first render, fetch once for initial tab (usually "pending")
    if (!hasFetchedOnceRef.current) {
      hasFetchedOnceRef.current = true
      fetchRequests()
      return
    }

    // On subsequent tab changes, refetch only when switching away from "pending"
    if (activeTab !== "pending") {
      fetchRequests()
    }
  }, [activeTab])

  const fetchRequests = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await adminAPI.getPendingRestaurants()
      const list = response?.data?.data || []
      if (activeTab === "pending") {
        setPendingRequests(
          list.filter(
            (r) =>
              r.status === "pending" ||
              r.locationUpdateStatus === "pending" ||
              (Array.isArray(r.profileUpdateFields) && r.profileUpdateFields.length > 0)
          )
        )
      } else {
        setRejectedRequests(list.filter((r) => r.status === "rejected"))
      }
    } catch (err) {
      debugError("Error fetching restaurant requests:", err)
      setError(err.message || "Failed to fetch restaurant requests")
      if (activeTab === "pending") {
        setPendingRequests([])
      } else {
        setRejectedRequests([])
      }
    } finally {
      setLoading(false)
    }
  }

  const currentRequests = activeTab === "pending" ? pendingRequests : rejectedRequests

  const filterOptions = useMemo(() => {
    return { zones: [] }
  }, [])

  const filteredRequests = useMemo(() => {
    let filtered = currentRequests

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(request =>
        request.restaurantName?.toLowerCase().includes(query) ||
        request.ownerName?.toLowerCase().includes(query) ||
        request.ownerPhone?.includes(query)
      )
    }



    // Apply date range filter
    if (filters.dateFrom || filters.dateTo) {
      filtered = filtered.filter(request => {
        if (!request.createdAt) return false
        const requestDate = new Date(request.createdAt).setHours(0, 0, 0, 0)
        if (filters.dateFrom) {
          const fromDate = new Date(filters.dateFrom).setHours(0, 0, 0, 0)
          if (requestDate < fromDate) return false
        }
        if (filters.dateTo) {
          const toDate = new Date(filters.dateTo).setHours(23, 59, 59, 999)
          if (requestDate > toDate) return false
        }
        return true
      })
    }

    return filtered
  }, [currentRequests, searchQuery, filters])

  const clearFilters = () => {
    setFilters({
      zone: "",
      dateFrom: "",
      dateTo: ""
    })
  }

  const hasActiveFilters = filters.dateFrom || filters.dateTo

  const handleApprove = async (request) => {
    if (window.confirm(`Are you sure you want to approve "${request.restaurantName}" restaurant request?`)) {
      try {
        setProcessing(true)
        await adminAPI.approveRestaurant(request._id)
        
        // Refresh the list
        await fetchRequests()
        
        alert(`Successfully approved ${request.restaurantName}'s join request!`)
      } catch (err) {
        debugError("Error approving request:", err)
        alert(err.response?.data?.message || "Failed to approve request. Please try again.")
      } finally {
        setProcessing(false)
      }
    }
  }

  const handleReject = (request) => {
    setSelectedRequest(request)
    setRejectionReason("")
    setShowRejectDialog(true)
  }

  const confirmReject = async () => {
    if (!selectedRequest || !rejectionReason.trim()) {
      alert("Please provide a rejection reason")
      return
    }

    try {
      setProcessing(true)
      await adminAPI.rejectRestaurant(selectedRequest._id, rejectionReason)
      
      // Refresh the list
      await fetchRequests()
      
      setShowRejectDialog(false)
      setSelectedRequest(null)
      setRejectionReason("")
      
      alert(`Successfully rejected ${selectedRequest.restaurantName}'s join request!`)
    } catch (err) {
      debugError("Error rejecting request:", err)
      alert(err.response?.data?.message || "Failed to reject request. Please try again.")
    } finally {
      setProcessing(false)
    }
  }

  const formatPhone = (phone) => {
    if (!phone) return "N/A"
    return phone
  }

  // Handle view restaurant details
  const handleViewDetails = async (request) => {
    setSelectedRequest(request)
    setShowDetailsModal(true)
    setLoadingDetails(true)
    setRestaurantDetails(null)
    
    try {
      // First, use fullData if available (has all details from API)
      if (request.fullData) {
        debugLog("Using fullData from request:", request.fullData)
        setRestaurantDetails(request.fullData)
        setLoadingDetails(false)
        return
      }
      
      // Try to fetch full restaurant details from API
      const restaurantId = request._id || request.id
      let response = null
      
      if (restaurantId) {
        try {
          // Try admin API first
          if (adminAPI.getRestaurantById) {
            response = await adminAPI.getRestaurantById(restaurantId)
          }
        } catch (err) {
          debugLog("Admin API failed, trying restaurant API:", err)
        }
        
        // Fallback to regular restaurant API
        if (!response || !response?.data?.success) {
          try {
            response = await restaurantAPI.getRestaurantById(restaurantId)
          } catch (err) {
            debugLog("Restaurant API also failed:", err)
          }
        }
      }
      
      // Check response structure
      if (response?.data?.success) {
        const data = response.data.data
        if (data?.restaurant) {
          setRestaurantDetails(data.restaurant)
        } else if (data) {
          setRestaurantDetails(data)
        } else {
          setRestaurantDetails(request)
        }
      } else {
        // Use the request data we already have
        setRestaurantDetails(request)
      }
    } catch (err) {
      debugError("Error fetching restaurant details:", err)
      // Use the request data we already have
      setRestaurantDetails(request)
    } finally {
      setLoadingDetails(false)
    }
  }

  const closeDetailsModal = () => {
    setShowDetailsModal(false)
    setSelectedRequest(null)
    setRestaurantDetails(null)
  }

  const getNormalizedImageUrl = (image) => {
    if (!image) return ""
    if (typeof image === "string") return image
    return image?.url || ""
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">New Restaurant Join Request</h1>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 mb-6">
            <button
              onClick={() => setActiveTab("pending")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "pending"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              Pending Requests
            </button>
            <button
              onClick={() => setActiveTab("rejected")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "rejected"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              Rejected Request
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-initial min-w-[250px]">
                <input
                  type="text"
                  placeholder="Search by restaurant name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowFilterDialog(true)}
                className={`px-4 py-2.5 text-sm font-medium rounded-lg border transition-all flex items-center gap-2 ${
                  hasActiveFilters 
                    ? "border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100" 
                    : "border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
                }`}
              >
                <Filter className="w-4 h-4" />
                Filter
                {hasActiveFilters && (
                  <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                    {[filters.dateFrom, filters.dateTo].filter(Boolean).length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <span>SL</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <span>Restaurant Info</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <span>Owner Info</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <span>Service Radius</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <span>Status</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                      <p className="text-lg font-semibold text-slate-700">Loading restaurant requests...</p>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <p className="text-lg font-semibold text-red-600 mb-1">Error: {error}</p>
                      <p className="text-sm text-slate-500">Failed to load restaurant requests. Please try again.</p>
                    </td>
                  </tr>
                ) : filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <p className="text-lg font-semibold text-slate-700 mb-1">No Data Found</p>
                        <p className="text-sm text-slate-500">No restaurant requests match your search</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((request, index) => (
                    <tr key={request._id || index} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700">{request.sl ?? index + 1}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center shrink-0 cursor-pointer hover:opacity-80 transition-all"
                            onClick={() => handleViewDetails(request)}
                          >
                            <img
                              src={
                                getNormalizedImageUrl(request?.coverImages?.[0]) ||
                                (typeof request.profileImage === "string"
                                  ? request.profileImage
                                  : (request.profileImage?.url || request.profileImageUrl?.url || request.restaurantImage)) ||
                                "https://via.placeholder.com/40?text=" + (request.restaurantName?.slice(0, 2) || "R").toUpperCase()
                              }
                              alt={request.restaurantName || "Restaurant"}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.src = "https://via.placeholder.com/40?text=" + (request.restaurantName?.slice(0, 2) || "R").toUpperCase()
                              }}
                            />
                          </div>
                          <span 
                            className="text-sm font-medium text-slate-900 cursor-pointer hover:text-blue-600 transition-colors"
                            onClick={() => handleViewDetails(request)}
                          >
                            {request.restaurantName}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-900">{request.ownerName}</span>
                          <span className="text-xs text-slate-500">{formatPhone(request.ownerPhone)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{request.serviceRadius ? `${request.serviceRadius} KM` : ""}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold w-fit ${
                            request.locationUpdateStatus === "pending"
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : (Array.isArray(request.profileUpdateFields) && request.profileUpdateFields.length > 0) || (request.approvedAt != null && (request.status === "Pending" || request.status === "pending"))
                              ? "bg-purple-100 text-purple-800 border border-purple-300"
                              : request.status === "Pending" || request.status === "pending"
                              ? "bg-blue-100 text-blue-700 border border-blue-200"
                              : "bg-red-100 text-red-700"
                          }`}>
                            {request.locationUpdateStatus === "pending"
                              ? "Location Change Request"
                              : (Array.isArray(request.profileUpdateFields) && request.profileUpdateFields.length > 0) || (request.approvedAt != null && (request.status === "Pending" || request.status === "pending"))
                              ? "Name & Profile Edit"
                              : (request.status || "Pending")}
                          </span>
                          {request.locationUpdateStatus === "pending" && (
                            <span className="text-[10px] text-amber-700 font-semibold pl-1">
                              Address Update Pending
                            </span>
                          )}
                          {((Array.isArray(request.profileUpdateFields) && request.profileUpdateFields.length > 0) || (request.approvedAt != null && (request.status === "Pending" || request.status === "pending"))) && (
                            <span className="text-[10px] text-purple-700 font-semibold pl-1">
                              Profile Edit Pending
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleViewDetails(request)}
                            className="p-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {activeTab === "pending" && (
                            <>
                              <button
                                onClick={() => handleApprove(request)}
                                disabled={processing}
                                className="p-1.5 rounded-full bg-green-50 text-green-600 hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleReject(request)}
                                disabled={processing}
                                className="p-1.5 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Filter Dialog */}
      {showFilterDialog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowFilterDialog(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Filter className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Filter Requests</h3>
                    <p className="text-xs text-slate-500">Apply filters to refine your search</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowFilterDialog(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              <div className="space-y-4">


                {/* Date Range Filters */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      From Date
                    </label>
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      To Date
                    </label>
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                      min={filters.dateFrom}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-200">
                <button
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setShowFilterDialog(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Confirmation Dialog */}
      {showRejectDialog && selectedRequest && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowRejectDialog(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <X className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Reject Restaurant Request</h3>
                  <p className="text-sm text-slate-600">{selectedRequest.restaurantName}</p>
                </div>
              </div>
              
              <p className="text-sm text-slate-700 mb-4">
                Are you sure you want to reject this restaurant request? Please provide a reason for rejection.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  className="w-full px-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                  rows={4}
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowRejectDialog(false)
                    setSelectedRequest(null)
                    setRejectionReason("")
                  }}
                  disabled={processing}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmReject}
                  disabled={processing || !rejectionReason.trim()}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Rejecting...
                    </span>
                  ) : (
                    "Reject Request"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Restaurant Details Side Panel */}
      {showDetailsModal && selectedRequest && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-sm transition-opacity" onClick={closeDetailsModal} />
          
          <div 
            className="relative w-full max-w-4xl bg-white h-full shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Panel Header */}
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-5 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <UtensilsCrossed className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Restaurant Details - {selectedRequest.restaurantName || "N/A"}</h2>
              </div>
              <button
                onClick={closeDetailsModal}
                className="p-2 rounded-xl hover:bg-slate-100 transition-all text-slate-400 hover:text-slate-600 border border-transparent hover:border-slate-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {loadingDetails && (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  <span className="ml-3 text-slate-600">Loading details...</span>
                </div>
              )}
              {!loadingDetails && (restaurantDetails || selectedRequest) && (() => {
                const r = restaurantDetails || selectedRequest
                const restaurantPhotoList = Array.isArray(r?.coverImages) ? r.coverImages.filter(Boolean) : []
                const profileImgUrl =
                  getNormalizedImageUrl(restaurantPhotoList[0]) ||
                  (typeof r?.profileImage === "string" ? r.profileImage : (r?.profileImage?.url || r?.profileImageUrl?.url || r?.restaurantImage))
                const addressParts = [
                  r?.addressLine1,
                  r?.addressLine2,
                  r?.area,
                  r?.city,
                  r?.landmark,
                  r?.location?.addressLine1,
                  r?.location?.addressLine2,
                  r?.location?.area,
                  r?.location?.city,
                  r?.onboarding?.step1?.location?.addressLine1,
                  r?.onboarding?.step1?.location?.area,
                  r?.onboarding?.step1?.location?.city
                ].filter(Boolean)
                const hasAddress = addressParts.length > 0 || r?.location || r?.onboarding?.step1?.location
                const openingTime = r?.openingTime || r?.deliveryTimings?.openingTime || r?.onboarding?.step2?.deliveryTimings?.openingTime
                const closingTime = r?.closingTime || r?.deliveryTimings?.closingTime || r?.onboarding?.step2?.deliveryTimings?.closingTime
                const approvalStatus = r?.status || (r?.isActive !== false ? "approved" : "pending")
                const hasFlatDocs = r?.panNumber || r?.panImage || r?.fssaiNumber || r?.accountNumber
                const menuImgList = Array.isArray(r?.menuImages) ? r.menuImages : (r?.onboarding?.step2?.menuImageUrls || [])
                return (
                <div className="space-y-6">
                  {/* Restaurant Basic Info */}
                  <div className="flex items-start gap-6 pb-6 border-b border-slate-200">
                    <div className="w-24 h-24 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                      <img
                        src={profileImgUrl || "https://via.placeholder.com/96"}
                        alt={r?.restaurantName || r?.name || "Restaurant"}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = "https://via.placeholder.com/96"
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-slate-900 mb-2">
                        {r?.restaurantName || r?.name || "N/A"}
                      </h3>
                      <div className="flex items-center gap-4 flex-wrap">
                        {r?.rating != null && (
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-sm font-medium text-slate-700">
                              {Number(r.rating).toFixed(1)} ({(r.totalRatings || 0)} reviews)
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-slate-600">
                          <Building2 className="w-4 h-4" />
                          <span className="text-sm">{r?.restaurantId || r?._id || "N/A"}</span>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          r?.locationUpdateStatus === "pending"
                            ? "bg-amber-100 text-amber-800 border border-amber-300 font-bold"
                            : approvalStatus === "approved"
                            ? "bg-green-100 text-green-700"
                            : approvalStatus === "rejected"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}>
                          {r?.locationUpdateStatus === "pending"
                            ? "Location Change Request Pending"
                            : approvalStatus === "approved"
                            ? "Approved"
                            : approvalStatus === "rejected"
                            ? "Rejected"
                            : "Pending Approval"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Requested Changes / Approval Reason Banner Section */}
                  {(() => {
                    const isLocationChange = r?.locationUpdateStatus === "pending" || Boolean(r?.pendingLocation)
                    const isProfileUpdate = (Array.isArray(r?.profileUpdateFields) && r.profileUpdateFields.length > 0) || (Boolean(r?.approvedAt) && (r?.status === "pending" || r?.status === "Pending"))

                    const oldLoc = r?.location || {}
                    const newLoc = r?.pendingLocation || {}
                    const oldAddr = [
                      r?.addressLine1 || oldLoc?.addressLine1,
                      r?.addressLine2 || oldLoc?.addressLine2,
                      r?.area || oldLoc?.area,
                      r?.city || oldLoc?.city,
                      r?.state || oldLoc?.state,
                      r?.pincode || oldLoc?.pincode,
                    ].filter(Boolean).join(", ") || oldLoc?.formattedAddress || oldLoc?.address || "Current live address"

                    const newAddr = [
                      newLoc?.addressLine1,
                      newLoc?.addressLine2,
                      newLoc?.area,
                      newLoc?.city,
                      newLoc?.state,
                      newLoc?.pincode,
                    ].filter(Boolean).join(", ") || newLoc?.formattedAddress || newLoc?.address || "New requested address"

                    const oldCoords = oldLoc?.latitude != null ? `${oldLoc.latitude}, ${oldLoc.longitude}` : (oldLoc?.coordinates ? `${oldLoc.coordinates[1]}, ${oldLoc.coordinates[0]}` : "N/A")
                    const newCoords = newLoc?.latitude != null ? `${newLoc.latitude}, ${newLoc.longitude}` : (newLoc?.coordinates ? `${newLoc.coordinates[1]}, ${newLoc.coordinates[0]}` : "N/A")

                    if (isLocationChange) {
                      return (
                        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 space-y-4">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shrink-0">
                                <MapPin className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="text-base font-bold text-amber-950">
                                  Reason For Approval Request: Address & Location Update
                                </h4>
                                <p className="text-xs text-amber-800 font-medium">
                                  The restaurant owner submitted a change request to update their store location. Current address remains active for users until approved by Admin.
                                  {r?.locationUpdateRequestedAt ? ` (Submitted on ${new Date(r.locationUpdateRequestedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })})` : ''}
                                </p>
                              </div>
                            </div>
                            <span className="px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded-full uppercase tracking-wider shrink-0">
                              Location Change Request
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                            {/* Old / Current Location */}
                            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Current (Live) Address</span>
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded">Live</span>
                              </div>
                              <p className="text-sm font-semibold text-slate-800 leading-snug">
                                {oldAddr}
                              </p>
                              <div className="pt-1 text-xs text-slate-500">
                                <span className="font-medium text-slate-400">Coordinates: </span>
                                <span className="font-mono">{oldCoords}</span>
                              </div>
                            </div>

                            {/* New Requested Location */}
                            <div className="bg-amber-100/70 border border-amber-300 rounded-xl p-4 space-y-2 shadow-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">New Proposed Address</span>
                                <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded">Proposed</span>
                              </div>
                              <p className="text-sm font-bold text-amber-950 leading-snug">
                                {newAddr}
                              </p>
                              <div className="pt-1 text-xs text-amber-800">
                                <span className="font-medium text-amber-700">Coordinates: </span>
                                <span className="font-mono">{newCoords}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    }

                    if (isProfileUpdate) {
                      const pendingUpdate = r?.pendingProfileUpdate || {}
                      const updatedFields = Array.isArray(r?.profileUpdateFields) && r.profileUpdateFields.length > 0
                        ? r.profileUpdateFields.map((f) => {
                            if (f === 'restaurantName' || f === 'restaurantNameNormalized') return 'Restaurant Name'
                            if (f === 'ownerName') return 'Owner Name'
                            if (f === 'ownerPhone' || f === 'primaryContactNumber') return 'Phone / Primary Contact'
                            if (f === 'ownerEmail') return 'Owner Email'
                            if (f === 'panNumber' || f === 'nameOnPan' || f === 'panImage') return 'PAN Details'
                            if (f === 'gstNumber' || f === 'gstLegalName' || f === 'gstAddress' || f === 'gstImage') return 'GST Details'
                            if (f === 'fssaiNumber' || f === 'fssaiExpiry' || f === 'fssaiImage') return 'FSSAI License'
                            if (f === 'accountNumber' || f === 'ifscCode' || f === 'accountHolderName' || f === 'accountType' || f === 'upiId' || f === 'upiQrImage') return 'Bank & Payment Details'
                            if (f === 'profileImage' || f === 'coverImages' || f === 'menuImages') return 'Restaurant Images'
                            return f
                          })
                        : ['Restaurant Name & Business Profile Details']

                      const uniqueFieldLabels = Array.from(new Set(updatedFields))

                      return (
                        <div className="bg-purple-50 border-2 border-purple-300 rounded-2xl p-5 space-y-4 shadow-sm">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shrink-0">
                                <FileText className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="text-base font-bold text-purple-950">
                                  Reason For Approval Request: Restaurant Name & Profile Change
                                </h4>
                                <p className="text-xs text-purple-900 font-medium">
                                  The restaurant owner submitted updates to their profile.
                                  {r?.approvedAt ? ` This restaurant was approved on ${new Date(r.approvedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}.` : ''}
                                  {r?.profileUpdateRequestedAt ? ` (Requested on ${new Date(r.profileUpdateRequestedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })})` : ''}
                                </p>
                              </div>
                            </div>
                            <span className="px-3 py-1 bg-purple-600 text-white text-xs font-bold rounded-full uppercase tracking-wider shrink-0">
                              Name / Profile Edit Request
                            </span>
                          </div>

                          {pendingUpdate.restaurantName && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1 shadow-sm">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Current (Live) Restaurant Name</span>
                                <p className="text-sm font-semibold text-slate-800">{r?.restaurantName || "N/A"}</p>
                              </div>
                              <div className="bg-purple-100/80 border border-purple-300 rounded-xl p-4 space-y-1 shadow-sm">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-900">New Proposed Restaurant Name</span>
                                <p className="text-sm font-bold text-purple-950">{pendingUpdate.restaurantName}</p>
                              </div>
                            </div>
                          )}

                          <div className="pt-2 border-t border-purple-200/80">
                            <span className="text-xs font-bold uppercase tracking-wider text-purple-900 block mb-1.5">
                              Changed / Requested Updates:
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {uniqueFieldLabels.map((lbl, idx) => (
                                <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-900 border border-purple-300 font-bold text-xs rounded-lg">
                                  ✏️ {lbl}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
                              <Building2 className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="text-base font-bold text-blue-950">
                                Reason For Approval Request: New Restaurant Partner Registration
                              </h4>
                              <p className="text-xs text-blue-800 font-medium">
                                This is a new restaurant onboarding application. Review owner contact, address, operating timings, and submitted legal documents below to approve or reject.
                                {r?.createdAt ? ` (Registered on ${new Date(r.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })})` : ''}
                              </p>
                            </div>
                          </div>
                          <span className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full uppercase tracking-wider shrink-0">
                            New Joining Application
                          </span>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Owner Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Owner Information</h4>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <User className="w-5 h-5 text-slate-400" />
                          <div>
                            <p className="text-xs text-slate-500">Owner Name</p>
                            <p className="text-sm font-medium text-slate-900">{r?.ownerName || "N/A"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Phone className="w-5 h-5 text-slate-400" />
                          <div>
                            <p className="text-xs text-slate-500">Phone</p>
                            <p className="text-sm font-medium text-slate-900">{r?.ownerPhone || r?.phone || "N/A"}</p>
                          </div>
                        </div>
                        {(r?.ownerEmail || r?.email) && (
                          <div className="flex items-center gap-3">
                            <Mail className="w-5 h-5 text-slate-400" />
                            <div>
                              <p className="text-xs text-slate-500">Email</p>
                              <p className="text-sm font-medium text-slate-900">{r.ownerEmail || r.email}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Location & Contact */}
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Location & Contact</h4>
                      <div className="space-y-3">
                        {(() => {
                          const loc = r?.location || r?.onboarding?.step1?.location
                          const fullAddress = [
                            r?.addressLine1 || loc?.addressLine1,
                            r?.addressLine2 || loc?.addressLine2,
                            r?.area || loc?.area,
                            r?.city || loc?.city,
                            r?.state || loc?.state,
                            r?.pincode || loc?.pincode,
                            r?.landmark || loc?.landmark,
                          ].filter(Boolean).join(", ") || loc?.formattedAddress || loc?.address || (r?.serviceRadius ? `${r.serviceRadius} KM` : null)
                          return fullAddress ? (
                            <div className="flex items-start gap-3">
                              <MapPin className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
                              <div>
                                <p className="text-xs text-slate-500">Address</p>
                                <p className="text-sm font-medium text-slate-900">{fullAddress}</p>
                              </div>
                            </div>
                          ) : null
                        })()}
                        {r?.pureVegRestaurant != null && (
                          <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${r.pureVegRestaurant ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                              {r.pureVegRestaurant ? "🟢 Pure Veg" : "🟠 Mixed Menu"}
                            </span>
                          </div>
                        )}
                        {(r?.primaryContactNumber || r?.phone) && (
                          <div className="flex items-center gap-3">
                            <Phone className="w-5 h-5 text-slate-400" />
                            <div>
                              <p className="text-xs text-slate-500">Primary Contact</p>
                              <p className="text-sm font-medium text-slate-900">{r.primaryContactNumber || r.phone}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Timings */}
                  <div>
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Timings & Status</h4>
                      <div className="space-y-3">
                        {(openingTime || closingTime) && (
                          <div className="flex items-center gap-3">
                            <Clock className="w-5 h-5 text-slate-400" />
                            <div>
                              <p className="text-xs text-slate-500">Opening / Closing</p>
                              <p className="text-sm font-medium text-slate-900">
                                {formatTime12Hour(openingTime)} – {formatTime12Hour(closingTime)}
                              </p>
                            </div>
                          </div>
                        )}
                        {r?.estimatedDeliveryTime && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Estimated Delivery Time</p>
                            <p className="text-sm font-medium text-slate-900">{r.estimatedDeliveryTime}</p>
                          </div>
                        )}
                        {r?.openDays && Array.isArray(r.openDays) && r.openDays.length > 0 && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Open Days</p>
                            <div className="flex flex-wrap gap-2">
                              {r.openDays.map((day, idx) => (
                                <span key={idx} className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium capitalize">
                                  {day}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Approval Status</p>
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            approvalStatus === "approved" ? "bg-green-100 text-green-700" : approvalStatus === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                          }`}>
                            {approvalStatus === "approved" ? "Approved" : approvalStatus === "rejected" ? "Rejected" : "Pending"}
                          </span>
                        </div>
                      </div>
                    </div>

                  {/* Registration Documents – flat schema (PAN, GST, FSSAI, Bank) */}
                  {restaurantPhotoList.length > 0 && (
                    <div className="pt-6 border-t border-slate-200">
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Restaurant Photos</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {restaurantPhotoList.map((restaurantImg, idx) => {
                          const imgUrl = getNormalizedImageUrl(restaurantImg)
                          return imgUrl ? (
                            <a
                              key={idx}
                              href={imgUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg overflow-hidden border border-slate-200 hover:border-blue-500 transition-colors"
                            >
                              <img
                                src={imgUrl}
                                alt={`Restaurant ${idx + 1}`}
                                className="w-full h-32 object-cover"
                                onError={(e) => {
                                  e.target.src = "https://via.placeholder.com/200"
                                }}
                              />
                            </a>
                          ) : null
                        })}
                      </div>
                    </div>
                  )}

                  {(hasFlatDocs || r?.onboarding?.step3) && (
                    <div className="pt-6 border-t border-slate-200">
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Registration Documents</h4>
                      <div className="space-y-6">
                        {/* PAN – flat: panNumber, nameOnPan, panImage */}
                        {(r.panNumber || r.panImage || r?.onboarding?.step3?.pan) && (
                          <div className="bg-slate-50 rounded-lg p-4">
                            <h5 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              PAN Details
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              {(r.panNumber || r?.onboarding?.step3?.pan?.panNumber) && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">PAN Number</p>
                                  <p className="font-medium text-slate-900">{r.panNumber || r.onboarding?.step3?.pan?.panNumber}</p>
                                </div>
                              )}
                              {(r.nameOnPan || r?.onboarding?.step3?.pan?.nameOnPan) && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">Name on PAN</p>
                                  <p className="font-medium text-slate-900">{r.nameOnPan || r.onboarding?.step3?.pan?.nameOnPan}</p>
                                </div>
                              )}
                              {(typeof r.panImage === "string" ? r.panImage : r?.panImage?.url || r?.onboarding?.step3?.pan?.image?.url) && (
                                <div className="md:col-span-2">
                                  <p className="text-xs text-slate-500 mb-2">PAN Document</p>
                                  <a
                                    href={typeof r.panImage === "string" ? r.panImage : (r.panImage?.url || r.onboarding?.step3?.pan?.image?.url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
                                  >
                                    <ImageIcon className="w-4 h-4" />
                                    <span>View PAN Document</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* GST – flat: gstRegistered, gstNumber, gstLegalName, gstAddress, gstImage */}
                        {(r.gstRegistered != null || r.gstNumber || r?.onboarding?.step3?.gst) && (
                          <div className="bg-slate-50 rounded-lg p-4">
                            <h5 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              GST Details
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-xs text-slate-500 mb-1">GST Registered</p>
                                <p className="font-medium text-slate-900">
                                  {r.gstRegistered != null ? (r.gstRegistered ? "Yes" : "No") : (r?.onboarding?.step3?.gst?.isRegistered ? "Yes" : "No")}
                                </p>
                              </div>
                              {(r.gstNumber || r?.onboarding?.step3?.gst?.gstNumber) && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">GST Number</p>
                                  <p className="font-medium text-slate-900">{r.gstNumber || r.onboarding?.step3?.gst?.gstNumber}</p>
                                </div>
                              )}
                              {(r.gstLegalName || r?.onboarding?.step3?.gst?.legalName) && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">Legal Name</p>
                                  <p className="font-medium text-slate-900">{r.gstLegalName || r.onboarding?.step3?.gst?.legalName}</p>
                                </div>
                              )}
                              {(r.gstAddress || r?.onboarding?.step3?.gst?.address) && (
                                <div className="md:col-span-2">
                                  <p className="text-xs text-slate-500 mb-1">GST Address</p>
                                  <p className="font-medium text-slate-900">{r.gstAddress || r.onboarding?.step3?.gst?.address}</p>
                                </div>
                              )}
                              {(typeof r.gstImage === "string" ? r.gstImage : r?.gstImage?.url || r?.onboarding?.step3?.gst?.image?.url) && (
                                <div className="md:col-span-2">
                                  <p className="text-xs text-slate-500 mb-2">GST Document</p>
                                  <a
                                    href={typeof r.gstImage === "string" ? r.gstImage : (r.gstImage?.url || r.onboarding?.step3?.gst?.image?.url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
                                  >
                                    <ImageIcon className="w-4 h-4" />
                                    <span>View GST Document</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* FSSAI – flat: fssaiNumber, fssaiExpiry, fssaiImage */}
                        {(r.fssaiNumber || r.fssaiExpiry || r?.onboarding?.step3?.fssai) && (
                          <div className="bg-slate-50 rounded-lg p-4">
                            <h5 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              FSSAI Details
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              {(r.fssaiNumber || r?.onboarding?.step3?.fssai?.registrationNumber) && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">FSSAI Registration Number</p>
                                  <p className="font-medium text-slate-900">{r.fssaiNumber || r.onboarding?.step3?.fssai?.registrationNumber}</p>
                                </div>
                              )}
                              {(r.fssaiExpiry || r?.onboarding?.step3?.fssai?.expiryDate) && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">FSSAI Expiry Date</p>
                                  <p className="font-medium text-slate-900">
                                    {new Date(r.fssaiExpiry || r.onboarding?.step3?.fssai?.expiryDate).toLocaleDateString('en-IN', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric'
                                    })}
                                  </p>
                                </div>
                              )}
                              {(typeof r.fssaiImage === "string" ? r.fssaiImage : r?.fssaiImage?.url || r?.onboarding?.step3?.fssai?.image?.url) && (
                                <div className="md:col-span-2">
                                  <p className="text-xs text-slate-500 mb-2">FSSAI Document</p>
                                  <a
                                    href={typeof r.fssaiImage === "string" ? r.fssaiImage : (r.fssaiImage?.url || r.onboarding?.step3?.fssai?.image?.url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
                                  >
                                    <ImageIcon className="w-4 h-4" />
                                    <span>View FSSAI Document</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Bank – flat: accountNumber, ifscCode, accountHolderName, accountType */}
                        {(r.accountNumber || r.ifscCode || r?.onboarding?.step3?.bank) && (
                          <div className="bg-slate-50 rounded-lg p-4">
                            <h5 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <CreditCard className="w-4 h-4" />
                              Bank Details
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              {(r.accountNumber || r?.onboarding?.step3?.bank?.accountNumber) && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">Account Number</p>
                                  <p className="font-medium text-slate-900">{r.accountNumber || r.onboarding?.step3?.bank?.accountNumber}</p>
                                </div>
                              )}
                              {(r.ifscCode || r?.onboarding?.step3?.bank?.ifscCode) && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">IFSC Code</p>
                                  <p className="font-medium text-slate-900">{r.ifscCode || r.onboarding?.step3?.bank?.ifscCode}</p>
                                </div>
                              )}
                              {(r.accountHolderName || r?.onboarding?.step3?.bank?.accountHolderName) && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">Account Holder Name</p>
                                  <p className="font-medium text-slate-900">{r.accountHolderName || r.onboarding?.step3?.bank?.accountHolderName}</p>
                                </div>
                              )}
                              {(r.accountType || r?.onboarding?.step3?.bank?.accountType) && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">Account Type</p>
                                  <p className="font-medium text-slate-900 capitalize">{r.accountType || r.onboarding?.step3?.bank?.accountType}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Menu Images */}
                  {menuImgList.length > 0 && (
                    <div className="pt-6 border-t border-slate-200">
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Menu Images</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {menuImgList.map((menuImg, idx) => {
                          const imgUrl = typeof menuImg === "string" ? menuImg : (menuImg?.url || menuImg)
                          return imgUrl ? (
                            <a
                              key={idx}
                              href={imgUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg overflow-hidden border border-slate-200 hover:border-blue-500 transition-colors"
                            >
                              <img
                                src={imgUrl}
                                alt={`Menu ${idx + 1}`}
                                className="w-full h-32 object-cover"
                                onError={(e) => {
                                  e.target.src = "https://via.placeholder.com/200"
                                }}
                              />
                            </a>
                          ) : null
                        })}
                      </div>
                    </div>
                  )}

                  {/* Registration & approval info */}
                  {(r?.createdAt || r?.restaurantId || r?.businessModel || r?.approvedAt != null) && (
                    <div className="pt-6 border-t border-slate-200">
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Registration & Approval</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {r.createdAt && (
                          <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-slate-400" />
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Registration Date & Time</p>
                              <p className="font-medium text-slate-900">
                                {new Date(r.createdAt).toLocaleString('en-IN', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        )}
                        {r.restaurantId && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Restaurant ID</p>
                            <p className="font-medium text-slate-900">{r.restaurantId}</p>
                          </div>
                        )}
                        {r.approvedAt != null && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Approved At</p>
                            <p className="font-medium text-slate-900">{new Date(r.approvedAt).toLocaleString('en-IN')}</p>
                          </div>
                        )}
                        {r.businessModel && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Business Model</p>
                            <p className="font-medium text-slate-900">{r.businessModel}</p>
                          </div>
                        )}
                        {r.phoneVerified !== undefined && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Phone Verified</p>
                            <p className="font-medium text-slate-900">{r.phoneVerified ? "Yes" : "No"}</p>
                          </div>
                        )}
                        {r.signupMethod && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Signup Method</p>
                            <p className="font-medium text-slate-900 capitalize">{r.signupMethod}</p>
                          </div>
                        )}
                        {r?.onboarding?.completedSteps != null && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Onboarding Steps Completed</p>
                            <p className="font-medium text-slate-900">{r.onboarding.completedSteps} / 4</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Rejection Reason (if rejected) */}
                  {r?.rejectionReason && (
                    <div className="pt-6 border-t border-slate-200">
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-red-900 mb-2">Rejection Reason</h4>
                        <p className="text-sm text-red-800">{r.rejectionReason}</p>
                        {r.rejectedAt && (
                          <p className="text-xs text-red-600 mt-2">
                            Rejected on: {new Date(r.rejectedAt).toLocaleString('en-IN')}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                )
              })()}
              {!loadingDetails && !restaurantDetails && !selectedRequest && (
                <div className="flex flex-col items-center justify-center py-20">
                  <p className="text-lg font-semibold text-slate-700 mb-2">No Details Available</p>
                  <p className="text-sm text-slate-500">Unable to load restaurant details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


