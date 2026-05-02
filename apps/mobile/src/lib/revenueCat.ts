import Constants, { ExecutionEnvironment } from "expo-constants";
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { Platform } from "react-native";

export const REVENUECAT_API_KEY = "test_bnGbvHTYiymiRGyFjzEhoqeDPIJ";
export const FITFO_PRO_ENTITLEMENT = "Fitfo Pro";
export const REVENUECAT_OFFERING_ID = "default";

export const REVENUECAT_PRODUCT_IDS = {
  monthly: "monthly",
  yearly: "yearly",
} as const;

let configuredUserId: string | null = null;

/**
 * RevenueCat Paywalls / Customer Center need native modules. Expo Go and web
 * run in "Preview" mode and call into a web path that expects `document`,
 * which spams errors if we present the paywall.
 */
export function isRevenueCatNativePaywallSupported(): boolean {
  if (Platform.OS === "web") {
    return false;
  }
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

function asErrorRecord(error: unknown): Record<string, unknown> | null {
  return error && typeof error === "object" ? (error as Record<string, unknown>) : null;
}

export function getRevenueCatErrorMessage(
  error: unknown,
  fallback = "RevenueCat request failed.",
) {
  const record = asErrorRecord(error);
  const message = record?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

export function isRevenueCatUserCancelled(error: unknown) {
  const record = asErrorRecord(error);
  return record?.userCancelled === true || record?.code === "PURCHASE_CANCELLED";
}

export async function configureRevenueCat(userId: string) {
  await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);

  if (configuredUserId === userId) {
    return;
  }

  if (configuredUserId) {
    await Purchases.logIn(userId);
  } else {
    Purchases.configure({
      apiKey: REVENUECAT_API_KEY,
      appUserID: userId,
    });
  }

  configuredUserId = userId;
}

export async function logOutRevenueCat() {
  if (!configuredUserId) {
    return;
  }

  configuredUserId = null;
  await Purchases.logOut();
}

export function hasFitfoPro(customerInfo: CustomerInfo | null) {
  return Boolean(customerInfo?.entitlements.active[FITFO_PRO_ENTITLEMENT]);
}

export async function getCustomerInfo() {
  return Purchases.getCustomerInfo();
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  const offerings = await Purchases.getOfferings();
  return offerings.current ?? offerings.all[REVENUECAT_OFFERING_ID] ?? null;
}

export function getPackageByProductId(
  offering: PurchasesOffering,
  productId: string,
): PurchasesPackage | null {
  return (
    offering.availablePackages.find(
      (availablePackage) =>
        availablePackage.product.identifier === productId ||
        availablePackage.identifier === productId,
    ) ?? null
  );
}

export async function purchasePackage(packageToPurchase: PurchasesPackage) {
  try {
    const result = await Purchases.purchasePackage(packageToPurchase);
    return {
      customerInfo: result.customerInfo,
      hasAccess: hasFitfoPro(result.customerInfo),
      cancelled: false,
    };
  } catch (error) {
    if (isRevenueCatUserCancelled(error)) {
      return {
        customerInfo: null,
        hasAccess: false,
        cancelled: true,
      };
    }

    throw error;
  }
}

export async function purchaseProductId(productId: string) {
  const offering = await getCurrentOffering();
  if (!offering) {
    throw new Error("No RevenueCat offering is configured.");
  }

  const packageToPurchase = getPackageByProductId(offering, productId);
  if (!packageToPurchase) {
    throw new Error(`RevenueCat product is not available: ${productId}`);
  }

  return purchasePackage(packageToPurchase);
}

export async function restoreRevenueCatPurchases() {
  const customerInfo = await Purchases.restorePurchases();
  return {
    customerInfo,
    hasAccess: hasFitfoPro(customerInfo),
  };
}

export async function presentFitfoPaywallIfNeeded() {
  const customerInfo = await Purchases.getCustomerInfo();

  if (!isRevenueCatNativePaywallSupported()) {
    return {
      result: PAYWALL_RESULT.NOT_PRESENTED,
      customerInfo,
      hasAccess: hasFitfoPro(customerInfo),
      purchased: false,
    };
  }

  const result = await RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: FITFO_PRO_ENTITLEMENT,
  });
  const latestInfo = await Purchases.getCustomerInfo();

  return {
    result,
    customerInfo: latestInfo,
    hasAccess: hasFitfoPro(latestInfo),
    purchased:
      result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED,
  };
}

export async function presentRevenueCatCustomerCenter() {
  if (!isRevenueCatNativePaywallSupported()) {
    return;
  }
  await RevenueCatUI.presentCustomerCenter();
}
