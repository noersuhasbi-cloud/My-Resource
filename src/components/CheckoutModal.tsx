import React, { useState, useEffect } from 'react';
import { CartItem, CustomerAccount, Order, StoreLocation, OrderTimelineStep } from '../types';
import { formatIDR, generateOrderId, generateQrisReference } from '../utils/formatters';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { X, CheckCircle, QrCode, CreditCard, Building2, Truck, Store, Clock, ArrowRight, ShieldCheck, Download, ExternalLink, RefreshCw } from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  deliveryMethod: 'instant' | 'scheduled' | 'pickup';
  selectedPickupStore?: StoreLocation;
  appliedDiscount: number;
  voucherCode?: string;
  customerAccount?: CustomerAccount | null;
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
  const [paymentMethod, setPaymentMethod] = useState<'qris' | 'bank_transfer' | 'card'>('qris');

  // QRIS Payment state
  const [currentOrderId, setCurrentOrderId] = useState<string>('');
  const [qrisReference, setQrisReference] = useState<string>('');
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

  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const newOrderId = generateOrderId();
    const newQrisRef = generateQrisReference();
    setCurrentOrderId(newOrderId);
    setQrisReference(newQrisRef);
    setQrisCountdownSeconds(900);
    setStep('qris_payment');
  };

  const handleSimulateQRISPayment = () => {
    setIsSimulatingPayment(true);

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
        // Safe fallback if confetti isn't supported in container
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
          status: 'in_transit',
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
        qrisNmid: 'ID1020260489110',
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-stone-200 overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* STEP 1: Customer Details & Payment Selection */}
        {step === 'details' && (
          <form onSubmit={handleProceedToPayment} className="p-6 sm:p-8 space-y-6">
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

            {/* Payment Method Selector */}
            <div className="space-y-3 pt-2 border-t border-stone-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                3. Choose Payment Method
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('qris')}
                  className={`p-3 rounded-xl border text-left transition-all relative cursor-pointer ${
                    paymentMethod === 'qris'
                      ? 'border-emerald-800 bg-emerald-50/60 ring-1 ring-emerald-800'
                      : 'border-stone-200 bg-stone-50/50 hover:bg-stone-100'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <QrCode className="w-4 h-4 text-emerald-800" />
                    <span className="text-xs font-bold text-stone-900 font-display">QRIS</span>
                  </div>
                  <p className="text-[11px] text-stone-600 leading-tight">
                    All E-Wallets & Mobile Banking
                  </p>
                  <span className="mt-1.5 inline-block text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                    Zero Admin Fee
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('bank_transfer')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    paymentMethod === 'bank_transfer'
                      ? 'border-emerald-800 bg-emerald-50/60 ring-1 ring-emerald-800'
                      : 'border-stone-200 bg-stone-50/50 hover:bg-stone-100'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-4 h-4 text-stone-700" />
                    <span className="text-xs font-bold text-stone-900">Virtual Account</span>
                  </div>
                  <p className="text-[11px] text-stone-500 leading-tight">
                    BCA, Mandiri, BNI, BRI
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    paymentMethod === 'card'
                      ? 'border-emerald-800 bg-emerald-50/60 ring-1 ring-emerald-800'
                      : 'border-stone-200 bg-stone-50/50 hover:bg-stone-100'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="w-4 h-4 text-stone-700" />
                    <span className="text-xs font-bold text-stone-900">Credit / Debit</span>
                  </div>
                  <p className="text-[11px] text-stone-500 leading-tight">
                    Visa & Mastercard
                  </p>
                </button>
              </div>
            </div>

            {/* Total breakdown & submit */}
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
              <div>
                <span className="text-xs text-stone-500 block">Total Payment</span>
                <span className="text-xl font-bold text-stone-900 font-mono tabular-nums">
                  {formatIDR(total)}
                </span>
              </div>
              <button
                type="submit"
                className="py-3 px-6 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Continue to {paymentMethod === 'qris' ? 'QRIS' : 'Payment'}</span>
                <ArrowRight className="w-4 h-4 text-amber-300" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Authentic QRIS Payment Screen */}
        {step === 'qris_payment' && (
          <div className="p-6 sm:p-8 space-y-6">
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
                GROCEMART INDONESIA - PT BUMI RETAIL SEJAHTERA
              </h4>
              <p className="text-xs font-mono text-stone-500">
                NMID: ID1020260489110 · Ref: {qrisReference}
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
                  value={`00020101021226600016ID.CO.QRIS.WWW011893600002010202604891100215${currentOrderId}520454115303360540${total}5802ID5920GROCEMART INDONESIA6007JAKARTA6304`}
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
          <div className="p-6 sm:p-8 space-y-6 text-center">
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
