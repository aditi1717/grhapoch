import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Megaphone, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Calendar, 
  CreditCard, 
  User, 
  Phone, 
  Mail, 
  Eye, 
  ExternalLink,
  Ban,
  Settings,
  IndianRupee,
  Check,
  X
} from "lucide-react";
import { adminAPI } from "@food/api";
import { Button } from "@food/components/ui/button";
import { Badge } from "@food/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@food/components/ui/card";
import { toast } from "sonner";

export default function AdBannerManagement() {
  const { subTab } = useParams();
  const location = useLocation();

  // Detect mode
  const isRestaurantMode = location.pathname.includes("/restaurant/");
  const isUserMode = location.pathname.includes("/user/");
  const isDedicatedMode = isRestaurantMode || isUserMode;

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("pending");
  
  // Rejection modal states
  const [selectedAd, setSelectedAd] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);

  // View Details Modal States
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingAd, setViewingAd] = useState(null);

  // Settings States (Single pricing package)
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [adDays, setAdDays] = useState(30);
  const [adPrice, setAdPrice] = useState(2000);

  useEffect(() => {
    if (subTab === "settings") {
      fetchSettingsData();
    } else {
      fetchRequests();
    }
  }, [location.pathname, subTab]);

  const fetchSettingsData = async () => {
    try {
      setSettingsLoading(true);
      
      // Load pricing
      const bizRes = await adminAPI.getBusinessSettings();
      const settings = bizRes?.data?.data || bizRes?.data;
      if (settings) {
        setAdDays(settings.adBannerDays ?? 30);
        setAdPrice(settings.adBannerPrice ?? 2000);
      }
    } catch (err) {
      console.error("Error loading settings:", err);
      toast.error("Failed to load configuration settings.");
    } finally {
      setSettingsLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminAPI.getAdBannerRequests();
      if (response.data.success) {
        setRequests(response.data.data.requests || []);
      }
    } catch (err) {
      console.error("Error fetching ad requests:", err);
      setError("Failed to load advertising requests.");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePricing = async (e) => {
    e.preventDefault();
    const days = Number(adDays);
    const price = Number(adPrice);

    if (isNaN(days) || days <= 0) {
      toast.error("Campaign duration must be greater than 0 days");
      return;
    }
    if (isNaN(price) || price < 0) {
      toast.error("Pricing charge cannot be negative or empty");
      return;
    }

    try {
      setSettingsSaving(true);
      // Fetch fresh setup info to preserve logo, favicons, text
      const res = await adminAPI.getBusinessSettings();
      const current = res?.data?.data || res?.data || {};

      const payload = {
        companyName: current.companyName || "Switcheats",
        email: current.email || "support@switcheats.com",
        phoneCountryCode: current.phone?.countryCode || "+91",
        phoneNumber: current.phone?.number || "9999999999",
        address: current.address || "",
        state: current.state || "",
        pincode: current.pincode || "",
        region: current.region || "India",
        adBannerDays: Number(adDays || 1),
        adBannerPrice: Number(adPrice || 0)
      };

      await adminAPI.updateBusinessSettings(payload, {});
      toast.success("Advertising package saved successfully");
    } catch (err) {
      console.error("Failed to save pricing:", err);
      toast.error("Failed to save pricing configuration");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm("Are you sure you want to approve this ad campaign? It will go active immediately.")) return;
    try {
      setProcessingId(id);
      const response = await adminAPI.approveAdBannerRequest(id);
      if (response.data.success) {
        toast.success("Ad campaign approved successfully");
        setRequests(prev => prev.map(r => r._id === id ? { ...r, status: 'approved' } : r));
        if (viewingAd && viewingAd._id === id) {
          setViewingAd(prev => ({ ...prev, status: 'approved' }));
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to approve ad campaign");
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectModal = (ad) => {
    setSelectedAd(ad);
    setRejectionReason("");
    setShowRejectModal(true);
  };

  const openViewModal = (ad) => {
    setViewingAd(ad);
    setShowViewModal(true);
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      toast.error("Please enter a rejection reason");
      return;
    }
    try {
      setProcessingId(selectedAd._id);
      setShowRejectModal(false);
      const response = await adminAPI.rejectAdBannerRequest(selectedAd._id, rejectionReason.trim());
      if (response.data.success) {
        toast.success("Ad request rejected and payment refunded successfully");
        setRequests(prev => prev.map(r => r._id === selectedAd._id ? { ...r, status: 'rejected', rejectionReason: rejectionReason.trim(), paymentStatus: 'refunded' } : r));
        if (viewingAd && viewingAd._id === selectedAd._id) {
          setViewingAd(prev => ({ ...prev, status: 'rejected', rejectionReason: rejectionReason.trim(), paymentStatus: 'refunded' }));
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reject request");
    } finally {
      setProcessingId(null);
      setSelectedAd(null);
    }
  };

  // Filter requests based on mode and subTab
  const filteredRequests = requests.filter(r => {
    // 1. Filter by requester type
    if (isRestaurantMode && r.requesterType !== "FoodRestaurant") return false;
    if (isUserMode && r.requesterType !== "FoodUser") return false;

    // 2. Filter by tab status
    const now = new Date();
    if (isDedicatedMode) {
      switch (subTab) {
        case "requests":
          return r.status === "pending_approval";
        case "active":
          return r.status === "approved" && new Date(r.startDate) <= now && new Date(r.endDate) >= now;
        case "rejected":
          return r.status === "rejected";
        case "history":
          return true; // All history
        default:
          return true;
      }
    } else {
      // Fallback tabs mode
      if (activeTab === "pending") {
        return r.status === "pending_approval";
      }
      if (activeTab === "active") {
        return r.status === "approved" && new Date(r.startDate) <= now && new Date(r.endDate) >= now;
      }
      return true; // All
    }
  });

  const getSubTabTitle = () => {
    const prefix = isRestaurantMode ? "Restaurant Ads" : "User Ads";
    switch (subTab) {
      case "requests": return `${prefix} - Pending Requests`;
      case "active": return `${prefix} - Active Ads`;
      case "rejected": return `${prefix} - Rejected Ads`;
      case "history": return `${prefix} - History`;
      case "settings": return `${prefix} - Settings`;
      default: return `${prefix} - Campaign Management`;
    }
  };

  const getStatusBadge = (status, paymentStatus) => {
    if (status === "pending_approval") {
      return (
        <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 flex items-center gap-1 font-medium text-xs">
          <Clock className="w-3.5 h-3.5" /> Pending Review
        </Badge>
      );
    }
    if (status === "approved") {
      return (
        <Badge className="bg-green-50 text-green-700 border-green-200 hover:bg-green-50 flex items-center gap-1 font-medium text-xs">
          <CheckCircle className="w-3.5 h-3.5" /> Approved
        </Badge>
      );
    }
    if (status === "rejected") {
      return (
        <Badge className="bg-red-50 text-red-700 border-red-200 hover:bg-red-50 flex items-center gap-1 font-medium text-xs">
          <Ban className="w-3.5 h-3.5" /> Rejected {paymentStatus === 'refunded' && "(Refunded)"}
        </Badge>
      );
    }
    if (status === "cancelled") {
      return (
        <Badge className="bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-50 flex items-center gap-1 font-medium text-xs">
          <XCircle className="w-3.5 h-3.5" /> Cancelled {paymentStatus === 'refunded' && "(Refunded)"}
        </Badge>
      );
    }
    return (
      <Badge className="bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-100 flex items-center gap-1 font-medium text-xs">
        {status}
      </Badge>
    );
  };

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-200">
              <Megaphone className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {isDedicatedMode ? getSubTabTitle() : "Ad Campaign Requests"}
              </h1>
              <p className="text-sm text-slate-500 mt-1">Review self-serve restaurant and user banners, pricing models, and payments.</p>
            </div>
          </div>
        </div>

        {/* Dynamic Settings Screen */}
        {subTab === "settings" ? (
          <div className="max-w-xl">
            
            {/* Pricing Form Card */}
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="text-base font-bold text-slate-900">Banner Pricing Setup</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Configure the duration and charge cost for all banner advertising campaigns.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2 border-t border-slate-100">
                {settingsLoading ? (
                  <div className="flex items-center justify-center p-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  </div>
                ) : (
                  <form onSubmit={handleSavePricing} className="space-y-5 pt-3">
                    
                    {/* Days input */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" /> Campaign Duration (Days)
                      </label>
                      <input 
                        type="number"
                        min="1"
                        value={adDays}
                        onChange={(e) => setAdDays(Number(e.target.value))}
                        className="w-full border border-slate-300 px-3.5 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white font-semibold"
                        required
                      />
                    </div>

                    {/* Price input */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                        <IndianRupee className="w-3.5 h-3.5 text-slate-400" /> Pricing Charge (₹)
                      </label>
                      <input 
                        type="number"
                        min="0"
                        value={adPrice}
                        onChange={(e) => setAdPrice(Number(e.target.value))}
                        className="w-full border border-slate-300 px-3.5 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white font-semibold"
                        required
                      />
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex justify-end">
                      <Button
                        type="submit"
                        disabled={settingsSaving}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow"
                      >
                        {settingsSaving ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                            Saving...
                          </>
                        ) : (
                          "Save Settings"
                        )}
                      </Button>
                    </div>

                  </form>
                )}
              </CardContent>
            </Card>

          </div>
        ) : (
          /* Normal List Screen */
          <>
            {/* Tabs Bar (Only show if not in dedicated mode) */}
            {!isDedicatedMode && (
              <div className="flex items-center gap-2 border-b border-slate-200">
                <button
                  onClick={() => setActiveTab("pending")}
                  className={`px-4 py-2.5 font-semibold text-sm border-b-2 transition-colors ${
                    activeTab === "pending"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Pending Review
                </button>
                <button
                  onClick={() => setActiveTab("active")}
                  className={`px-4 py-2.5 font-semibold text-sm border-b-2 transition-colors ${
                    activeTab === "active"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Active Banners
                </button>
                <button
                  onClick={() => setActiveTab("all")}
                  className={`px-4 py-2.5 font-semibold text-sm border-b-2 transition-colors ${
                    activeTab === "all"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Campaign History
                </button>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center justify-between max-w-2xl">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="text-sm font-medium">{error}</span>
                </div>
                <Button variant="link" onClick={fetchRequests} className="text-red-950 font-bold p-0">Retry</Button>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center p-16 bg-white rounded-lg border border-slate-200 shadow-sm min-h-[300px]">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-3" />
                <p className="text-slate-500 font-semibold text-sm">Fetching advertising requests...</p>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 bg-white rounded-lg border border-slate-200 shadow-sm text-center min-h-[300px]">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">No campaigns found</h3>
                <p className="text-slate-500 max-w-xs mt-1 text-sm">
                  There are no banner campaigns in this section.
                </p>
              </div>
            ) : (
              /* TABULAR LIST VIEW */
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="px-6 py-4">Campaign Title</th>
                        <th className="px-6 py-4">Requester</th>
                        <th className="px-6 py-4">Duration</th>
                        <th className="px-6 py-4">Amount</th>
                        <th className="px-6 py-4">Payment</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredRequests.map((req) => {
                        const durationDays = Math.ceil(Math.abs(new Date(req.endDate) - new Date(req.startDate)) / (1000 * 60 * 60 * 24));
                        return (
                          <tr key={req._id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-900 text-sm">{req.title || "Untitled Campaign"}</div>
                              {req.targetType !== "none" && (
                                <div className="text-[10px] text-blue-600 font-bold mt-0.5 flex items-center gap-0.5">
                                  Target: <span className="capitalize">{req.targetType === "restaurant" ? "Restaurant Profile" : "Website link"}</span>
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-800">{req.requesterName}</div>
                              <div className="text-[10px] text-slate-400 font-semibold capitalize mt-0.5">
                                {req.requesterType === "FoodRestaurant" ? "Restaurant" : "User"}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-700">{new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}</div>
                              <div className="text-[10px] text-slate-400 font-semibold mt-0.5">{durationDays} Days ({req.pricingType})</div>
                            </td>
                            <td className="px-6 py-4 font-extrabold text-slate-950 text-sm">₹ {req.amountPaid}</td>
                            <td className="px-6 py-4">
                              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                req.paymentStatus === 'paid' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-slate-50 text-slate-600 border border-slate-200'
                              }`}>
                                {req.paymentStatus}
                              </span>
                            </td>
                            <td className="px-6 py-4">{getStatusBadge(req.status, req.paymentStatus)}</td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end items-center gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openViewModal(req)}
                                  className="h-8 w-8 p-0 hover:bg-slate-100 text-slate-600 border-slate-200"
                                  title="View Details"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                {req.status === "pending_approval" && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleApprove(req._id)}
                                      disabled={processingId === req._id}
                                      className="h-8 w-8 p-0 hover:bg-green-50 hover:text-green-600 hover:border-green-200 text-slate-600 border-slate-200"
                                      title="Approve"
                                    >
                                      {processingId === req._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-4 h-4 text-green-600" />}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openRejectModal(req)}
                                      disabled={processingId === req._id}
                                      className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-600 border-slate-200"
                                      title="Reject"
                                    >
                                      <X className="w-4 h-4 text-red-600" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

      </div>

      {/* Detailed View Modal */}
      {showViewModal && viewingAd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base">Campaign Details</h3>
              </div>
              <button 
                onClick={() => {
                  setShowViewModal(false);
                  setViewingAd(null);
                }}
                className="p-1 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 text-sm">
              
              {/* Banner Image Preview */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Banner Artwork</span>
                <div className="relative h-48 bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                  <img 
                    src={viewingAd.image} 
                    alt={viewingAd.title} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 right-3">
                    {getStatusBadge(viewingAd.status, viewingAd.paymentStatus)}
                  </div>
                </div>
              </div>

              {/* Title & Click redirection target */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Campaign Title</span>
                  <div className="font-bold text-slate-900 text-base">{viewingAd.title || "Untitled"}</div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Click Target Destination</span>
                  <div>
                    {viewingAd.targetType === "none" ? (
                      <span className="font-bold text-slate-500">No redirection target</span>
                    ) : viewingAd.targetType === "restaurant" ? (
                      <span className="font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                        Restaurant Profile ({viewingAd.targetId || "ID missing"})
                      </span>
                    ) : (
                      <a 
                        href={viewingAd.targetUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded inline-flex items-center gap-1"
                      >
                        Custom Website URL <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Requester Info */}
              <div className="border-t border-slate-100 pt-4 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requester Information</span>
                <div className="grid gap-4 sm:grid-cols-2 bg-slate-50 p-4 rounded-xl border border-slate-150">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-bold text-slate-400">Name / Restaurant</p>
                    <p className="font-bold text-slate-800 flex items-center gap-1">
                      {viewingAd.requesterName}
                      <span className="text-[9px] font-normal text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded capitalize">
                        {viewingAd.requesterType === 'FoodRestaurant' ? 'Restaurant' : 'User'}
                      </span>
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-bold text-slate-400">Phone</p>
                    <p className="font-semibold text-slate-700">{viewingAd.requesterContact || "Not Available"}</p>
                  </div>
                </div>
              </div>

              {/* Campaign settings parameters & Payment details */}
              <div className="border-t border-slate-100 pt-4 grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-blue-500" /> Duration & Dates</span>
                  <div className="space-y-1 bg-blue-50/20 p-3 rounded-xl border border-blue-100/50">
                    <div className="font-semibold text-slate-800">
                      {new Date(viewingAd.startDate).toLocaleDateString()} - {new Date(viewingAd.endDate).toLocaleDateString()}
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      Duration length: <span className="font-bold text-slate-700">{Math.ceil(Math.abs(new Date(viewingAd.endDate) - new Date(viewingAd.startDate)) / (1000 * 60 * 60 * 24))} Days</span>
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><CreditCard className="w-3.5 h-3.5 text-green-500" /> Payment Details</span>
                  <div className="space-y-1 bg-green-50/20 p-3 rounded-xl border border-green-100/50">
                    <div className="font-extrabold text-green-700 text-base">₹ {viewingAd.amountPaid}</div>
                    <p className="text-xs text-slate-500 font-medium">
                      Status: <span className="font-bold uppercase text-green-600">{viewingAd.paymentStatus}</span>
                    </p>
                    {viewingAd.razorpayPaymentId && (
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">PayID: {viewingAd.razorpayPaymentId}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Rejection Reason display */}
              {viewingAd.status === "rejected" && viewingAd.rejectionReason && (
                <div className="border-t border-red-100 bg-red-50 p-4 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-red-800">Rejection Reason:</span>
                  <p className="text-red-700 leading-relaxed">{viewingAd.rejectionReason}</p>
                </div>
              )}

            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex items-center justify-between shrink-0">
              <Button
                variant="outline"
                onClick={() => {
                  setShowViewModal(false);
                  setViewingAd(null);
                }}
                className="border-slate-300 font-bold text-xs"
              >
                Close View
              </Button>

              {viewingAd.status === "pending_approval" && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowViewModal(false);
                      openRejectModal(viewingAd);
                    }}
                    disabled={processingId === viewingAd._id}
                    className="border-slate-200 hover:bg-red-50 hover:text-red-650 hover:border-red-200 transition-colors font-bold text-xs"
                  >
                    Reject & Refund
                  </Button>
                  <Button
                    onClick={() => handleApprove(viewingAd._id)}
                    disabled={processingId === viewingAd._id}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                  >
                    {processingId === viewingAd._id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                    Approve Campaign
                  </Button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl p-6 relative">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-2">
              <Ban className="w-5 h-5 text-red-600" /> Reject Ad Request
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Enter the reason for rejecting this banner campaign. An automatic refund will be triggered immediately to the user's account.
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Rejection Reason</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Inappropriate banner text, image does not meet quality standards, etc."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowRejectModal(false);
                    setSelectedAd(null);
                  }}
                  className="border-slate-200 font-semibold text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={processingId === selectedAd?._id}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
                >
                  {processingId === selectedAd?._id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  Confirm Reject & Refund
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
