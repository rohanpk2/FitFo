import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { getTheme, type ThemeMode } from "../theme";

interface InlineEditableTextProps {
  /**
   * The committed value. The editor re-seeds its draft from this whenever it
   * enters edit mode (and whenever the value changes from outside while not
   * editing), so optimistic parent updates flow cleanly back in.
   */
  value: string;
  onSave: (next: string) => void;
  placeholder?: string;
  /**
   * When true, enter inserts a newline and blur still commits. When false,
   * return submits. Defaults to false.
   */
  multiline?: boolean;
  /**
   * Optional soft character cap mirroring the backend schema. We trim to
   * this length before committing so the PATCH never 400s on length.
   */
  maxLength?: number;
  keyboardType?: "default" | "number-pad" | "decimal-pad";
  /** Style applied to both the read-only Text and the editing TextInput. */
  textStyle?: StyleProp<TextStyle>;
  /** Style applied to the (read-only) placeholder Text specifically. */
  placeholderStyle?: StyleProp<TextStyle>;
  /** Style applied to the wrapper View. */
  containerStyle?: StyleProp<ViewStyle>;
  themeMode?: ThemeMode;
  /**
   * Disable editing entirely. The field renders as plain Text. Useful while
   * a parent-level save is in flight.
   */
  disabled?: boolean;
  /**
   * Render a non-editable fallback (e.g. a muted "Add notes" hint) when the
   * committed value is empty. Tapping it still opens the editor.
   */
  emptyFallback?: ReactNode;
  /**
   * Hides the subtle "tap to edit" hairline border. Handy for hero-sized
   * fields where we want a cleaner look.
   */
  hideHint?: boolean;
}

/**
 * Notion-style inline editor: renders as a Text (or fallback) until tapped,
 * then swaps to an autofocused TextInput. Commits on blur or (for
 * single-line fields) on submit. Designed to be cheap to drop into an
 * existing layout — it does not manage its own card / label chrome.
 */
export function InlineEditableText({
  value,
  onSave,
  placeholder,
  multiline = false,
  maxLength,
  keyboardType = "default",
  textStyle,
  placeholderStyle,
  containerStyle,
  themeMode = "light",
  disabled = false,
  emptyFallback,
  hideHint = false,
}: InlineEditableTextProps) {
  const theme = getTheme(themeMode);
  const styles = createStyles(theme);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<TextInput | null>(null);

  // Keep the draft in sync with external updates while not actively editing
  // (e.g. another field's save triggers a parent re-render with the new
  // canonical value).
  useEffect(() => {
    if (!isEditing) {
      setDraft(value);
    }
  }, [isEditing, value]);

  const handleBeginEdit = () => {
    if (disabled) {
      return;
    }
    setDraft(value);
    setIsEditing(true);
  };

  const commit = () => {
    const trimmed = maxLength != null ? draft.slice(0, maxLength) : draft;
    setIsEditing(false);
    if (trimmed !== value) {
      onSave(trimmed);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setDraft(value);
  };

  if (isEditing) {
    return (
      <View style={[styles.container, containerStyle]}>
        <TextInput
          ref={inputRef}
          autoFocus
          blurOnSubmit={!multiline}
          keyboardType={keyboardType}
          maxLength={maxLength}
          multiline={multiline}
          onBlur={commit}
          onChangeText={setDraft}
          onSubmitEditing={multiline ? undefined : commit}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          returnKeyType={multiline ? "default" : "done"}
          selectTextOnFocus={!multiline}
          style={[styles.input, textStyle, styles.inputActive]}
          value={draft}
          // iOS: tapping "Done" in the keyboard toolbar should commit.
          onEndEditing={commit}
          accessibilityLabel="Edit field"
        />
      </View>
    );
  }

  const hasValue = value != null && value.trim().length > 0;

  return (
    <Pressable
      onPress={handleBeginEdit}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityHint={disabled ? undefined : "Tap to edit"}
      style={({ pressed }) => [
        styles.container,
        !hideHint && !disabled ? styles.containerEditable : null,
        pressed && !disabled ? styles.containerPressed : null,
        containerStyle,
      ]}
    >
      {hasValue ? (
        <Text style={textStyle}>{value}</Text>
      ) : emptyFallback ? (
        emptyFallback
      ) : (
        <Text style={[textStyle, styles.placeholder, placeholderStyle]}>
          {placeholder || "Tap to add"}
        </Text>
      )}
    </Pressable>
  );
}

const createStyles = (theme: ReturnType<typeof getTheme>) =>
  StyleSheet.create({
    container: {
      // Narrow vertical padding keeps inline edits visually calm; callers
      // can override via containerStyle when they need a larger hit area.
      paddingVertical: 2,
      borderRadius: 8,
    },
    containerEditable: {
      // Subtle affordance so users discover tap-to-edit without it feeling
      // like every label has a button on it.
      borderBottomWidth: 1,
      borderBottomColor:
        theme.mode === "dark"
          ? "rgba(255, 255, 255, 0.06)"
          : "rgba(15, 23, 42, 0.06)",
    },
    containerPressed: {
      opacity: 0.7,
    },
    input: {
      padding: 0,
      margin: 0,
      color: theme.colors.textPrimary,
    },
    inputActive: {
      // The active editor uses a stronger underline so the transition between
      // read and edit modes is obvious.
      borderBottomWidth: 1.5,
      borderBottomColor: theme.colors.primary,
      paddingBottom: 2,
    },
    placeholder: {
      color: theme.colors.textMuted,
      fontStyle: "italic",
    },
  });
