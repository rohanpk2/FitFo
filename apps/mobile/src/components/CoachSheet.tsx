import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  ChatApiError,
  ChatCitation,
  ChatTurn,
  WorkoutContext,
  sendChatMessage,
} from "../lib/chat";
import { F } from "../lib/fonts";
import { MarkdownBlock, MarkdownInline, parseMarkdown } from "../lib/markdown";
import { getTheme, radii, type ThemeMode } from "../theme";

interface CoachSheetProps {
  visible: boolean;
  onClose: () => void;
  workout: WorkoutContext | null;
  themeMode?: ThemeMode;
}

interface CoachMessage {
  role: "user" | "assistant";
  content: string;
  citations?: ChatCitation[];
  model?: string;
}

const SUGGESTIONS = [
  "What should I focus on this set?",
  "Cue for the next exercise?",
  "Should I add or drop weight?",
];

export default function CoachSheet({
  visible,
  onClose,
  workout,
  themeMode = "dark",
}: CoachSheetProps) {
  const theme = getTheme(themeMode);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (!visible) {
      // Reset on close so the next open is fresh; backend gets no leaked
      // history from a previous workout session.
      setMessages([]);
      setInput("");
      setPending(false);
      setError(null);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(t);
  }, [messages, pending, visible]);

  const send = async (override?: string) => {
    const trimmed = (override ?? input).trim();
    if (!trimmed || pending) return;
    setError(null);

    const newUser: CoachMessage = { role: "user", content: trimmed };
    const updated = [...messages, newUser];
    setMessages(updated);
    setInput("");
    setPending(true);

    const history: ChatTurn[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const result = await sendChatMessage({
        message: trimmed,
        history,
        workout: workout ?? undefined,
        top_k: 8,
      });
      setMessages([
        ...updated,
        {
          role: "assistant",
          content: result.answer,
          citations: result.citations,
          model: result.model,
        },
      ]);
    } catch (exc) {
      setError(exc instanceof ChatApiError ? exc.message : String(exc));
    } finally {
      setPending(false);
    }
  };

  const renderInline = (inlines: MarkdownInline[], keyPrefix: string) =>
    inlines.map((inline, idx) => {
      const key = `${keyPrefix}-${idx}`;
      if (inline.kind === "bold") {
        return (
          <Text key={key} style={styles.bold}>
            {inline.value}
          </Text>
        );
      }
      if (inline.kind === "citation") {
        return (
          <Text key={key} style={styles.citation}>
            {`[${inline.index}]`}
          </Text>
        );
      }
      return <Text key={key}>{inline.value}</Text>;
    });

  const renderMarkdown = (markdown: string, prefix: string) => {
    const blocks: MarkdownBlock[] = parseMarkdown(markdown);
    if (blocks.length === 0) {
      return <Text style={styles.assistantText}>{markdown}</Text>;
    }
    return (
      <View>
        {blocks.map((block, idx) => {
          if (block.kind === "bullet_list") {
            return (
              <View key={`${prefix}-${idx}`} style={styles.bulletList}>
                {block.items.map((item, itemIdx) => (
                  <View key={`${prefix}-${idx}-${itemIdx}`} style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={[styles.assistantText, styles.bulletText]}>
                      {renderInline(item, `${prefix}-${idx}-${itemIdx}`)}
                    </Text>
                  </View>
                ))}
              </View>
            );
          }
          return (
            <Text
              key={`${prefix}-${idx}`}
              style={[styles.assistantText, idx > 0 ? styles.paragraphGap : null]}
            >
              {renderInline(block.inlines, `${prefix}-${idx}`)}
            </Text>
          );
        })}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetWrap}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <View style={styles.statusDot} />
                <Text style={styles.headerTitle}>Personal Coach</Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                style={styles.closeButton}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={theme.colors.textSecondary}
                />
              </Pressable>
            </View>

            <ScrollView
              ref={scrollRef}
              style={styles.messages}
              contentContainerStyle={[
                styles.messagesContent,
                messages.length > 0 || pending
                  ? styles.messagesContentChat
                  : null,
              ]}
              keyboardShouldPersistTaps="handled"
            >
              {messages.length === 0 && !pending && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>Ask anything in this workout.</Text>
                  <Text style={styles.emptySub}>
                    Form cues, weight selection, swaps, programming. The coach
                    only answers training-related questions.
                  </Text>
                  <View style={styles.suggestionWrap}>
                    {SUGGESTIONS.map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => send(s)}
                        style={styles.suggestion}
                        disabled={pending}
                      >
                        <Text style={styles.suggestionText}>{s}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {messages.map((message, idx) => {
                if (message.role === "user") {
                  return (
                    <View key={idx} style={styles.userRow}>
                      <View style={styles.userBubble}>
                        <Text style={styles.userText}>{message.content}</Text>
                      </View>
                    </View>
                  );
                }
                return (
                  <View key={idx} style={styles.assistantRow}>
                    <View style={styles.assistantBubble}>
                      {renderMarkdown(message.content, `m${idx}`)}
                    </View>
                    {message.citations && message.citations.length > 0 && (
                      <View style={styles.citationList}>
                        {message.citations.map((cite) => (
                          <Pressable
                            key={`${idx}-${cite.index}`}
                            style={styles.citationCard}
                            onPress={() => Linking.openURL(cite.source_url)}
                          >
                            <Text style={styles.citationIndex}>
                              [{cite.index}]
                            </Text>
                            <Text style={styles.citationSnippet} numberOfLines={2}>
                              {cite.snippet}
                            </Text>
                            <Text style={styles.citationUrl} numberOfLines={1}>
                              {cite.source_url}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                    {message.model && (
                      <Text style={styles.modelHint}>{message.model}</Text>
                    )}
                  </View>
                );
              })}

              {pending && (
                <View style={styles.assistantRow}>
                  <View style={styles.assistantBubble}>
                    <View style={styles.thinking}>
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.textSecondary}
                      />
                      <Text style={styles.thinkingText}>Thinking…</Text>
                    </View>
                  </View>
                </View>
              )}

              {error && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.inputRow}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Ask the coach…"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
                editable={!pending}
                multiline
                onSubmitEditing={() => send()}
                returnKeyType="send"
                blurOnSubmit
              />
              <Pressable
                onPress={() => send()}
                disabled={pending || !input.trim()}
                style={[
                  styles.sendButton,
                  (pending || !input.trim()) && styles.sendButtonDisabled,
                ]}
              >
                <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function createStyles(theme: ReturnType<typeof getTheme>) {
  const { colors } = theme;
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "flex-end",
    },
    backdropTouch: {
      ...StyleSheet.absoluteFillObject,
    },
    sheetWrap: {
      width: "100%",
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingBottom: Platform.OS === "ios" ? 34 : 16,
      minHeight: "82%",
      maxHeight: "96%",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderSoft,
    },
    handle: {
      alignSelf: "center",
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginTop: 8,
      marginBottom: 4,
      opacity: 0.7,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 18,
      paddingTop: 8,
      paddingBottom: 12,
    },
    headerTitleRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    headerTitle: {
      color: colors.textPrimary,
      fontSize: 17,
      fontFamily: F.bold,
      letterSpacing: -0.2,
    },
    closeButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    messages: {
      flex: 1,
    },
    messagesContent: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
      gap: 10,
    },
    messagesContentChat: {
      justifyContent: "flex-end",
    },
    emptyState: {
      paddingVertical: 18,
      gap: 10,
    },
    emptyTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontFamily: F.semiBold,
      letterSpacing: -0.1,
    },
    emptySub: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
      fontFamily: F.regular,
    },
    suggestionWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 6,
    },
    suggestion: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.borderSoft,
      borderWidth: 1,
    },
    suggestionText: {
      color: colors.textPrimary,
      fontSize: 12,
      fontFamily: F.medium,
    },
    userRow: {
      alignItems: "flex-end",
    },
    userBubble: {
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 18,
      borderTopRightRadius: 6,
      maxWidth: "85%",
    },
    userText: {
      color: "#FFFFFF",
      fontSize: 14,
      lineHeight: 20,
      fontFamily: F.medium,
    },
    assistantRow: {
      alignItems: "flex-start",
      gap: 6,
    },
    assistantBubble: {
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 18,
      borderTopLeftRadius: 6,
      maxWidth: "92%",
    },
    assistantText: {
      color: colors.textPrimary,
      fontSize: 14,
      lineHeight: 21,
      fontFamily: F.regular,
    },
    paragraphGap: {
      marginTop: 8,
    },
    bulletList: {
      gap: 4,
      marginTop: 4,
    },
    bulletRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    bulletDot: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      fontFamily: F.regular,
    },
    bulletText: {
      flex: 1,
    },
    bold: {
      color: colors.textPrimary,
      fontFamily: F.bold,
    },
    citation: {
      color: colors.primaryLight,
      fontSize: 11,
      lineHeight: 21,
      fontFamily: F.bold,
    },
    citationList: {
      gap: 6,
      maxWidth: "92%",
    },
    citationCard: {
      backgroundColor: colors.surfaceStrong,
      borderRadius: radii.small,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    citationIndex: {
      color: colors.primaryLight,
      fontSize: 11,
      fontFamily: F.bold,
      marginBottom: 2,
    },
    citationSnippet: {
      color: colors.textPrimary,
      fontSize: 12,
      lineHeight: 16,
      fontFamily: F.regular,
    },
    citationUrl: {
      color: colors.textMuted,
      fontSize: 10,
      marginTop: 4,
      fontFamily: F.regular,
    },
    modelHint: {
      color: colors.textMuted,
      fontSize: 10,
      marginTop: 2,
      fontFamily: F.regular,
    },
    thinking: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    thinkingText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: F.medium,
    },
    errorBanner: {
      backgroundColor: colors.errorSoft,
      borderColor: colors.error,
      borderWidth: 1,
      borderRadius: radii.small,
      padding: 10,
    },
    errorText: {
      color: colors.error,
      fontSize: 12,
      fontFamily: F.medium,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 0,
      borderTopColor: colors.borderSoft,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    input: {
      flex: 1,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 22,
      paddingHorizontal: 14,
      paddingVertical: 11,
      color: colors.textPrimary,
      fontSize: 14,
      maxHeight: 120,
      fontFamily: F.regular,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    sendButtonDisabled: {
      backgroundColor: colors.border,
      opacity: 0.6,
    },
  });
}
