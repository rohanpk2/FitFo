import { useEffect, useState } from "react";
import * as AppleAuthentication from "expo-apple-authentication";
import { StyleSheet, View } from "react-native";

import { isAppleSignInAvailable } from "../lib/appleAuth";

interface AppleSignInButtonProps {
  onPress: () => void;
  disabled?: boolean;
  themeMode?: "light" | "dark";
}

export function AppleSignInButton({
  onPress,
  disabled = false,
  themeMode = "dark",
}: AppleSignInButtonProps) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await isAppleSignInAvailable();
      if (mounted) {
        setAvailable(ok);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!available) {
    return null;
  }

  const buttonStyle =
    themeMode === "dark"
      ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
      : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK;

  return (
    <View
      style={[styles.wrapper, disabled ? styles.wrapperDisabled : null]}
      pointerEvents={disabled ? "none" : "auto"}
    >
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={
          AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
        }
        buttonStyle={buttonStyle}
        cornerRadius={16}
        onPress={onPress}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
  },
  wrapperDisabled: {
    opacity: 0.55,
  },
  button: {
    width: "100%",
    height: 52,
  },
});
