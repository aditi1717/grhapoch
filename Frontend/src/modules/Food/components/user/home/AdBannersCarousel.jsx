import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdBannersCarousel = ({ ads = [] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const autoSlideIntervalRef = useRef(null);
  const navigate = useNavigate();

  const startAutoSlide = useCallback(() => {
    if (autoSlideIntervalRef.current) clearInterval(autoSlideIntervalRef.current);
    if (ads.length <= 1) return;

    autoSlideIntervalRef.current = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      setCurrentIndex((prev) => (prev + 1) % ads.length);
    }, 5000);
  }, [ads.length]);

  useEffect(() => {
    startAutoSlide();
    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        startAutoSlide();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      if (autoSlideIntervalRef.current) clearInterval(autoSlideIntervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [startAutoSlide]);

  const handleNext = (e) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % ads.length);
    startAutoSlide();
  };

  const handlePrev = (e) => {
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + ads.length) % ads.length);
    startAutoSlide();
  };

  const handleAdClick = (ad) => {
    if (!ad) return;
    if (ad.targetType === 'restaurant' && ad.targetId) {
      navigate(`/user/restaurants/${ad.targetId}`);
    } else if (ad.targetType === 'url' && ad.targetUrl) {
      window.open(ad.targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (!ads.length) return null;

  return (
    <div className="px-4 py-3 relative group">
      <div className="relative overflow-hidden rounded-[24px] shadow-md aspect-[21/9] sm:aspect-[24/9]">
        <AnimatePresence mode="wait">
          <motion.div
            key={ads[currentIndex]?._id || currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="w-full h-full cursor-pointer relative"
            onClick={() => handleAdClick(ads[currentIndex])}
          >
            <img 
              src={ads[currentIndex]?.image} 
              alt={ads[currentIndex]?.title || "Sponsored Advertisement"} 
              className="w-full h-full object-cover"
            />
            {/* Sponsored Badge overlay */}
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-[9px] font-black tracking-wider text-white uppercase px-2.5 py-0.5 rounded-md border border-white/10 z-10">
              Sponsored
            </div>

            {ads[currentIndex]?.title && (
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 pt-12 z-10">
                <p className="text-white text-xs font-bold sm:text-sm drop-shadow-sm truncate">
                  {ads[currentIndex].title}
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows */}
        {ads.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 backdrop-blur-md text-white opacity-0 group-hover:opacity-100 transition-opacity z-20"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 backdrop-blur-md text-white opacity-0 group-hover:opacity-100 transition-opacity z-20"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Indicators */}
        {ads.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
            {ads.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentIndex ? "w-6 bg-white" : "w-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdBannersCarousel;
