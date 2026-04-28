import { useCallback, useEffect, useState } from "react";
import Purchases, { type CustomerInfo } from "react-native-purchases";

import {
  configureRevenueCat,
  getCustomerInfo,
  getRevenueCatErrorMessage,
  hasFitfoPro,
  logOutRevenueCat,
  presentFitfoPaywallIfNeeded,
  presentRevenueCatCustomerCenter,
  restoreRevenueCatPurchases,
} from "../lib/revenueCat";
import type { UserProfile } from "../types";

export function useRevenueCat(profile: UserProfile | null) {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPro = hasFitfoPro(customerInfo);

  const refreshCustomerInfo = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const info = await getCustomerInfo();
      setCustomerInfo(info);
      return info;
    } catch (refreshError) {
      setError(
        getRevenueCatErrorMessage(
          refreshError,
          "Unable to refresh your subscription status.",
        ),
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!profile?.id) {
      setCustomerInfo(null);
      setIsConfigured(false);
      setError(null);
      return;
    }

    let isMounted = true;

    const setupRevenueCat = async () => {
      setIsLoading(true);
      setError(null);

      try {
        await configureRevenueCat(profile.id);
        const info = await getCustomerInfo();

        if (isMounted) {
          setCustomerInfo(info);
          setIsConfigured(true);
        }
      } catch (setupError) {
        if (isMounted) {
          setError(
            getRevenueCatErrorMessage(
              setupError,
              "Unable to initialize subscriptions.",
            ),
          );
          setIsConfigured(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void setupRevenueCat();

    const listener = (updatedCustomerInfo: CustomerInfo) => {
      setCustomerInfo(updatedCustomerInfo);
    };
    Purchases.addCustomerInfoUpdateListener(listener);

    return () => {
      isMounted = false;
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [profile?.id]);

  const presentPaywall = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await presentFitfoPaywallIfNeeded();
      setCustomerInfo(result.customerInfo);
      return result.hasAccess;
    } catch (paywallError) {
      setError(
        getRevenueCatErrorMessage(paywallError, "Unable to open the paywall."),
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const restorePurchases = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await restoreRevenueCatPurchases();
      setCustomerInfo(result.customerInfo);
      return result.hasAccess;
    } catch (restoreError) {
      setError(
        getRevenueCatErrorMessage(
          restoreError,
          "Unable to restore purchases right now.",
        ),
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const openCustomerCenter = useCallback(async () => {
    setError(null);

    try {
      await presentRevenueCatCustomerCenter();
      await refreshCustomerInfo();
      return true;
    } catch (customerCenterError) {
      setError(
        getRevenueCatErrorMessage(
          customerCenterError,
          "Unable to open subscription management.",
        ),
      );
      return false;
    }
  }, [refreshCustomerInfo]);

  const logOut = useCallback(async () => {
    setCustomerInfo(null);
    setIsConfigured(false);
    setError(null);
    await logOutRevenueCat().catch(() => undefined);
  }, []);

  return {
    customerInfo,
    hasPro,
    isConfigured,
    isLoading,
    error,
    refreshCustomerInfo,
    presentPaywall,
    restorePurchases,
    openCustomerCenter,
    logOut,
  };
}
