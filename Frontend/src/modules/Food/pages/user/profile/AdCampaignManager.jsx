import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { 
  ArrowLeft,
  Megaphone,
  Calendar,
  CreditCard,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  ExternalLink,
  Loader2,
  AlertCircle,
  Upload,
  Ban,
  Check,
  Building2,
  Trash2
} from "lucide-react";
import { userAPI, restaurantAPI, uploadAPI } from "@food/api";
import { Button } from "@food/components/ui/button";
import { Badge } from "@food/components/ui/badge";
import { Card, CardContent } from "@food/components/ui/card";
import { toast } from "sonner";
import { initRazorpayPayment } from "@food/utils/razorpay";

export default function AdCampaignManager() {
  const location = useLocation();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Detect context module based on route
  const isRestaurant = location.pathname.includes("/restaurant");
  const api = isRestaurant ? restaurantAPI : userAPI;
  
  // States
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adDays, setAdDays] = useState(30);
  const [adPrice, setAdPrice] = useState(2000);
  const [loadingPricing, setLoadingPricing] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  
  // Form states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: "",
    targetType: "none",
    targetUrl: "",
    image: ""
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  useEffect(() => {
    fetchPricing();
    fetchMyAds();
  }, []);

  const fetchPricing = async () => {
    try {
      setLoadingPricing(true);
      const res = await api.getAdPricing();
      if (res.data.success) {
        setAdDays(res.data.data.adDays ?? 30);
        setAdPrice(res.data.data.adPrice ?? 2000);
      }
    } catch (err) {
      console.error("Error loading ad pricing:", err);
    } finally {
      setLoadingPricing(false);
    }
  };

  const fetchMyAds = async () => {
    try {
      setLoading(true);
      const res = await api.getMyAdCampaigns();
      if (res.data.success) {
        setAds(res.data.data.campaigns || res.data.data.ads || []);
      }
    } catch (err) {
      console.error("Error loading ad campaigns:", err);
      toast.error("Failed to load campaigns.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }
    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleCancelAd = async (id) => {
    if (!window.confirm("Are you sure you want to cancel this pending request? Your payment will be refunded to your account.")) return;
    try {
      setProcessingId(id);
      const res = await api.cancelAdCampaign(id);
      if (res.data.success) {
        toast.success("Ad request cancelled and refund initiated successfully");
        setAds(prev => prev.map(a => a._id === id ? { ...a, status: 'cancelled', paymentStatus: 'refunded' } : a));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to cancel ad request");
    } finally {
      setProcessingId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error("Please enter a campaign title");
      return;
    }
    if (!selectedFile && !formData.image) {
      toast.error("Please upload a banner image");
      return;
    }

    try {
      setCreating(true);
      let imageUrl = formData.image;

      // 1. Upload Banner image if selected
      if (selectedFile) {
        setUploading(true);
        const folderName = isRestaurant ? "food/restaurant/banners" : "food/user/banners";
        const uploadRes = await uploadAPI.uploadMedia(selectedFile, { folder: folderName });
        const url = uploadRes?.data?.data?.url || uploadRes?.data?.url;
        if (!url) throw new Error("Failed to get uploaded banner URL");
        imageUrl = url;
        setUploading(false);
      }

      // Calculate End Date based on configured adDays duration in days
      const sDate = new Date();
      const eDate = new Date();
      eDate.setDate(sDate.getDate() + Number(adDays));

      const requestBody = {
        title: formData.title.trim(),
        image: imageUrl,
        startDate: sDate.toISOString(),
        endDate: eDate.toISOString(),
        pricingType: "daily", // matches backend schema enum check
        amountPaid: Number(adPrice),
        targetType: formData.targetType,
        targetUrl: formData.targetType === "url" ? formData.targetUrl.trim() : ""
      };

      // 2. Request Campaign creation (triggers Razorpay Order on Backend)
      const campaignRes = await api.requestAdCampaign(requestBody);
      if (campaignRes.data.success) {
        const resData = campaignRes.data.data;
        const adId = resData.adBannerId;
        const razorpayOrderId = resData.razorpayOrderId;
        const amount = resData.amount;
        const key = resData.razorpayKeyId;

        // If it's a mock order (dev mode)
        if (razorpayOrderId && razorpayOrderId.startsWith('rzp_mock_')) {
          // Verify immediately to simulate payment success and trigger admin push notification
          toast.loading("Submitting ad request...", { id: "ad-submit" });
          try {
            const verifyRes = await api.verifyAdPayment({
              adBannerId: adId,
              razorpayOrderId: razorpayOrderId,
              razorpayPaymentId: `pay_mock_${Date.now()}`,
              razorpaySignature: 'sig_mock_dev'
            });
            if (verifyRes.data.success) {
              toast.success("Ad request submitted and payment simulated (Dev Mode)!", { id: "ad-submit" });
              setShowCreateModal(false);
              fetchMyAds();
            } else {
              toast.error("Failed to process payment status verification", { id: "ad-submit" });
            }
          } catch (verifyErr) {
            toast.error("Failed to verify ad payment setup", { id: "ad-submit" });
          }
        } else if (razorpayOrderId) {
          // Launch real Razorpay Checkout
          await initRazorpayPayment({
            key: key,
            amount: amount * 100, // in paise
            currency: "INR",
            order_id: razorpayOrderId,
            handler: async (paymentResponse) => {
              try {
                toast.loading("Verifying payment...", { id: "payment-verify" });
                const verifyRes = await api.verifyAdPayment({
                  adBannerId: adId,
                  razorpayOrderId: paymentResponse.razorpay_order_id,
                  razorpayPaymentId: paymentResponse.razorpay_payment_id,
                  razorpaySignature: paymentResponse.razorpay_signature
                });
                
                if (verifyRes.data.success) {
                  toast.success("Payment verified! Ad campaign sent for review.", { id: "payment-verify" });
                  setShowCreateModal(false);
                  fetchMyAds();
                } else {
                  toast.error("Payment verification failed", { id: "payment-verify" });
                }
              } catch (verifyErr) {
                toast.error("Payment verification failed. Please contact support.", { id: "payment-verify" });
              }
            },
            modal: {
              ondismiss: () => {
                toast.error("Payment cancelled. The request will remain pending payment.");
                setShowCreateModal(false);
                fetchMyAds();
              }
            }
          });
        } else {
          // Fallback if Razorpay credentials not present / mock order
          toast.success("Ad request submitted successfully!");
          setShowCreateModal(false);
          fetchMyAds();
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to create ad campaign");
    } finally {
      setCreating(false);
      setUploading(false);
    }
  };

  const getStatusBadge = (status, paymentStatus) => {
    if (status === "pending_approval") {
      return (
        <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 flex items-center gap-1 font-semibold text-xs">
          <Clock className="w-3.5 h-3.5" /> Pending Review
        </Badge>
      );
    }
    if (status === "approved") {
      const now = new Date();
      return (
        <Badge className="bg-green-50 text-green-700 border-green-200 hover:bg-green-50 flex items-center gap-1 font-semibold text-xs">
          <CheckCircle className="w-3.5 h-3.5" /> Active / Approved
        </Badge>
      );
    }
    if (status === "rejected") {
      return (
        <Badge className="bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-50 flex items-center gap-1 font-semibold text-xs">
          <Ban className="w-3.5 h-3.5" /> Rejected {paymentStatus === 'refunded' && "(Refunded)"}
        </Badge>
      );
    }
    if (status === "cancelled") {
      return (
        <Badge className="bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-50 flex items-center gap-1 font-semibold text-xs">
          <XCircle className="w-3.5 h-3.5" /> Cancelled {paymentStatus === 'refunded' && "(Refunded)"}
        </Badge>
      );
    }
    return <Badge className="bg-slate-100 text-slate-700">{status}</Badge>;
  };

  const getTabCount = (tab) => {
    const now = new Date();
    if (tab === "pending") {
      return ads.filter(ad => ad.status === "pending_approval").length;
    }
    if (tab === "active") {
      return ads.filter(ad => ad.status === "approved" && new Date(ad.startDate) <= now && new Date(ad.endDate) >= now).length;
    }
    if (tab === "rejected") {
      return ads.filter(ad => ad.status === "rejected").length;
    }
    return ads.length;
  };

  const getFilteredAds = () => {
    const now = new Date();
    return ads.filter(ad => {
      if (activeTab === "pending") {
        return ad.status === "pending_approval";
      }
      if (activeTab === "active") {
        return ad.status === "approved" && new Date(ad.startDate) <= now && new Date(ad.endDate) >= now;
      }
      if (activeTab === "rejected") {
        return ad.status === "rejected";
      }
      return true;
    });
  };

  const filteredAdsList = getFilteredAds();

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-black ${isRestaurant ? "pb-24" : "pb-12"}`}>
      
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-gray-800 bg-white/95 dark:bg-black/95 backdrop-blur px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(isRestaurant ? "/restaurant" : "/user/profile")} 
            className="rounded-full p-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-slate-700 dark:text-slate-350" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Self-Serve Ads</h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Create home banner campaigns to boost your visibility.</p>
          </div>
        </div>
      </div>

      {/* Floating Action Button (FAB) in Bottom Right */}
      <button
        onClick={() => {
          setFormData({
            title: "",
            targetType: isRestaurant ? "restaurant" : "none",
            targetUrl: "",
            image: ""
          });
          setSelectedFile(null);
          setImagePreview("");
          setShowCreateModal(true);
        }}
        className={`fixed z-50 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-extrabold text-sm rounded-full px-5 py-3 shadow-xl hover:shadow-2xl active:scale-95 transition-all flex items-center gap-1.5 border border-white/10 ${
          isRestaurant ? "bottom-24 right-6" : "bottom-8 right-6"
        }`}
      >
        <Plus className="w-5 h-5" />
        Create Ad
      </button>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        
        {/* Pricing & Promo Banner */}
        <Card className="bg-gradient-to-br from-orange-500 to-amber-600 border-none shadow-lg text-white overflow-hidden relative rounded-3xl">
          <CardContent className="p-6 relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Megaphone className="w-5 h-5 animate-bounce" /> Advertise on Homepage
              </h2>
              <p className="text-xs text-orange-100 max-w-md leading-relaxed">
                Reach thousands of active foodies. Run banner advertisement campaigns on our main homepage carousel at the best rates.
              </p>
            </div>
            
            <div className="flex gap-4 shrink-0 bg-white/10 p-3.5 rounded-2xl border border-white/10 backdrop-blur-sm">
              <div className="text-center px-4">
                <p className="text-[10px] font-semibold text-orange-200 uppercase tracking-wider">Campaign Duration</p>
                <p className="text-lg font-black mt-0.5">{adDays} {Number(adDays) === 1 ? 'Day' : 'Days'}</p>
              </div>
              <div className="w-px bg-white/20 my-1"></div>
              <div className="text-center px-4">
                <p className="text-[10px] font-semibold text-orange-200 uppercase tracking-wider font-bold">Package Cost</p>
                <p className="text-lg font-black mt-0.5 text-green-300">₹ {adPrice}</p>
              </div>
            </div>
          </CardContent>
          <div className="absolute right-0 bottom-0 opacity-10 translate-x-12 translate-y-12">
            <Megaphone className="w-48 h-48 text-white" />
          </div>
        </Card>

        {/* Campaign List Header & Dynamic Filters */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">My Campaigns</h3>
            
            {/* Tabs Filter Bar */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {["all", "active", "pending", "rejected"].map((tab) => {
                const count = getTabCount(tab);
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
                      isActive 
                        ? "bg-orange-500 text-white shadow-sm"
                        : "bg-white dark:bg-[#1a1a1a] text-slate-600 dark:text-slate-350 hover:bg-slate-105 dark:hover:bg-slate-900 border border-slate-200/80 dark:border-gray-800"
                    }`}
                  >
                    <span className="capitalize">{tab}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                      isActive 
                        ? "bg-white/20 text-white" 
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm min-h-[250px]">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500 mb-2" />
              <p className="text-xs text-slate-500 dark:text-slate-450 font-bold">Loading campaigns...</p>
            </div>
          ) : filteredAdsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-[#1a1a1a] rounded-3xl border border-dashed border-slate-200 dark:border-gray-800 text-center min-h-[300px]">
              <div className="w-16 h-16 bg-orange-50 dark:bg-orange-950/20 rounded-full flex items-center justify-center mb-4">
                <Megaphone className="w-7 h-7 text-orange-500" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">No campaigns found</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mt-2 leading-relaxed">
                There are no {activeTab !== 'all' ? activeTab : ''} banner campaigns in this section.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredAdsList.map((ad) => (
                <div key={ad._id} className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-slate-200 dark:border-gray-800 overflow-hidden shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                  
                  {/* Image with status badge overlay */}
                  <div className="relative h-36 bg-slate-100 dark:bg-zinc-900 overflow-hidden">
                    <img 
                      src={ad.image} 
                      alt={ad.title || "Ad Campaign"} 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2.5 right-2.5">
                      {getStatusBadge(ad.status, ad.paymentStatus)}
                    </div>
                  </div>

                  <div className="p-4 space-y-3.5 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-slate-950 dark:text-white text-sm leading-snug">{ad.title}</h4>
                      
                      <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-gray-800">
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase">Duration</p>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {new Date(ad.startDate).toLocaleDateString()} - {new Date(ad.endDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase">Amount Paid</p>
                          <p className="text-xs font-black text-green-600 dark:text-green-400">₹ {ad.amountPaid}</p>
                        </div>
                      </div>

                      {ad.targetType !== "none" && (
                        <div className="mt-2.5 flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          <span>Target:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-gray-800 px-1.5 py-0.5 rounded truncate max-w-[200px]">
                            {ad.targetType === "restaurant" ? "Restaurant Profile" : ad.targetUrl}
                          </span>
                        </div>
                      )}

                      {ad.status === "rejected" && ad.rejectionReason && (
                        <div className="mt-2.5 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 text-red-750 dark:text-red-300 px-3 py-2 rounded-xl text-xs space-y-1">
                          <span className="font-bold">Rejection Reason:</span>
                          <p className="leading-relaxed">{ad.rejectionReason}</p>
                        </div>
                      )}
                    </div>

                    {/* Cancellation Action */}
                    {ad.status === "pending_approval" && (
                      <div className="pt-2 border-t border-slate-100 dark:border-gray-800">
                        <Button
                          variant="outline"
                          onClick={() => handleCancelAd(ad._id)}
                          disabled={processingId === ad._id}
                          className="w-full border-red-200 dark:border-red-900/30 text-red-650 dark:text-red-400 bg-white dark:bg-zinc-900 hover:bg-red-55 dark:hover:bg-red-950/20 hover:text-red-700 font-bold text-xs rounded-xl h-9"
                        >
                          {processingId === ad._id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                          Cancel Campaign & Refund
                        </Button>
                      </div>
                    )}

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 animate-fade-in">
          {/* Backdrop click close */}
          <div className="absolute inset-0" onClick={() => !creating && setShowCreateModal(false)}></div>
          
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl relative z-10 overflow-hidden max-h-[90vh] flex flex-col animate-slide-up border dark:border-gray-800">
            
            <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-800 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-black text-slate-950 dark:text-white text-base">New Ad Campaign</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-450 font-medium font-bold text-orange-600 dark:text-orange-400">Fixed Package: {adDays} {Number(adDays) === 1 ? 'Day' : 'Days'} Campaign</p>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold flex items-center justify-center"
                disabled={creating}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
              
              {/* Campaign Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Campaign Title</label>
                <input 
                  type="text" 
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Delicious Weekend Combo Deal"
                  className="w-full border border-slate-350 dark:border-gray-700 px-4 py-2.5 text-sm rounded-xl focus:ring-1 focus:ring-orange-500 focus:outline-none bg-white dark:bg-black text-slate-900 dark:text-white"
                  required
                  disabled={creating}
                />
              </div>



              {/* Banner Image Upload */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Banner Image (Quality ratio 16:9 recommended)</label>
                <div 
                  onClick={() => !creating && fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-gray-700 rounded-2xl h-36 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors relative overflow-hidden bg-slate-50/50 dark:bg-zinc-900/50"
                >
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <Upload className="w-6 h-6 text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <Upload className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">Tap to upload banner</span>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500">JPG, PNG up to 5MB</span>
                    </div>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                  disabled={creating}
                />
              </div>

              {/* Redirect Action Targets */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Click Target Action</label>
                <select
                  value={formData.targetType}
                  onChange={(e) => setFormData(prev => ({ ...prev, targetType: e.target.value }))}
                  className="w-full border border-slate-350 dark:border-gray-700 px-4 py-2.5 text-sm rounded-xl focus:ring-1 focus:ring-orange-500 focus:outline-none bg-white dark:bg-black text-slate-900 dark:text-white"
                  disabled={creating}
                >
                  <option value="none">No Action (Simple Banner)</option>
                  {isRestaurant && <option value="restaurant">Redirect to My Restaurant Profile</option>}
                  <option value="url">Redirect to Custom Website URL</option>
                </select>
              </div>

              {formData.targetType === "url" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Redirect URL</label>
                  <input 
                    type="url" 
                    value={formData.targetUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, targetUrl: e.target.value }))}
                    placeholder="https://example.com/promo-link"
                    className="w-full border border-slate-350 dark:border-gray-700 px-4 py-2.5 text-sm rounded-xl focus:ring-1 focus:ring-orange-500 focus:outline-none bg-white dark:bg-black text-slate-900 dark:text-white"
                    required
                    disabled={creating}
                  />
                </div>
              )}

              {/* Fixed Pricing summary card */}
              <div className="bg-slate-550 dark:bg-zinc-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Price Summary</p>
                  <p className="text-xs text-slate-600 dark:text-slate-350 font-medium">
                    Run for exactly <span className="font-bold text-orange-600 dark:text-orange-400">{adDays} {Number(adDays) === 1 ? 'day' : 'days'}</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-orange-600 dark:text-orange-400">₹ {adPrice}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="flex-1 border-slate-200 dark:border-gray-850 font-bold text-xs rounded-xl h-11 bg-white dark:bg-zinc-900 text-slate-755 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creating || uploading}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl h-11 shadow-md"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      {uploading ? "Uploading banner..." : "Opening Checkout..."}
                    </>
                  ) : (
                    <>Pay & Request Approval</>
                  )}
                </Button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
