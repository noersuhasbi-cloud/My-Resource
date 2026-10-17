/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { HeritageStory } from './components/HeritageStory';
import { StoreLocations } from './components/StoreLocations';
import { ProductCatalog } from './components/ProductCatalog';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { CustomerPortal } from './components/CustomerPortal';
import { Footer } from './components/Footer';
import { ToastContainer, ToastMessage } from './components/Toast';

import { CartItem, Product, StoreLocation, CustomerAccount, Order, OrderStatus, StoreOperationalStatus, UserRole, StaffShiftSession } from './types';
import { STORE_LOCATIONS, PRODUCTS, INITIAL_DEMO_ACCOUNT, INITIAL_ORDERS } from './data/mockData';
import { auth } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  saveOrderToFirestore,
  updateOrderStatusInFirestore,
  subscribeToUserOrders,
  initOrUpdateUserProfile,
  logoutFirebase,
} from './services/firebaseService';
import { AdminDashboard } from './components/AdminDashboard/AdminDashboard';
import { AdminLogin } from './components/AdminLogin';
import { apiClient } from './services/apiClient';

type PortalView = 'customer' | 'admin_login' | 'admin_erp';

export default function App() {
  // Portal & Role View Separation ('customer' storefront vs 'admin_login' gate vs 'admin_erp' portal)
  const [adminSession, setAdminSession] = useState<StaffShiftSession | null>(() => {
    try {
      const saved = localStorage.getItem('grocemart_admin_session');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  const [portalView, setPortalView] = useState<PortalView>(() => {
    try {
      const hash = window.location.hash;
      const saved = localStorage.getItem('grocemart_admin_session');
      if (hash === '#admin' || hash === '#erp' || hash === '#staff') {
        return saved ? 'admin_erp' : 'admin_login';
      }
      if (hash === '#admin-login') return 'admin_login';
    } catch {}
    return 'customer';
  });

  // Keep portal view in sync with URL hash
  useEffect(() => {
    const handleHashSync = () => {
      const hash = window.location.hash;
      if (hash === '#admin' || hash === '#erp' || hash === '#staff') {
        const saved = localStorage.getItem('grocemart_admin_session');
        if (saved) {
          try {
            setAdminSession(JSON.parse(saved));
          } catch {}
          setPortalView('admin_erp');
        } else {
          setPortalView('admin_login');
        }
      } else if (hash === '#admin-login') {
        setPortalView('admin_login');
      } else if (!hash || hash === '#storefront' || hash === '#home') {
        setPortalView('customer');
      }
    };

    window.addEventListener('hashchange', handleHashSync);
    return () => window.removeEventListener('hashchange', handleHashSync);
  }, []);

  const [storeStatus, setStoreStatus] = useState<StoreOperationalStatus | null>(null);

  // Sync store operational status from backend
  useEffect(() => {
    apiClient.getStoreStatus().then(setStoreStatus).catch((err) => {
      console.warn('Backend store status notice:', err);
    });
  }, []);

  // 1. Toast notifications state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (title: string, message?: string, image?: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, title, message, image }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // 1. Cart state with localStorage
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('grocemart_cart');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // Fallback
    }
    // Initial friendly default basket (Butterhead lettuce & Sourdough loaf)
    return [
      { product: PRODUCTS[0], quantity: 1 },
      { product: PRODUCTS[3], quantity: 1 },
    ];
  });

  // 2. Customer account state with localStorage
  const [customerAccount, setCustomerAccount] = useState<CustomerAccount | null>(() => {
    try {
      const saved = localStorage.getItem('grocemart_customer');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // Fallback
    }
    return INITIAL_DEMO_ACCOUNT;
  });

  // 3. Orders state with localStorage
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem('grocemart_orders');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // Fallback
    }
    return INITIAL_ORDERS;
  });

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profile = await initOrUpdateUserProfile(firebaseUser);
          setCustomerAccount(profile);
          showToast(`Logged in as ${profile.name}`, `Firebase Firestore synced (${profile.email})`);
        } catch (err) {
          console.error('Error initializing user profile in Firestore:', err);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Listen to Firestore real-time orders if user has Firebase UID
  useEffect(() => {
    if (!customerAccount || !auth.currentUser) return;
    const unsubOrders = subscribeToUserOrders(auth.currentUser.uid, (firestoreOrders) => {
      if (firestoreOrders.length > 0) {
        setOrders(firestoreOrders);
      }
    });
    return () => unsubOrders();
  }, [customerAccount]);

  // 4. Modals & Drawers state
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [isPortalOpen, setIsPortalOpen] = useState<boolean>(false);
  const [trackingOrderId, setTrackingOrderId] = useState<string | undefined>(undefined);

  // 5. Store & Delivery preferences
  const [selectedPickupStore, setSelectedPickupStore] = useState<StoreLocation>(STORE_LOCATIONS[0]);
  const [deliveryMethod, setDeliveryMethod] = useState<'instant' | 'scheduled' | 'pickup'>('instant');
  const [voucherCode, setVoucherCode] = useState<string>('');
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);

  // 6. Navigation active section
  const [activeSection, setActiveSection] = useState<string>('hero');

  // Persist cart
  useEffect(() => {
    try {
      localStorage.setItem('grocemart_cart', JSON.stringify(cartItems));
    } catch (e) {}
  }, [cartItems]);

  // Persist customer account
  useEffect(() => {
    try {
      if (customerAccount) {
        localStorage.setItem('grocemart_customer', JSON.stringify(customerAccount));
      } else {
        localStorage.removeItem('grocemart_customer');
      }
    } catch (e) {}
  }, [customerAccount]);

  // Persist orders
  useEffect(() => {
    try {
      localStorage.setItem('grocemart_orders', JSON.stringify(orders));
    } catch (e) {}
  }, [orders]);

  // Cart operations
  const handleAddToCart = (product: Product, quantity: number = 1) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(productId);
      return;
    }
    setCartItems((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleApplyVoucher = (code: string) => {
    if (code === 'GROCEFRESH') {
      setVoucherCode('GROCEFRESH');
      setAppliedDiscount(10000);
      showToast('Voucher Applied: GROCEFRESH', 'Rp 10.000 discount applied to order');
      return { success: true, message: 'Voucher GROCEFRESH applied: Rp 10.000 off your order!' };
    }
    if (code === 'FREEDELIVERY') {
      setVoucherCode('FREEDELIVERY');
      setAppliedDiscount(15000);
      showToast('Voucher Applied: FREEDELIVERY', 'Free courier delivery waiver active');
      return { success: true, message: 'Voucher FREEDELIVERY applied: Free delivery waiver active!' };
    }
    return { success: false, message: 'Invalid voucher code. Try GROCEFRESH or FREEDELIVERY.' };
  };

  const handleRemoveVoucher = () => {
    setVoucherCode('');
    setAppliedDiscount(0);
    showToast('Voucher Removed', 'Order recalculated at standard rate');
  };

  const handleProceedToCheckout = () => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const handleOrderSuccess = (newOrder: Order) => {
    setOrders((prev) => [newOrder, ...prev]);

    // Reward loyalty points to customer
    if (customerAccount) {
      const earnedPoints = Math.floor(newOrder.total / 1000);
      setCustomerAccount({
        ...customerAccount,
        grocePoints: customerAccount.grocePoints + earnedPoints,
      });
      showToast('Order Paid with QRIS!', `Earned +${earnedPoints} GrocePoints for this order!`);
    } else {
      showToast('Order Paid with QRIS!', `Order #${newOrder.id} confirmed!`);
      // Auto-create customer profile for verified tracking access
      if (newOrder.customerEmail) {
        setCustomerAccount({
          id: newOrder.userId || `cust-${Date.now().toString().slice(-4)}`,
          name: newOrder.customerName || 'Customer',
          email: newOrder.customerEmail,
          phone: newOrder.customerPhone || '+62 812 0000 0000',
          memberTier: 'Silver Member',
          grocePoints: Math.floor(newOrder.total / 1000),
          memberSince: 'Today',
          savedAddresses: newOrder.deliveryAddress ? [
            {
              id: 'addr-default',
              label: newOrder.deliveryAddress.label || 'Home',
              recipient: newOrder.deliveryAddress.recipient || newOrder.customerName,
              phone: newOrder.deliveryAddress.phone || newOrder.customerPhone,
              addressLine: newOrder.deliveryAddress.addressLine || '',
              city: newOrder.deliveryAddress.city || 'Jakarta',
              postalCode: '10220',
              isDefault: true,
            }
          ] : []
        });
      }
    }

    // Persist to Firestore
    saveOrderToFirestore(newOrder, customerAccount?.id).catch((e) => {
      console.warn('Could not sync order to Firestore (local state preserved):', e);
    });

    // Clear cart & voucher
    setCartItems([]);
    setVoucherCode('');
    setAppliedDiscount(0);
  };

  const handleOpenOrderTracking = (orderId: string) => {
    setTrackingOrderId(orderId);
    setIsPortalOpen(true);
  };

  const handleReorder = (order: Order) => {
    setCartItems(order.items);
    setIsCartOpen(true);
  };

  const handleUpdateOrderStatus = (orderId: string, nextStatus: OrderStatus) => {
    let updatedOrders: Order[] = [];
    setOrders((prev) => {
      updatedOrders = prev.map((ord) => {
        if (ord.id !== orderId) return ord;

        const updatedTimeline = ord.timeline.map((step) => {
          if (
            step.status === nextStatus ||
            (nextStatus === 'ready_for_pickup' && (step.status === 'ready_for_pickup' || step.status === 'in_transit')) ||
            (nextStatus === 'in_transit' && (step.status === 'ready_for_pickup' || step.status === 'in_transit'))
          ) {
            return {
              ...step,
              completed: true,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
          }
          return step;
        });

        return {
          ...ord,
          status: nextStatus,
          timeline: updatedTimeline,
        };
      });
      return updatedOrders;
    });

    // Update in Firestore
    const changed = updatedOrders.find((o) => o.id === orderId);
    if (changed) {
      updateOrderStatusInFirestore(orderId, nextStatus, changed.timeline, changed).catch((e) => {
        console.warn('Could not sync status to Firestore (local state updated):', e);
      });
    }
  };

  // Smooth scroll handler
  const handleNavigate = (sectionId: string) => {
    setActiveSection(sectionId);
    if (sectionId === 'tracking') {
      setIsPortalOpen(true);
      return;
    }
    const elem = document.getElementById(sectionId);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleAdminLoginSuccess = (session: StaffShiftSession) => {
    setAdminSession(session);
    try {
      localStorage.setItem('grocemart_admin_session', JSON.stringify(session));
    } catch {}
    window.location.hash = '#admin';
    setPortalView('admin_erp');
  };

  const handleAdminLogout = () => {
    setAdminSession(null);
    try {
      localStorage.removeItem('grocemart_admin_session');
    } catch {}
    apiClient.adminLogout().catch(() => {});
    window.location.hash = '#admin-login';
    setPortalView('admin_login');
    showToast('ERP Workstation Locked', 'Session ended. Log in to regain access.');
  };

  const handleExitToStorefront = () => {
    window.location.hash = '';
    setPortalView('customer');
  };

  // 1. DEDICATED ADMIN LOGIN SCREEN (AUTHENTICATION GATE)
  if (portalView === 'admin_login') {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans selection:bg-emerald-700 selection:text-white">
        <AdminLogin
          onLoginSuccess={handleAdminLoginSuccess}
          onReturnToStorefront={handleExitToStorefront}
          onShowToast={showToast}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  // 2. ADMIN ERP PORTAL (LOCKED BEHIND AUTHENTICATION GATE)
  if (portalView === 'admin_erp') {
    // If not authenticated, force redirect to Login Gate
    if (!adminSession) {
      return (
        <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans selection:bg-emerald-700 selection:text-white">
          <AdminLogin
            onLoginSuccess={handleAdminLoginSuccess}
            onReturnToStorefront={handleExitToStorefront}
            onShowToast={showToast}
          />
          <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col font-sans selection:bg-emerald-700 selection:text-white">
        <AdminDashboard
          initialStaffSession={adminSession}
          onCloseToStorefront={handleExitToStorefront}
          onLogout={handleAdminLogout}
          onShowToast={showToast}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  // 3. PUBLIC CUSTOMER STOREFRONT
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col font-sans selection:bg-emerald-800 selection:text-white">
      {/* Top Navigation - Customer only, completely removed Admin HQ shortcut */}
      <Header
        cartItems={cartItems}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenPortal={() => setIsPortalOpen(true)}
        storeStatus={storeStatus}
        activeSection={activeSection}
        onNavigate={handleNavigate}
        isLoggedIn={!!customerAccount}
        customerName={customerAccount?.name}
        memberTier={customerAccount?.memberTier}
      />

      <main className="flex-1">
        {/* Hero Section */}
        <HeroSection
          onNavigateToCatalog={() => handleNavigate('catalog')}
          onNavigateToStores={() => handleNavigate('stores')}
          onNavigateToStory={() => handleNavigate('story')}
        />

        {/* Heritage & 28-Year Story Section */}
        <HeritageStory />

        {/* Store Locations Directory */}
        <StoreLocations
          selectedPickupStore={selectedPickupStore}
          onSelectPickupStore={(store) => {
            setSelectedPickupStore(store);
          }}
          onShopStoreGroceries={(store) => {
            setSelectedPickupStore(store);
            handleNavigate('catalog');
          }}
        />

        {/* Fresh Groceries Catalog */}
        <ProductCatalog
          cartItems={cartItems}
          onAddToCart={handleAddToCart}
          onUpdateQuantity={handleUpdateQuantity}
          selectedStore={selectedPickupStore}
          onShowToast={showToast}
        />
      </main>

      {/* Corporate & Retail Footer */}
      <Footer
        onNavigate={handleNavigate}
        onOpenPortal={() => setIsPortalOpen(true)}
        onOpenAdminLogin={() => {
          if (adminSession) {
            window.location.hash = '#admin';
            setPortalView('admin_erp');
          } else {
            window.location.hash = '#admin-login';
            setPortalView('admin_login');
          }
        }}
      />

      {/* Toast Feedback Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Cart Drawer Slide-Over */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onProceedToCheckout={handleProceedToCheckout}
        deliveryMethod={deliveryMethod}
        onChangeDeliveryMethod={setDeliveryMethod}
        selectedPickupStore={selectedPickupStore}
        onSelectPickupStore={setSelectedPickupStore}
        voucherCode={voucherCode}
        appliedDiscount={appliedDiscount}
        onApplyVoucher={handleApplyVoucher}
        onRemoveVoucher={handleRemoveVoucher}
        storeStatus={storeStatus}
      />

      {/* QRIS Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        items={cartItems}
        deliveryMethod={deliveryMethod}
        selectedPickupStore={selectedPickupStore}
        appliedDiscount={appliedDiscount}
        voucherCode={voucherCode}
        customerAccount={customerAccount}
        storeStatus={storeStatus}
        onOrderSuccess={handleOrderSuccess}
        onOpenOrderTracking={handleOpenOrderTracking}
      />

      {/* Customer Portal & Live Order Tracking Modal */}
      <CustomerPortal
        isOpen={isPortalOpen}
        onClose={() => {
          setIsPortalOpen(false);
          setTrackingOrderId(undefined);
        }}
        customerAccount={customerAccount}
        onLogin={(acc) => setCustomerAccount(acc)}
        onLogout={() => {
          setCustomerAccount(null);
          logoutFirebase();
        }}
        onUpdateAccount={(acc) => setCustomerAccount(acc)}
        orders={orders}
        onUpdateOrderStatus={handleUpdateOrderStatus}
        initialTrackingOrderId={trackingOrderId}
        onReorder={handleReorder}
        onAddToCart={handleAddToCart}
      />
    </div>
  );
}
