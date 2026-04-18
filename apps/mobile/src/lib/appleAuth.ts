import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

export interface AppleCredentialPayload {
  identityToken: string;
  rawNonce: string;
  fullName: string | null;
  email: string | null;
}

/**
 * Returns true on iOS devices where the Sign in with Apple system sheet is
 * available. Safe to call on any platform — resolves false elsewhere.
 */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") {
    return false;
  }
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

function joinName(given: string | null, family: string | null): string | null {
  const parts = [given, family].filter((part) => part && part.trim());
  if (parts.length === 0) {
    return null;
  }
  return parts.join(" ").trim();
}

/**
 * Trigger the native Sign in with Apple flow. Returns the credential payload
 * if the user completes sign-in, or null if they cancel. Throws on error.
 *
 * The server verifies both the token signature and the nonce, so we generate
 * a random nonce per attempt and pass its SHA-256 hash to Apple while sending
 * the raw value to our backend.
 */
export async function signInWithApple(): Promise<AppleCredentialPayload | null> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      throw new Error("Apple did not return an identity token.");
    }

    return {
      identityToken: credential.identityToken,
      rawNonce,
      fullName: joinName(
        credential.fullName?.givenName ?? null,
        credential.fullName?.familyName ?? null,
      ),
      email: credential.email ?? null,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "ERR_REQUEST_CANCELED"
    ) {
      return null;
    }
    throw error;
  }
}
