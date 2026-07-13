import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, User, Phone, CheckCircle2, X } from 'lucide-react';
import AnimatedPage from "@food/components/user/AnimatedPage";
import { authAPI } from "@food/api";

export default function TableEditUserPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, restaurant, guests, date, timeSlot, discount, mealPreference, mealPeriods, specialRequest } = location.state || {};
    
    const [name, setName] = useState(user?.name || "");
    const [phone, setPhone] = useState(user?.phone || "");
    const [loading, setLoading] = useState(false);
    
    const handleNameChange = (e) => {
        const value = e.target.value;
        const filteredValue = value.replace(/[^a-zA-Z\s]/g, "");
        setName(filteredValue);
    };
    
    const handlePhoneChange = (e) => {
        const value = e.target.value;
        const filteredValue = value.replace(/\D/g, "").slice(0, 10);
        setPhone(filteredValue);
    };
    
    const isValidName = name.trim().length > 0;
    const isValidPhone = phone.length === 10;

    // Fetch user details from backend starting on mount if they are not already provided
    useEffect(() => {
        const fetchUserData = async () => {
            if (!name || !phone) {
                try {
                    setLoading(true);
                    const response = await authAPI.getCurrentUser();
                    if (response.data.success) {
                        const userData =
                            response?.data?.data?.user ||
                            response?.data?.data ||
                            response?.data?.user ||
                            null;
                        if (userData) {
                            if (!name && userData.name) setName(userData.name);
                            if (!phone && userData.phone) setPhone(userData.phone);
                        }
                    }
                } catch (err) {
                    console.error("Error fetching user on edit page:", err);
                } finally {
                    setLoading(false);
                }
            }
        };
        fetchUserData();
    }, [user]);

    const handleSave = () => {
        navigate("/food/user/dining/book-confirmation", {
            state: {
                restaurant,
                guests,
                date,
                timeSlot,
                discount,
                mealPreference,
                mealPeriods,
                specialRequest,
                user: { ...user, name, phone }
            },
            replace: true
        });
    };

    return (
        <AnimatedPage className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 transition-colors">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 transition-colors">
                <div className="max-w-lg mx-auto px-4 h-12 flex items-center gap-3">
                    <button 
                        onClick={() => navigate(-1)} 
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-900 dark:text-slate-100" />
                    </button>
                    <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight uppercase">Edit Contact Details</h1>
                </div>
            </div>

            <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
                {/* Compact Info Section */}
                <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-50 dark:bg-red-950/30 text-red-500 rounded-lg flex items-center justify-center shrink-0">
                        <User className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Personalize Booking</h2>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Contact details for table reservation</p>
                    </div>
                </div>

                {/* Form Fields */}
                <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-100 dark:border-slate-800 space-y-3">
                    {/* Name Input */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-widest ml-1">Full Name</label>
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                                <User className="w-4 h-4" />
                            </div>
                            <input 
                                type="text"
                                value={name}
                                onChange={handleNameChange}
                                placeholder="Enter your full name"
                                className={`w-full h-10 pl-9 pr-3 bg-slate-50 dark:bg-slate-800/50 border rounded-lg font-semibold text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/10 transition-all placeholder:text-slate-350 dark:placeholder:text-slate-650 ${name && !isValidName ? "border-red-500" : "border-slate-100 dark:border-slate-800 focus:border-red-500"}`}
                            />
                        </div>
                        {name && !isValidName && (
                            <p className="text-[10px] text-red-500 font-medium ml-1">Name cannot be empty</p>
                        )}
                    </div>

                    {/* Phone Input */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-widest ml-1">Mobile Number</label>
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-550">
                                <Phone className="w-4 h-4" />
                            </div>
                            <input 
                                type="tel"
                                value={phone}
                                onChange={handlePhoneChange}
                                placeholder="Enter 10 digit mobile number"
                                maxLength={10}
                                className={`w-full h-10 pl-9 pr-3 bg-slate-50 dark:bg-slate-800/50 border rounded-lg font-semibold text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500/10 transition-all placeholder:text-slate-350 dark:placeholder:text-slate-650 ${phone && !isValidPhone ? "border-red-500" : "border-slate-100 dark:border-slate-800 focus:border-red-500"}`}
                            />
                        </div>
                        {phone && !isValidPhone && (
                            <p className="text-[10px] text-red-500 font-medium ml-1">Please enter a valid 10 digit mobile number</p>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                    <button 
                        onClick={() => navigate(-1)}
                        className="h-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg font-bold text-xs uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-1.5"
                    >
                        <X className="w-4 h-4" />
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={loading || !isValidName || !isValidPhone}
                        className="h-10 bg-red-500 text-white rounded-lg font-bold text-xs uppercase tracking-wider shadow-md shadow-red-200 dark:shadow-none active:scale-95 transition-all flex items-center justify-center gap-1.5 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        {loading ? "Loading..." : "Save"}
                    </button>
                </div>
            </div>
        </AnimatedPage>
    );
}
