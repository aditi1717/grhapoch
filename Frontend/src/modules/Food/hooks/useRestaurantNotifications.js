import { useEffect, useRef, useState, useCallback, useContext } from 'react';
import io from 'socket.io-client';
import { API_BASE_URL } from '@food/api/config';
import { restaurantAPI } from '@food/api';
const alertSound = '/zomato_sms.mp3';
import { dispatchNotificationInboxRefresh } from '@food/hooks/useNotificationInbox';
import { RestaurantNotificationContext } from '../context/RestaurantNotificationContext';
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const resolveAudioSource = (source) => {
  return source;
}

const supportsBrowserNotifications = () =>
  typeof window !== 'undefined' && typeof Notification !== 'undefined';

const showBrowserBroadcastNotification = async (payload = {}) => {
  if (!supportsBrowserNotifications() || Notification.permission !== 'granted') {
    return;
  }

  const title = payload?.title || 'Notification';
  const body = payload?.message || 'New broadcast notification received.';
  const data = {
    link: payload?.link || '/restaurant',
    targetUrl: payload?.link || '/restaurant',
    broadcastId: payload?.id || payload?.broadcastId || '',
  };

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification(title, {
          body,
          icon: '/logo.png',
          tag: data.broadcastId || `broadcast-${title}`,
          requireInteraction: true,
          data,
        });
        return;
      }
    }

    new Notification(title, {
      body,
      icon: '/logo.png',
      tag: data.broadcastId || `broadcast-${title}`,
      data,
    });
  } catch (error) {
    debugWarn('Error showing browser broadcast notification:', error);
  }
};

const buildRestaurantOrderNotification = (orderData = {}) => {
  const orderId = orderData.orderId || orderData.orderMongoId || 'New';
  const itemCount = Array.isArray(orderData.items) ? orderData.items.length : 0;
  const total = Number(orderData.total || orderData.pricing?.total || 0);

  return {
    title: `New order #${orderId}`,
    body: itemCount > 0
      ? `${itemCount} item${itemCount === 1 ? '' : 's'} - ₹${total.toFixed(2)}`
      : 'A new order is waiting for review',
    tag: `restaurant-order-${orderId}`,
    data: {
      orderId,
      targetUrl: `/restaurant/orders/${orderData.orderMongoId || orderData.orderId || ''}`,
    },
  };
}

const normalizeRestaurantOrderForNotification = (orderData = {}) => ({
  ...orderData,
  orderMongoId: orderData?.orderMongoId || orderData?._id || orderData?.order_mongo_id,
  orderId: orderData?.orderId || orderData?.order_id || orderData?._id,
  total: orderData?.total ?? orderData?.pricing?.total ?? 0,
  customerAddress: orderData?.customerAddress || orderData?.address || orderData?.deliveryAddress,
  paymentMethod: orderData?.paymentMethod || orderData?.payment?.method || null,
});

const triggerWebViewNativeNotification = async (orderData = {}) => {
  if (typeof window === 'undefined') return false;

  const bridgePayload = {
    title: 'New restaurant order',
    body: `Order #${orderData?.orderId || orderData?.orderMongoId || orderData?.id || ''}`.trim(),
    orderId: orderData?.orderId || orderData?.order_id || '',
    orderMongoId: orderData?.orderMongoId || orderData?.order_mongo_id || '',
    targetUrl: `/restaurant/orders/${orderData?.orderMongoId || orderData?.orderId || ''}`,
  };

  try {
    if (
      window.flutter_inappwebview &&
      typeof window.flutter_inappwebview.callHandler === 'function'
    ) {
      const handlerNames = [
        'playNotificationSound',
        'triggerNotificationFeedback',
        'onPushNotification',
      ];

      for (const handlerName of handlerNames) {
        try {
          await window.flutter_inappwebview.callHandler(handlerName, bridgePayload);
          return true;
        } catch {
          // Try next handler name.
        }
      }
    }
  } catch {
    // Ignore bridge failures and fall back to browser/web audio.
  }

  return false;
}


/**
 * Hook for restaurant to receive real-time order notifications with sound
 * @returns {object} - { newOrder, playSound, isConnected }
 */
export const useRestaurantNotifications = () => {
  const context = useContext(RestaurantNotificationContext);
  if (context) return context;
  
  const socketRef = useRef(null);
  const [newOrder, setNewOrder] = useState(null);
  const [newReservation, setNewReservation] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const audioRef = useRef(null);
  const activeOrderRef = useRef(null);
  const alertLoopTimerRef = useRef(null);
  const alertLoopStartedAtRef = useRef(0);
  const userInteractedRef = useRef(false); // Track user interaction for autoplay policy
  const audioUnlockAttemptedRef = useRef(false);
  const [restaurantId, setRestaurantId] = useState(null);
  const lastConnectErrorLogRef = useRef(0);
  const lastAlertAtByOrderRef = useRef(new Map());
  const lastBrowserNotificationAtByOrderRef = useRef(new Map());
  const CONNECT_ERROR_LOG_THROTTLE_MS = 10000;
  const ALERT_LOOP_INTERVAL_MS = 4500;
  const ALERT_LOOP_MAX_MS = 120000;
  const ALERT_DEDUPE_MS = 15000;
  const BROWSER_NOTIFICATION_DEDUPE_MS = 20000;
  const NOTIFICATION_PERMISSION_ASKED_KEY = 'restaurant_notification_permission_asked';

  const getOrderIdentityKey = (orderData = {}) => (
    String(
      orderData?.orderMongoId ||
      orderData?.order_mongo_id ||
      orderData?.orderId ||
      orderData?.order_id ||
      orderData?._id ||
      orderData?.id ||
      ''
    ).trim()
  );

  const isOrderStillNew = (statusValue) => {
    const status = String(statusValue || '').trim().toLowerCase();
    return status === 'created' || status === 'confirmed';
  };

  const getOrderAlertKey = (orderData = {}) => (
    getOrderIdentityKey(orderData)
  );

  const shouldProcessOrderAlert = (orderData = {}) => {
    const key = getOrderAlertKey(orderData);
    if (!key) return true;
    const now = Date.now();
    const last = lastAlertAtByOrderRef.current.get(key) || 0;
    if (now - last < ALERT_DEDUPE_MS) return false;
    lastAlertAtByOrderRef.current.set(key, now);
    return true;
  };

  const shouldShowBrowserNotification = (orderData = {}) => {
    const key = getOrderAlertKey(orderData);
    if (!key) return true;
    const now = Date.now();
    const last = lastBrowserNotificationAtByOrderRef.current.get(key) || 0;
    if (now - last < BROWSER_NOTIFICATION_DEDUPE_MS) return false;
    lastBrowserNotificationAtByOrderRef.current.set(key, now);
    return true;
  };

  const showBackgroundOrderNotification = async (orderData) => {
    if (!shouldShowBrowserNotification(orderData)) {
      return;
    }

    if (!supportsBrowserNotifications() || Notification.permission !== 'granted') {
      return;
    }

    const notificationOptions = buildRestaurantOrderNotification(orderData);

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.showNotification(notificationOptions.title, {
            body: notificationOptions.body,
            tag: notificationOptions.tag,
            renotify: true,
            requireInteraction: true,
            silent: false,
            vibrate: [200, 100, 200, 100, 300],
            icon: '/logo.png',
            data: notificationOptions.data,
          });
          return;
        }
      }

      new Notification(notificationOptions.title, {
        body: notificationOptions.body,
        tag: notificationOptions.tag,
        requireInteraction: true,
        silent: false,
        icon: '/logo.png',
        data: notificationOptions.data,
      });
    } catch (error) {
      debugWarn('Error showing background restaurant notification:', error);
    }
  };

  const showBackgroundReservationNotification = async (bookingData) => {
    if (!supportsBrowserNotifications() || Notification.permission !== 'granted') {
      return;
    }

    const guestName = bookingData?.user?.name || bookingData?.customerName || bookingData?.bookedBy?.name || 'Guest';
    const guestCount = bookingData?.guests || bookingData?.numberOfGuests || 1;
    const timeSlot = bookingData?.timeSlot || '';

    try {
      const title = '🍽️ New Table Booking!';
      const body = `${guestName} has booked a table for ${guestCount} guest${guestCount > 1 ? 's' : ''} at ${timeSlot}.`;
      const tag = `restaurant-booking-${bookingData?._id || Date.now()}`;

      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.showNotification(title, {
            body,
            tag,
            renotify: true,
            requireInteraction: true,
            silent: false,
            vibrate: [200, 100, 200, 100, 300],
            icon: '/logo.png',
            data: { targetUrl: '/restaurant' },
          });
          return;
        }
      }

      new Notification(title, {
        body,
        tag,
        requireInteraction: true,
        silent: false,
        icon: '/logo.png',
        data: { targetUrl: '/restaurant' },
      });
    } catch (error) {
      debugWarn('Error showing background reservation notification:', error);
    }
  };

  const stopAlertLoop = () => {
    if (alertLoopTimerRef.current) {
      clearInterval(alertLoopTimerRef.current);
      alertLoopTimerRef.current = null;
    }
    alertLoopStartedAtRef.current = 0;
  };

  const startAlertLoop = () => {
    stopAlertLoop();
    alertLoopStartedAtRef.current = Date.now();

    alertLoopTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - alertLoopStartedAtRef.current;
      if (elapsed >= ALERT_LOOP_MAX_MS || !activeOrderRef.current) {
        stopAlertLoop();
        return;
      }

      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        playNotificationSound(activeOrderRef.current);
      }
    }, ALERT_LOOP_INTERVAL_MS);
  };

  const handleIncomingOrderAlert = (orderData, source = 'unknown') => {
    const isSocket = source === 'socket';
    
    if (orderData?.scheduledAt) {
      const scheduledTime = new Date(orderData.scheduledAt).getTime();
      const now = Date.now();
      const isDueSoon = scheduledTime <= now + 15 * 60000;
      
      if (!isDueSoon) {
        return false;
      }
    }

    const deduped = !shouldProcessOrderAlert(orderData);
    
    if (deduped && !isSocket) {
      return false;
    }

    activeOrderRef.current = orderData || { id: Date.now() };

    const isTabHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    if (isSocket || isTabHidden) {
      playNotificationSound(orderData);
    }

    startAlertLoop();

    if (isTabHidden) {
      showBackgroundOrderNotification(orderData);
    }

    return true;
  };

  const handleIncomingReservationAlert = (bookingData) => {
    playNotificationSound(bookingData);
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
       showBackgroundReservationNotification(bookingData);
    }
  };

  // Get restaurant ID from API
  useEffect(() => {
    const fetchRestaurantId = async () => {
      try {
        const response = await restaurantAPI.getCurrentRestaurant();
        if (response.data?.success && response.data.data?.restaurant) {
          const restaurant = response.data.data.restaurant;
          const id = restaurant._id?.toString() || restaurant.restaurantId;
          setRestaurantId(id);
        }
      } catch (error) {
        debugError('Error fetching restaurant:', error);
      }
    };
    fetchRestaurantId();
  }, []);

  useEffect(() => {
    const handleAuthChange = () => {
      const token = localStorage.getItem('restaurant_accessToken') || localStorage.getItem('accessToken');
      if (!token) {
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
        stopAlertLoop();
        activeOrderRef.current = null;
        setIsConnected(false);
        setRestaurantId(null);
        setNewOrder(null);
        setNewReservation(null);
        return;
      }

      const fetchRestaurantId = async () => {
        try {
          const response = await restaurantAPI.getCurrentRestaurant();
          if (response.data?.success && response.data.data?.restaurant) {
            const restaurant = response.data.data.restaurant;
            const id = restaurant._id?.toString() || restaurant.restaurantId;
            setRestaurantId(id || null);
          }
        } catch {
          setRestaurantId(null);
        }
      };

      fetchRestaurantId();
    };

    window.addEventListener('restaurantAuthChanged', handleAuthChange);
    return () => {
      window.removeEventListener('restaurantAuthChanged', handleAuthChange);
    };
  }, []);

  useEffect(() => {
    if (!restaurantId) return;

    const ALERT_POLL_MS = 8000;
    let isCancelled = false;

    const pollOrders = async () => {
      if (isCancelled) return;

      try {
        const response = await restaurantAPI.getOrders({ page: 1, limit: 30 });
        const rows =
          response?.data?.data?.orders ||
          response?.data?.data?.data?.orders ||
          [];

        const confirmed = (rows || [])
          .filter((o) => {
            const status = String(o?.status || "").toLowerCase();
            if (status !== "confirmed") return false;

            if (o.scheduledAt) {
              const scheduledTime = new Date(o.scheduledAt).getTime();
              const now = Date.now();
              return scheduledTime <= now + 30 * 60000;
            }

            return true;
          })
          .sort((a, b) => {
            const at = a?.updatedAt || a?.createdAt || 0;
            const bt = b?.updatedAt || b?.createdAt || 0;
            return new Date(bt).getTime() - new Date(at).getTime();
          });

        const activeOrderKey = getOrderIdentityKey(activeOrderRef.current || newOrder);
        if (activeOrderKey) {
          const latestActiveOrder = (rows || []).find(
            (o) => getOrderIdentityKey(o) === activeOrderKey,
          );
          if (
            latestActiveOrder &&
            !isOrderStillNew(latestActiveOrder?.orderStatus || latestActiveOrder?.status)
          ) {
            stopAlertLoop();
            activeOrderRef.current = null;
            setNewOrder(null);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('restaurantOrderStatusUpdate', {
                  detail: latestActiveOrder || {},
                }),
              );
            }
          }
        }

        if (confirmed.length > 0) {
          confirmed.slice(0, 5).forEach((order) => {
            const normalizedOrder = normalizeRestaurantOrderForNotification(order);
            if (handleIncomingOrderAlert(normalizedOrder, 'poll')) {
              setNewOrder(normalizedOrder);
            }
          });
        }
      } catch (error) {
        // Non-blocking: keep polling.
      }
    };

    pollOrders();
    const intervalId = setInterval(pollOrders, ALERT_POLL_MS);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [restaurantId]);

  useEffect(() => {
    if (!supportsBrowserNotifications()) return;

    if (Notification.permission !== 'default') return;
    if (localStorage.getItem(NOTIFICATION_PERMISSION_ASKED_KEY) === 'true') return;

    const requestPermissionOnce = async () => {
      localStorage.setItem(NOTIFICATION_PERMISSION_ASKED_KEY, 'true');
      try {
        await Notification.requestPermission();
      } catch (error) {
        debugWarn('Failed to request restaurant notification permission:', error);
      }
    };

    const askOnInteraction = () => {
      requestPermissionOnce();
      window.removeEventListener('pointerdown', askOnInteraction);
      window.removeEventListener('keydown', askOnInteraction);
    };

    window.addEventListener('pointerdown', askOnInteraction, { once: true, passive: true });
    window.addEventListener('keydown', askOnInteraction, { once: true });

    return () => {
      window.removeEventListener('pointerdown', askOnInteraction);
      window.removeEventListener('keydown', askOnInteraction);
    };
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      
      if (document.visibilityState === 'visible') {
        stopAlertLoop();
      } else if (document.visibilityState === 'hidden' && activeOrderRef.current) {
        playNotificationSound(activeOrderRef.current);
        showBackgroundOrderNotification(activeOrderRef.current);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!API_BASE_URL || !String(API_BASE_URL).trim()) {
      setIsConnected(false);
      return;
    }
    if (!restaurantId) {
      debugLog('? Waiting for restaurantId...');
      return;
    }

    let backendUrl = API_BASE_URL;
    
    try {
      const urlObj = new URL(backendUrl);
      let pathname = urlObj.pathname.replace(/^\/api\/?$/, '');
      backendUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? `:${urlObj.port}` : ''}${pathname}`;
    } catch (e) {
      backendUrl = backendUrl.replace(/\/api\/?$/, '');
      backendUrl = backendUrl.replace(/\/+$/, '');
      
      if (backendUrl.startsWith('https:') || backendUrl.startsWith('http:')) {
        const protocolMatch = backendUrl.match(/^(https?):/i);
        if (protocolMatch) {
          const protocol = protocolMatch[1].toLowerCase();
          const afterProtocol = backendUrl.substring(protocol.length + 1);
          const cleanPath = afterProtocol.replace(/^\/+/, '');
          backendUrl = `${protocol}://${cleanPath}`;
        }
      }
    }
    
    backendUrl = backendUrl.replace(/^(https?):\/+/gi, '$1://');
    backendUrl = backendUrl.replace(/\/+$/, '');
    
    const frontendHostname = window.location.hostname;
    const isLocalhost = frontendHostname === 'localhost' || 
                        frontendHostname === '127.0.0.1' ||
                        frontendHostname === '';
    const isProductionBuild = import.meta.env.MODE === 'production' || import.meta.env.PROD;
    const isProductionDeployment = !isLocalhost && (
      window.location.protocol === 'https:' || 
      (frontendHostname.includes('.') && !frontendHostname.startsWith('192.168.') && !frontendHostname.startsWith('10.'))
    );
    
    const backendIsLocalhost = backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1');
    const shouldBlockConnection = backendIsLocalhost && (isProductionBuild || isProductionDeployment) && !isLocalhost;
    
    if (shouldBlockConnection) {
      const frontendHost = window.location.hostname;
      const frontendProtocol = window.location.protocol;
      let suggestedBackendUrl = null;
      
      if (frontendHost.includes('foods.truorder.com')) {
        suggestedBackendUrl = `${frontendProtocol}//api.foods.truorder.com/api`;
      } else if (frontendHost.includes('truorder.com')) {
        suggestedBackendUrl = `${frontendProtocol}//api.${frontendHost}/api`;
      }
      
      debugError('? CRITICAL: BLOCKING Socket.IO connection to localhost!');
      debugError('Backend connectivity disabled (UI-only mode).');
      
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      setIsConnected(false);
      return;
    }
    
    if (!backendUrl || !backendUrl.startsWith('http')) {
      setIsConnected(false);
      return;
    }
    
    let socketOrigin = backendUrl;
    try {
      socketOrigin = new URL(backendUrl).origin;
    } catch {
      socketOrigin = String(backendUrl || "")
        .replace(/\/api\/v\d+\/?$/i, "")
        .replace(/\/api\/?$/i, "")
        .replace(/\/+$/, "");
    }

    const socketUrl = `${socketOrigin}`;
    
    try {
      const urlTest = new URL(socketUrl);
      if ((isProductionBuild || isProductionDeployment) && (urlTest.hostname === 'localhost' || urlTest.hostname === '127.0.0.1')) {
        setIsConnected(false);
        return;
      }
    } catch (urlError) {
      setIsConnected(false);
      return;
    }
    
    socketRef.current = io(socketUrl, {
      path: '/socket.io/',
      transports: ['polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
      forceNew: false,
      autoConnect: true,
      auth: {
        token: localStorage.getItem('restaurant_accessToken') || localStorage.getItem('accessToken')
      }
    });

    socketRef.current.on('connect', () => {
      setIsConnected(true);
      
      if (restaurantId) {
        const joinRoom = () => {
          socketRef.current.emit('join-restaurant', restaurantId);
          
          setTimeout(() => {
            if (socketRef.current?.connected) {
              socketRef.current.emit('join-restaurant', restaurantId);
            }
          }, 2000);
        };
        
        joinRoom();
      }
    });

    socketRef.current.on('restaurant-room-joined', (data) => {
      debugLog('? Restaurant room joined successfully:', data);
    });

    socketRef.current.on('connect_error', (error) => {
      const now = Date.now();
      const shouldLog = now - lastConnectErrorLogRef.current >= CONNECT_ERROR_LOG_THROTTLE_MS;
      if (shouldLog) {
        lastConnectErrorLogRef.current = now;
        const isTransportError = error.type === 'TransportError' || error.message?.includes('xhr poll error');
      }
      setIsConnected(false);
    });

    socketRef.current.on('disconnect', (reason) => {
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        socketRef.current.connect();
      }
    });

    socketRef.current.on('reconnect_attempt', (attemptNumber) => {
      debugLog(`?? Reconnection attempt ${attemptNumber}...`);
    });

    socketRef.current.on('reconnect', (attemptNumber) => {
      setIsConnected(true);
      if (restaurantId) {
        socketRef.current.emit('join-restaurant', restaurantId);
      }
    });

    socketRef.current.on('new_order', (orderData) => {
      const normalizedOrder = normalizeRestaurantOrderForNotification(orderData);

      if (normalizedOrder.scheduledAt) {
        const scheduledTime = new Date(normalizedOrder.scheduledAt).getTime();
        const now = Date.now();
        if (scheduledTime > now + 15 * 60000) {
          return;
        }
      }

      setNewOrder(normalizedOrder);
      handleIncomingOrderAlert(normalizedOrder, 'socket');
    });
    
    socketRef.current.on('new_dining_booking', (bookingData) => {
      setNewReservation(bookingData);
      handleIncomingReservationAlert(bookingData);
    });

    socketRef.current.on('play_notification_sound', (data) => {
      const normalizedData = {
        orderId: data?.orderId || data?.order_id,
        orderMongoId: data?.orderMongoId || data?.order_mongo_id,
        ...data
      };
      handleIncomingOrderAlert(normalizedData, 'socket');
    });

    socketRef.current.on('order_status_update', (data) => {
      const activeOrderKey = getOrderIdentityKey(newOrder || activeOrderRef.current);
      const updatedOrderKey = getOrderIdentityKey(data);
      const updatedStatus = String(data?.orderStatus || data?.status || '').trim();

      if (
        activeOrderKey &&
        updatedOrderKey &&
        activeOrderKey === updatedOrderKey &&
        !isOrderStillNew(updatedStatus)
      ) {
        stopAlertLoop();
        activeOrderRef.current = null;
        setNewOrder(null);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('restaurantOrderStatusUpdate', {
            detail: data || {},
          }),
        );
      }
    });

    socketRef.current.on('admin_notification', (payload) => {
      void showBrowserBroadcastNotification(payload);
      dispatchNotificationInboxRefresh();
    });

    audioRef.current = new Audio(resolveAudioSource(alertSound));
    audioRef.current.preload = 'auto';
    audioRef.current.volume = 1;

    return () => {
      stopAlertLoop();
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [newOrder, restaurantId]);

  useEffect(() => {
    const handleUserInteraction = async () => {
      userInteractedRef.current = true;

      if (!audioRef.current) {
        audioRef.current = new Audio(resolveAudioSource(alertSound));
        audioRef.current.preload = 'auto';
        audioRef.current.volume = 1;
      }

      if (!audioUnlockAttemptedRef.current && audioRef.current) {
        audioUnlockAttemptedRef.current = true;
        try {
          audioRef.current.muted = true;
          await audioRef.current.play();
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        } catch (error) {
          audioUnlockAttemptedRef.current = false;
        } finally {
          if (audioRef.current) {
            audioRef.current.muted = false;
          }
        }
      }

      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('pointerdown', handleUserInteraction);
    };
    
    document.addEventListener('click', handleUserInteraction, { once: true });
    document.addEventListener('touchstart', handleUserInteraction, { once: true });
    document.addEventListener('keydown', handleUserInteraction, { once: true });
    window.addEventListener('pointerdown', handleUserInteraction, { once: true, passive: true });
    
    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('pointerdown', handleUserInteraction);
    };
  }, []);

  const playNotificationSound = async (orderData = {}) => {
    try {
      const usedNativeBridge = await triggerWebViewNativeNotification(orderData);
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([200, 100, 200, 100, 300]);
      }
      if (usedNativeBridge) {
        return;
      }

      if (audioRef.current) {
        audioRef.current.muted = false;
        audioRef.current.volume = 1;
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(error => {
          if (!error.message?.includes('user didn\'t interact') && !error.name?.includes('NotAllowedError')) {
            try {
              const fallbackAudio = new Audio(resolveAudioSource(alertSound, `restaurant-alert-${Date.now()}`));
              fallbackAudio.volume = 1;
              fallbackAudio.play().catch(() => {});
            } catch (fallbackError) {
              // Ignore fallback failures
            }
          }
        });
      }
    } catch (error) {
      // Ignore autoplay errors
    }
  };

  const clearNewOrder = () => {
    stopAlertLoop();
    activeOrderRef.current = null;
    setNewOrder(null);
  };

  return {
    newOrder,
    newReservation,
    clearNewOrder,
    clearNewReservation: () => {
      setNewReservation(null);
    },
    isConnected,
    playNotificationSound
  };
};
