import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { PriceAlert } from '../types';
import { sendBrowserNotification, playAlertChime } from './notificationService';
import { formatUsdt } from '../utils/formatters';

const LOCAL_STORAGE_KEY = 'gain_price_alerts_v1';

/**
 * Get cached local alerts fallback
 */
export function getLocalPriceAlerts(): PriceAlert[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save cached local alerts
 */
export function setLocalPriceAlerts(alerts: PriceAlert[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(alerts));
  } catch {
    // Ignore storage quota error
  }
}

/**
 * Subscribe to real-time Price Alerts from Firestore (or LocalStorage fallback)
 */
export function subscribeToPriceAlerts(
  userId: string | null | undefined,
  onUpdate: (alerts: PriceAlert[]) => void
): () => void {
  if (!userId) {
    onUpdate(getLocalPriceAlerts());
    return () => {};
  }

  const alertsCol = collection(db, 'users', userId, 'price_alerts');
  return onSnapshot(
    alertsCol,
    (snapshot) => {
      const alerts: PriceAlert[] = [];
      snapshot.forEach((docSnap) => {
        alerts.push(docSnap.data() as PriceAlert);
      });
      alerts.sort((a, b) => b.createdAt - a.createdAt);
      setLocalPriceAlerts(alerts);
      onUpdate(alerts);
    },
    (err) => {
      console.warn('Firestore price_alerts subscription fallback to local cache:', err);
      onUpdate(getLocalPriceAlerts());
    }
  );
}

/**
 * Add or update a price alert in Firestore & local cache
 */
export async function savePriceAlert(
  userId: string | null | undefined,
  alert: PriceAlert
): Promise<void> {
  const currentLocal = getLocalPriceAlerts().filter((a) => a.id !== alert.id);
  setLocalPriceAlerts([alert, ...currentLocal]);

  if (userId) {
    try {
      const alertRef = doc(db, 'users', userId, 'price_alerts', alert.id);
      await setDoc(alertRef, { ...alert, userId }, { merge: true });
    } catch (e) {
      console.warn('Failed to save price alert to Firestore, saved to local cache:', e);
    }
  }
}

/**
 * Delete a price alert
 */
export async function deletePriceAlert(
  userId: string | null | undefined,
  alertId: string
): Promise<void> {
  const currentLocal = getLocalPriceAlerts().filter((a) => a.id !== alertId);
  setLocalPriceAlerts(currentLocal);

  if (userId) {
    try {
      const alertRef = doc(db, 'users', userId, 'price_alerts', alertId);
      await deleteDoc(alertRef);
    } catch (e) {
      console.warn('Failed to delete price alert from Firestore:', e);
    }
  }
}

/**
 * Update a price alert status / properties
 */
export async function updatePriceAlert(
  userId: string | null | undefined,
  alertId: string,
  updates: Partial<PriceAlert>
): Promise<void> {
  const currentLocal = getLocalPriceAlerts().map((a) =>
    a.id === alertId ? { ...a, ...updates } : a
  );
  setLocalPriceAlerts(currentLocal);

  if (userId) {
    try {
      const alertRef = doc(db, 'users', userId, 'price_alerts', alertId);
      await updateDoc(alertRef, { ...updates, userId });
    } catch (e) {
      console.warn('Failed to update price alert in Firestore:', e);
    }
  }
}

/**
 * Evaluate price alerts against real-time tickers and trigger notifications
 */
export function checkPriceAlerts(
  alerts: PriceAlert[],
  currentPrices: Record<string, number>,
  userId: string | null | undefined,
  onTriggered?: (alert: PriceAlert, triggeredPrice: number) => void
): PriceAlert[] {
  let hasChanges = false;
  const updatedAlerts = alerts.map((alert) => {
    if (alert.status !== 'active') return alert;

    const currentPrice = currentPrices[alert.symbol];
    if (typeof currentPrice !== 'number' || currentPrice <= 0) return alert;

    let isTriggered = false;
    if (alert.condition === 'above' && currentPrice >= alert.targetPrice) {
      isTriggered = true;
    } else if (alert.condition === 'below' && currentPrice <= alert.targetPrice) {
      isTriggered = true;
    }

    if (isTriggered) {
      hasChanges = true;
      const triggeredAt = Date.now();
      const updated: PriceAlert = {
        ...alert,
        status: alert.isRepeating ? 'active' : 'triggered',
        triggeredAt,
        triggeredPrice: currentPrice,
        notificationSent: true,
      };

      // 1. Play pleasant audio chime
      playAlertChime();

      // 2. Send native browser notification
      const conditionText =
        alert.condition === 'above' ? 'naik melampaui' : 'turun menembus';
      const title = `🚨 Target Harga ${alert.symbol}: $${formatUsdt(currentPrice)}!`;
      const body = `Harga ${alert.symbol} telah ${conditionText} target Anda ($${formatUsdt(alert.targetPrice)}). Waktu: ${new Date(triggeredAt).toLocaleTimeString('id-ID')}.`;

      sendBrowserNotification(title, {
        body,
        tag: `price-alert-${alert.id}`,
      });

      // 3. Callback for in-app toast / banner
      if (onTriggered) {
        onTriggered(updated, currentPrice);
      }

      // 4. Update in Firestore / LocalStorage
      updatePriceAlert(userId, alert.id, {
        status: updated.status,
        triggeredAt,
        triggeredPrice: currentPrice,
        notificationSent: true,
      });

      return updated;
    }

    return alert;
  });

  return hasChanges ? updatedAlerts : alerts;
}
