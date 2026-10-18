import React, { useState, useEffect } from 'react';
import type { CartItem, CustomerAccount, Order, StoreLocation, OrderTimelineStep, StoreOperationalStatus } from '../types/index.ts';
import { formatIDR, generateOrderId, generateQrisReference } from '../utils/formatters';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { X, CheckCircle, QrCode, Truck, Store, Clock, ArrowRight, ShieldCheck, Download, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react';
import { apiClient } from '../services/apiClient';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  deliveryMethod: 'instant' | 'scheduled' | 'pickup';
  selectedPickupStore?: StoreLocation;
  appliedDiscount: number;
  voucherCode?: string;
  customerAccount?: CustomerAccount | null;
  storeStatus?: StoreOperationalStatus | null;
  onOrderSuccess: (order: Order) => void;
  onOpenOrderTracking: (orderId: string) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  deliveryMethod,
  selectedPickupStore,
  appliedDiscount,
  voucherCode,
  customerAccount,
  storeStatus,
  onOrderSuccess,
  onOpenOrderTracking,
}) => {
  // Step: 'details' -> 'qris_payment' -> 'success'
  const [step, setStep] = useState<'details' | 'qris_payment' | 'success'>('details');

  // Customer form details
  const [recipientName, setRecipientName] = useState<string>(customerAccount?.name || 'Sarah Wijaya');
  const [recipientEmail, setRecipientEmail] = useState<string>(customerAccount?.email || 'sarah.wijaya@example.com');
  const [recipientPhone, setRecipientPhone] = useState<string>(customerAccount?.phone || '+62 812 8899 4432');
  const [addressLine, setAddressLine] = useState<string>(
    customerAccount?.savedAddresses[0]?.addressLine || 'Jl. Suryo No. 42A, Kebayoran Baru, Jakarta Selatan'
  );
  const [deliveryNotes, setDeliveryNotes] = useState<string>('Please leave at front door / security guard.');
  const [deliverySlot, setDeliverySlot] = useState<string>('Immediate (within 45-60 mins)');

  // QRIS Payment state
  const [currentOrderId, setCurrentOrderId] = useState<string>('');
  const [qrisReference, setQrisReference] = useState<string>('');
  const [qrisPayloadString, setQrisPayloadString] = useState<string>('');
  const [qrisCountdownSeconds, setQrisCountdownSeconds] = useState<number>(900); // 15 minutes
  const [isSimulatingPayment, setIsSimulatingPayment] = useState<boolean>(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  // Sync customer account updates
  useEffect(() => {
    if (customerAccount) {
      setRecipientName(customerAccount.name);
      setRecipientEmail(customerAccount.email);
      setRecipientPhone(customerAccount.phone);
      if (customerAccount.savedAddresses.length > 0) {
        setAddressLine(customerAccount.savedAddresses[0].addressLine);
      }
    }
  }, [customerAccount]);

  // QRIS Countdown timer
  useEffect(() => {
    let timer: any = null;
    if (step === 'qris_payment' && qrisCountdownSeconds > 0) {
      timer = setInterval(() => {
        setQrisCountdownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [step, qrisCountdownSeconds]);

  if (!isOpen) return null;

  const subtotal = items.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const deliveryFee = deliveryMethod === 'pickup' ? 0 : deliveryMethod === 'instant' ? 15000 : 10000;
  const total = Math.max(0, subtotal + deliveryFee - appliedDiscount);
  const isNetworkClosed = !!(storeStatus && (!storeStatus.isOpen || storeStatus.isHolidayMode));
  const isPickupOutletClosed = !!(deliveryMethod === 'pickup' && selectedPickupStore?.isEmergencyClosed);
  const isStoreClosed = isNetworkClosed || isPickupOutletClosed;
  const storeClosureNotice = isNetworkClosed
    ? (storeStatus?.noticeBanner || 'GroceMart retail storefront network is currently closed. Online checkouts are temporarily paused.')
    : isPickupOutletClosed
    ? `Outlet '${selectedPickupStore?.name}' is under emergency closure (${selectedPickupStore?.closureReason || 'Maintenance'}). Orders cannot be collected from this branch.`
    : '';

  const [blockedNotice, setBlockedNotice] = useState<string>('');

  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleProceedToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isStoreClosed) {
      setBlockedNotice(`Checkout Blocked: ${storeClosureNotice}`);
      return;
    }
    setBlockedNotice('');

    const newOrderId = generateOrderId();
    setCurrentOrderId(newOrderId);

    try {
      // Connect to Open API endpoint on backend
      const res = await apiClient.generateQRIS(newOrderId, total, recipientName, recipientEmail);
      setQrisReference(res.qrisReference);
      setQrisPayloadString(res.qrPayloadString);
      setQrisCountdownSeconds(900);
      setStep('qris_payment');
    } catch (err) {
      // Graceful fallback
      const fallbackRef = generateQrisReference();
      setQrisReference(fallbackRef);
      setQrisPayloadString(`00020101021226630016ID.GO.BI.QRIS011893600002010200392817440215ID10200392817440303UME5204541153033605406${total}5802ID5928GROCEMART RETAIL INDONESIA6007JAKARTA61051211062160112${newOrderId}6304ABCD`);
      setQrisCountdownSeconds(900);
      setStep('qris_payment');
    }
  };

  const handleSimulateQRISPayment = async () => {
    setIsSimulatingPayment(true);

    try {
      // Call backend open API to settle QRIS payment, deduct inventory, and record GL entries
      await apiClient.simulateQRISPayment({
        orderId: currentOrderId,
        amount: total,
        channel: 'BCA QRIS',
        customerName: recipientName,
        customerEmail: recipientEmail,
        items,
      });
    } catch (err) {
      console.warn('Backend payment simulation notice:', err);
    }

    setTimeout(() => {
      setIsSimulatingPayment(false);

      // Trigger celebration confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#065f46', '#10b981', '#f59e0b', '#fbbf24'],
        });
      } catch (err) {
        // Safe fallback
      }

      const timeline: OrderTimelineStep[] = [
        {
          status: 'placed',
          label: 'Order Placed',
          description: `Order registered via GroceMart Online Portal (${deliveryMethod === 'pickup' ? 'Store Pickup' : 'Express Delivery'}).`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          completed: true,
        },
        {
          status: 'paid',
          label: 'QRIS Payment Verified',
          description: `Settled via Bank Indonesia QRIS National Switch · Ref ${qrisReference}.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          completed: true,
        },
        {
          status: 'packing',
          label: 'Chilled Picking & Packing',
          description: `${selectedPickupStore?.name || 'GroceMart Senopati Hub'} is picking farm-fresh items into temperature-controlled totes.`,
          timestamp: 'In Progress',
          completed: false,
        },
        {
          status: deliveryMethod === 'pickup' ? 'ready_for_pickup' : 'in_transit',
          label: deliveryMethod === 'pickup' ? 'Ready for In-Store Pickup' : 'Dispatched with GroceFleet Courier',
          description: deliveryMethod === 'pickup' ? 'Present order ID at Click & Collect counter.' : 'Courier assigned with insulated refrigerated vehicle.',
          timestamp: 'Scheduled',
          completed: false,
        },
        {
          status: 'delivered',
          label: deliveryMethod === 'pickup' ? 'Handed Over' : 'Delivered to Doorstep',
          description: 'Inspected and handed over in 100% biodegradable cassava packaging.',
          timestamp: 'Pending',
          completed: false,
        }
      ];

      const newOrder: Order = {
        id: currentOrderId,
        userId: customerAccount?.id,
        createdAt: new Date().toISOString(),
        customerName: recipientName,
        customerEmail: recipientEmail,
        customerPhone: recipientPhone,
        deliveryMethod,
        deliveryAddress: deliveryMethod !== 'pickup' ? {
          label: 'Delivery Address',
          recipient: recipientName,
          phone: recipientPhone,
          addressLine,
          city: 'Jakarta',
          notes: deliveryNotes,
        } : undefined,
        pickupStore: deliveryMethod === 'pickup' ? selectedPickupStore : undefined,
        items: [...items],
        subtotal,
        deliveryFee,
        discount: appliedDiscount,
        voucherApplied: voucherCode,
        total,
        paymentMethod: 'qris',
        paymentStatus: 'paid',
        qrisRef: qrisReference,
        qrisNmid: 'ID1020039281744',
        qrisPaidAt: new Date().toISOString(),
        status: 'paid',
        courierName: deliveryMethod !== 'pickup' ? 'Ahmad Fauzi (GroceFleet Express)' : undefined,
        courierPhone: deliveryMethod !== 'pickup' ? '+62 812 9901 2341' : undefined,
        vehiclePlate: deliveryMethod !== 'pickup' ? 'B 3820 SKY (Chilled Electric Van)' : undefined,
        estimatedArrival: deliveryMethod === 'pickup' ? 'Ready in 30 mins' : '45 minutes',
        timeline,
      };

      setCompletedOrder(newOrder);
      onOrderSuccess(newOrder);
      setStep('success');
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl w-full max-w-[95vw] sm:max-w-2xl shadow-2xl border border-stone-200 overflow-hidden relative animate-in fade-in zoom-in-95 duration-200 my-auto">
        {/* Modal Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* STEP 1: Customer Details & Payment Selection */}
        {step === 'details' && (
          <form onSubmit={handleProceedToPayment} className="p-4 sm:p-8 space-y-5 sm:space-y-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">
                <span>Checkout</span>
                <span aria-hidden="true">·</span>
                <span>GroceMart Instant Fulfillment</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-stone-900 font-display">
                Fulfillment & Payment Setup
              </h2>
            </div>

            {/* Store Closed Warning Banner */}
            {isStoreClosed && (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-950 flex items-start gap-3 shadow-xs animate-in fade-in">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-sm block">Checkout Blocked: Outlet Currently Closed</span>
                  <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                    {storeClosureNotice}
                  </p>
                  <p className="text-[11px] text-amber-800 mt-1">
                    Cart items remain preserved. Online ordering will resume once operating hours reopen.
                  </p>
                </div>
              </div>
            )}

            {/* Customer Details */}
            <div className="space-y-4 pt-2 border-t border-stone-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                1. Recipient Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600 block mb-1">
                    WhatsApp / Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-800"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-stone-600 block mb-1">
                    Notification Email
                  </label>
                  <input
                    type="email"
                    required
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-800"
                  />
                </div>
              </div>
            </div>

            {/* Delivery or Pickup Address */}
            <div className="space-y-3 pt-2 border-t border-stone-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                2. {deliveryMethod === 'pickup' ? 'Store Pickup Location' : 'Delivery Destination'}
              </h3>
              {deliveryMethod === 'pickup' ? (
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                  <p className="font-semibold text-stone-900">{selectedPickupStore?.name}</p>
                  <p className="text-stone-600 mt-0.5">{selectedPickupStore?.address}</p>
                  <p className="text-emerald-800 font-medium mt-1">Ready for pickup in 30 minutes after QRIS payment</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-stone-600 block mb-1">
                      Street Address & Unit / House No.
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={addressLine}
                      onChange={(e) => setAddressLine(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-800"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-stone-600 block mb-1">
                      Courier Delivery Note (Optional)
                    </label>
                    <input
                      type="text"
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      placeholder="e.g. Leave with security / gate passcode"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-800"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Store Closed Banner Notice */}
            {(isStoreClosed || blockedNotice) && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 text-xs flex items-start gap-2.5 animate-in fade-in">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm">Storefront Checkout Temporarily Paused</h4>
                  <p className="mt-0.5 leading-relaxed">
                    {blockedNotice || storeClosureNotice || storeStatus?.noticeBanner || 'GroceMart is currently in holiday closure or maintenance. You may browse the catalog, but new order checkouts are paused.'}
                  </p>
                </div>
              </div>
            )}

            {/* Exclusive QRIS Payment Method Card */}
            <div className="space-y-3 pt-2 border-t border-stone-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                  3. Payment Method: National QRIS
                </h3>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Zero Admin Fee
                </span>
              </div>

              <div className="p-4 rounded-2xl border-2 border-emerald-800 bg-emerald-50/50 relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="px-2.5 py-1 bg-red-600 text-white font-black text-xs rounded tracking-wider shadow-xs">
                      QRIS
                    </div>
                    <div>
                      <span className="text-xs font-bold text-stone-900 font-display block">
                        Indonesian National Standard QR Code (ASPI / Bank Indonesia)
                      </span>
                      <span className="text-[11px] text-stone-600">
                        Universal instant scan via any Indonesian E-Wallet or Mobile Banking
                      </span>
                    </div>
                  </div>
                  <CheckCircle className="w-5 h-5 text-emerald-800 shrink-0" />
                </div>

                <div className="pt-2.5 border-t border-emerald-800/20 flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-600">
                  <span className="font-medium">
                    Supported: GoPay · OVO · ShopeePay · DANA · BCA mobile · Livin' Mandiri · BRImo · LinkAja
                  </span>
                  <span className="text-emerald-800 font-bold font-mono">
                    Direct Backend Open API Clearing
                  </span>
                </div>
              </div>
            </div>

            {/* Total breakdown & submit */}
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs text-stone-500 block">Total Payment (IDR)</span>
                <span className="text-xl font-bold text-stone-900 font-mono tabular-nums">
                  {formatIDR(total)}
                </span>
              </div>
              <button
                type="submit"
                disabled={isStoreClosed}
                className="py-3 px-6 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{isStoreClosed ? 'Checkout Paused (Store Closed)' : 'Continue to QRIS Payment'}</span>
                <ArrowRight className="w-4 h-4 text-amber-300" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Authentic QRIS Payment Screen */}
        {step === 'qris_payment' && (
          <div className="p-4 sm:p-8 space-y-5 sm:space-y-6">
            {/* Official QRIS Header */}
            <div className="flex items-center justify-between pb-4 border-b border-stone-200">
              <div className="flex items-center gap-3">
                <div className="px-3 py-1 bg-red-600 text-white font-black text-sm tracking-wider rounded">
                  QRIS
                </div>
                <div>
                  <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                    Quick Response Code Indonesian Standard
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    National Standard Payment Switch · Bank Indonesia
                  </p>
                </div>
              </div>

              {/* Countdown badge */}
              <div className="px-3 py-1.5 bg-amber-50 rounded-lg border border-amber-200 text-right">
                <span className="text-[10px] text-amber-800 block leading-tight">Expires in</span>
                <span className="text-xs font-mono font-bold text-amber-900 tabular-nums">
                  {formatCountdown(qrisCountdownSeconds)}
                </span>
              </div>
            </div>

            {/* Merchant Details Box */}
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-center space-y-1">
              <p className="text-[11px] text-stone-500 uppercase tracking-widest font-semibold">
                Merchant Name
              </p>
              <h4 className="text-sm sm:text-base font-bold text-stone-900 font-display">
                GROCEMART RETAIL INDONESIA
              </h4>
              <p className="text-xs font-mono text-stone-500">
                NMID: ID1020039281744 · Ref: {qrisReference}
              </p>
              <div className="pt-2">
                <span className="text-xs text-stone-500 block">Total Due:</span>
                <span className="text-2xl font-extrabold text-emerald-950 font-mono tabular-nums">
                  {formatIDR(total)}
                </span>
              </div>
            </div>

            {/* QR Code Presentation */}
            <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl border-2 border-stone-300 shadow-inner max-w-xs mx-auto">
              <div className="p-3 bg-white rounded-xl shadow-xs border border-stone-200">
                <QRCodeSVG
                  value={qrisPayloadString || `00020101021226630016ID.GO.BI.QRIS011893600002010200392817440215ID10200392817440303UME5204541153033605406${total}5802ID5928GROCEMART RETAIL INDONESIA6007JAKARTA61051211062160112${currentOrderId}6304ABCD`}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs text-stone-600">
                <ShieldCheck className="w-4 h-4 text-emerald-800" />
                <span>Scan with any Indonesian e-wallet or banking app</span>
              </div>
            </div>

            {/* Supported Wallets Strip */}
            <div className="text-center">
              <p className="text-[11px] text-stone-400 mb-2">
                Supported: GoPay · OVO · ShopeePay · DANA · BCA mobile · Livin' by Mandiri · BRImo · CIMB OCTO
              </p>
            </div>

            {/* Simulator Action Button */}
            <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={handleSimulateQRISPayment}
                disabled={isSimulatingPayment}
                className="w-full sm:flex-1 py-3 px-4 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSimulatingPayment ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                    <span>Verifying QRIS Payment via Switch...</span>
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4 text-amber-300" />
                    <span>Simulate QRIS Payment Scan & Pay</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep('details')}
                className="w-full sm:w-auto py-3 px-4 text-stone-600 hover:text-stone-900 text-xs font-semibold cursor-pointer"
              >
                Back to Details
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Order Confirmed & Success View */}
        {step === 'success' && completedOrder && (
          <div className="p-4 sm:p-8 space-y-5 sm:space-y-6 text-center">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle className="w-10 h-10" />
            </div>

            <div>
              <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">
                Payment Received · Instant Fulfillment Active
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 font-display">
                Order #{completedOrder.id} Confirmed!
              </h2>
              <p className="mt-2 text-stone-600 text-xs sm:text-sm max-w-md mx-auto">
                Thank you, {completedOrder.customerName}. Your payment of{' '}
                <span className="font-mono font-bold text-stone-900">{formatIDR(completedOrder.total)}</span> was verified instantly via QRIS.
              </p>
            </div>

            {/* Summary Box */}
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-left text-xs space-y-2 max-w-md mx-auto">
              <div className="flex justify-between">
                <span className="text-stone-500">Order Reference</span>
                <span className="font-mono font-bold text-stone-900">{completedOrder.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Payment Status</span>
                <span className="font-semibold text-emerald-800">QRIS Paid ({completedOrder.qrisRef})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Fulfillment</span>
                <span className="font-semibold text-stone-900">
                  {completedOrder.deliveryMethod === 'pickup'
                    ? `Pickup at ${completedOrder.pickupStore?.name}`
                    : `Express Delivery (${completedOrder.estimatedArrival})`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Items Ordered</span>
                <span>{completedOrder.items.length} grocery items</span>
              </div>
            </div>

            {/* Direct Action Buttons */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenOrderTracking(completedOrder.id);
                }}
                className="w-full sm:w-auto py-3 px-6 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Track Order Live in Portal</span>
                <ArrowRight className="w-4 h-4 text-amber-300" />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto py-3 px-6 bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs sm:text-sm rounded-xl transition-all cursor-pointer"
              >
                Continue Browsing
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
