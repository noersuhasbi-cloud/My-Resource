import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { signInWithPopup, signOut, signInAnonymously, User as FirebaseUser } from 'firebase/auth';
import { db, auth, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import type { CustomerAccount, Order, SavedAddress, OrderStatus } from '../types/index.ts';

export async function loginWithGoogle(): Promise<FirebaseUser> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (error?.code === 'auth/unauthorized-domain' || error?.message?.includes('unauthorized-domain')) {
      console.warn('Google Sign-In notice: Current domain is not in Firebase OAuth authorized domains. Attempting anonymous session fallback...');
      try {
        const anonResult = await signInAnonymously(auth);
        return anonResult.user;
      } catch (anonErr) {
        console.warn('Anonymous auth fallback notice:', anonErr);
      }
    } else {
      console.warn('Google Sign-In notice:', error);
    }
    throw error;
  }
}

export async function logoutFirebase(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.warn('Sign out notice:', error);
  }
}

export function subscribeToUserProfile(
  userId: string,
  onProfile: (account: CustomerAccount | null) => void
): () => void {
  const userDocRef = doc(db, 'users', userId);

  return onSnapshot(
    userDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        onProfile({
          id: userId,
          name: data.name || 'GroceMart Member',
          email: data.email || '',
          phone: data.phone || '+62 812 000 0000',
          memberTier: data.memberTier || 'Gold Member',
          grocePoints: data.grocePoints ?? 1450,
          memberSince: data.memberSince || '2026',
          savedAddresses: data.savedAddresses || [],
        });
      } else {
        onProfile(null);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}`);
    }
  );
}

export async function initOrUpdateUserProfile(
  user: FirebaseUser,
  fallbackAccount?: Partial<CustomerAccount>
): Promise<CustomerAccount> {
  const path = `users/${user.uid}`;
  try {
    const userDocRef = doc(db, 'users', user.uid);
    const existingSnap = await getDoc(userDocRef);

    if (existingSnap.exists()) {
      const data = existingSnap.data();
      return {
        id: user.uid,
        name: data.name || user.displayName || 'Member',
        email: data.email || user.email || '',
        phone: data.phone || user.phoneNumber || '+62 812 0000 0000',
        memberTier: data.memberTier || 'Gold Member',
        grocePoints: data.grocePoints ?? 1450,
        memberSince: data.memberSince || '2026',
        savedAddresses: data.savedAddresses || [],
      };
    } else {
      const newAccount: CustomerAccount = {
        id: user.uid,
        name: user.displayName || fallbackAccount?.name || 'GroceMart Member',
        email: user.email || fallbackAccount?.email || '',
        phone: user.phoneNumber || fallbackAccount?.phone || '+62 812 8899 4432',
        memberTier: (fallbackAccount?.memberTier as any) || 'Gold Member',
        grocePoints: fallbackAccount?.grocePoints ?? 1450,
        memberSince: 'October 2026',
        savedAddresses: fallbackAccount?.savedAddresses || [
          {
            id: 'addr-home',
            label: 'Home (Default)',
            recipient: user.displayName || 'GroceMart Member',
            phone: user.phoneNumber || '+62 812 8899 4432',
            addressLine: 'Jl. Senopati No. 82, Kebayoran Baru',
            city: 'Jakarta',
            postalCode: '12110',
            isDefault: true,
          },
        ],
      };

      await setDoc(userDocRef, {
        userId: user.uid,
        name: newAccount.name,
        email: newAccount.email,
        phone: newAccount.phone,
        memberTier: newAccount.memberTier,
        grocePoints: newAccount.grocePoints,
        memberSince: newAccount.memberSince,
        savedAddresses: newAccount.savedAddresses,
        createdAt: new Date().toISOString(),
      });

      return newAccount;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function saveUserAddressesToFirestore(
  userId: string,
  addresses: SavedAddress[]
): Promise<void> {
  const path = `users/${userId}`;
  try {
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, {
      savedAddresses: addresses,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export function subscribeToUserOrders(
  userId: string,
  onOrders: (orders: Order[]) => void
): () => void {
  const ordersCollRef = collection(db, 'orders');
  const q = query(ordersCollRef, where('userId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const ordersList: Order[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        ordersList.push({
          id: data.orderId || d.id,
          userId: data.userId,
          createdAt: data.createdAt,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          customerPhone: data.customerPhone,
          deliveryMethod: data.deliveryMethod,
          deliveryAddress: data.deliveryAddress,
          pickupStore: data.pickupStore,
          items: data.items || [],
          subtotal: data.subtotal,
          deliveryFee: data.deliveryFee,
          discount: data.discount,
          voucherApplied: data.voucherApplied,
          total: data.total,
          paymentMethod: data.paymentMethod,
          paymentStatus: data.paymentStatus,
          qrisRef: data.qrisRef,
          qrisNmid: data.qrisNmid,
          qrisPaidAt: data.qrisPaidAt,
          status: data.status,
          courierName: data.courierName,
          courierPhone: data.courierPhone,
          vehiclePlate: data.vehiclePlate,
          estimatedArrival: data.estimatedArrival,
          timeline: data.timeline || [],
        });
      });
      // Sort newest first
      ordersList.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      onOrders(ordersList);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    }
  );
}

export async function saveOrderToFirestore(order: Order, userId?: string): Promise<void> {
  const path = `orders/${order.id}`;
  try {
    const effectiveUserId = auth.currentUser?.uid || userId || order.userId || 'guest-user';
    const orderDocRef = doc(db, 'orders', order.id);
    await setDoc(orderDocRef, {
      orderId: order.id,
      userId: effectiveUserId,
      customerName: order.customerName.slice(0, 100),
      customerEmail: (order.customerEmail || '').slice(0, 100),
      customerPhone: (order.customerPhone || '').slice(0, 30),
      deliveryMethod: order.deliveryMethod,
      deliveryAddress: order.deliveryAddress || null,
      pickupStore: order.pickupStore || null,
      items: order.items,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      discount: order.discount,
      voucherApplied: order.voucherApplied || null,
      total: order.total,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      qrisRef: order.qrisRef || null,
      qrisNmid: order.qrisNmid || null,
      qrisPaidAt: order.qrisPaidAt || null,
      status: order.status,
      courierName: order.courierName || null,
      courierPhone: order.courierPhone || null,
      vehiclePlate: order.vehiclePlate || null,
      estimatedArrival: order.estimatedArrival || null,
      timeline: order.timeline,
      createdAt: order.createdAt,
    }, { merge: true });

    // Update loyalty points in user document if authenticated
    if (auth.currentUser) {
      try {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const currentPoints = userSnap.data().grocePoints || 0;
          const earned = Math.floor(order.total / 1000);
          await updateDoc(userDocRef, {
            grocePoints: currentPoints + earned,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (pointsErr) {
        console.warn('Could not update loyalty points in Firestore:', pointsErr);
      }
    }
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {
      // Allow local fallback to continue smoothly
    }
  }
}

export async function updateOrderStatusInFirestore(
  orderId: string,
  nextStatus: OrderStatus,
  updatedTimeline: any[],
  fullOrder?: Order
): Promise<void> {
  const path = `orders/${orderId}`;
  try {
    const orderDocRef = doc(db, 'orders', orderId);
    if (fullOrder) {
      await setDoc(
        orderDocRef,
        {
          orderId: fullOrder.id,
          userId: auth.currentUser?.uid || fullOrder.userId || 'guest-user',
          customerName: fullOrder.customerName.slice(0, 100),
          customerEmail: (fullOrder.customerEmail || '').slice(0, 100),
          deliveryMethod: fullOrder.deliveryMethod,
          total: fullOrder.total,
          paymentMethod: fullOrder.paymentMethod,
          paymentStatus: fullOrder.paymentStatus,
          status: nextStatus,
          timeline: updatedTimeline,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } else {
      await setDoc(
        orderDocRef,
        {
          orderId,
          status: nextStatus,
          timeline: updatedTimeline,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } catch {
      // Allow local fallback to continue smoothly
    }
  }
}

export async function savePosReceiptToFirestore(receipt: {
  receiptId: string;
  storeId: string;
  storeName: string;
  cashierId: string;
  cashierName: string;
  paymentMethod: string;
  currency: string;
  grandTotalIDR: number;
  totalCogsIDR: number;
  timestamp: string;
  items?: any[];
  glEntriesCreated?: any[];
}): Promise<void> {
  const safeId = receipt.receiptId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64);
  const path = `pos_receipts/${safeId}`;
  try {
    const docRef = doc(db, 'pos_receipts', safeId);
    await setDoc(
      docRef,
      {
        receiptId: safeId,
        storeId: receipt.storeId.slice(0, 64),
        storeName: (receipt.storeName || '').slice(0, 128),
        cashierId: receipt.cashierId.slice(0, 64),
        cashierName: (receipt.cashierName || '').slice(0, 100),
        paymentMethod: receipt.paymentMethod,
        currency: receipt.currency,
        grandTotalIDR: receipt.grandTotalIDR,
        totalCogsIDR: receipt.totalCogsIDR,
        timestamp: receipt.timestamp.slice(0, 64),
        itemsCount: receipt.items?.length || 0,
        glEntriesCount: receipt.glEntriesCreated?.length || 0,
      },
      { merge: true }
    );
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {
      // Non-blocking cloud backup sync
    }
  }
}

