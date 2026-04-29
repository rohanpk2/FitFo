"use client";

import { useEffect, useRef, useState } from "react";

import {
  ChatApiError,
  ChatCitation,
  ChatTurn,
  RetrievedChunk,
  sendChatMessage,
} from "@/lib/chat";
import { MarkdownBlock, MarkdownInline, parseMarkdown } from "@/lib/markdown";

const ADMIN_ENABLED =
  process.env.NEXT_PUBLIC_CORPUS_ADMIN_ENABLED === "1" ||
  process.env.NEXT_PUBLIC_CORPUS_ADMIN_ENABLED === "true";

const MUSCLE_GROUPS = ["chest", "back", "shoulders", "arms", "legs"] as const;
const GOALS = [
  "hypertrophy",
  "strength",
  "fat_loss",
  "endurance",
  "mobility",
  "mindset",
  "recovery",
] as const;

type Message =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string;
      citations: ChatCitation[];
      retrieval: RetrievedChunk[];
      model?: string;
    };

function chipClass(active: boolean): string {
  return [
    "rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer select-none",
    active
      ? "bg-primary-soft text-primary-soft-text border border-primary-bright/40"
      : "bg-surface-muted text-text-secondary border border-border hover:border-border-soft",
  ].join(" ");
}

function renderInline(inlines: MarkdownInline[]): React.ReactNode {
  return inlines.map((inline, idx) => {
    if (inline.kind === "bold") {
      return (
        <strong key={idx} className="font-semibold text-text-primary">
          {inline.value}
        </strong>
      );
    }
    if (inline.kind === "citation") {
      return (
        <sup key={idx} className="ml-0.5 text-primary-soft-text">
          [{inline.index}]
        </sup>
      );
    }
    return <span key={idx}>{inline.value}</span>;
  });
}

function renderAnswerMarkdown(answer: string): React.ReactNode {
  const blocks: MarkdownBlock[] = parseMarkdown(answer);
  if (blocks.length === 0) {
    return <span>{answer}</span>;
  }
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {blocks.map((block, idx) => {
        if (block.kind === "bullet_list") {
          return (
            <ul key={idx} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        return <p key={idx}>{renderInline(block.inlines)}</p>;
      })}
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [muscleFilter, setMuscleFilter] = useState<string[]>([]);
  const [goalFilter, setGoalFilter] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, pending]);

  if (!ADMIN_ENABLED) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-3xl font-bold">Chat disabled</h1>
        <p className="mt-4 text-text-secondary">
          Set{" "}
          <code className="rounded bg-surface-muted px-1">
            NEXT_PUBLIC_CORPUS_ADMIN_ENABLED=1
          </code>{" "}
          in <code className="rounded bg-surface-muted px-1">apps/web/.env</code> to enable
          this page.
        </p>
      </main>
    );
  }

  const toggleArrayValue = (
    setter: (next: string[]) => void,
    current: string[],
    value: string,
  ) => {
    setter(
      current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value],
    );
  };

  const submit = async () => {
    const trimmed = input.trim();
    if (!trimmed || pending) return;
    setError(null);

    const newUserMessage: Message = { role: "user", content: trimmed };
    const updated = [...messages, newUserMessage];
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
        muscle_groups: muscleFilter.length ? muscleFilter : undefined,
        goals: goalFilter.length ? goalFilter : undefined,
        top_k: 8,
      });
      setMessages([
        ...updated,
        {
          role: "assistant",
          content: result.answer,
          citations: result.citations,
          retrieval: result.retrieval,
          model: result.model,
        },
      ]);
    } catch (exc) {
      setError(exc instanceof ChatApiError ? exc.message : String(exc));
    } finally {
      setPending(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <main className="mx-auto flex h-screen max-w-4xl flex-col px-6 py-8">
      <header className="mb-4">
        <h1 className="font-display text-3xl font-bold">Coach chat</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Grounded in approved Jacob chunks. Cites sources inline.
        </p>
      </header>

      <section className="mb-3 rounded-xl border border-border bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-text-muted">
            muscle filter:
          </span>
          {MUSCLE_GROUPS.map((mg) => (
            <button
              key={mg}
              onClick={() =>
                toggleArrayValue(setMuscleFilter, muscleFilter, mg)
              }
              className={chipClass(muscleFilter.includes(mg))}
            >
              {mg}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-text-muted">
            goal filter:
          </span>
          {GOALS.map((g) => (
            <button
              key={g}
              onClick={() => toggleArrayValue(setGoalFilter, goalFilter, g)}
              className={chipClass(goalFilter.includes(g))}
            >
              {g}
            </button>
          ))}
        </div>
      </section>

      <div
        ref={scrollRef}
        className="mb-3 flex-1 space-y-4 overflow-y-auto rounded-2xl border border-border bg-surface p-5"
      >
        {messages.length === 0 && !pending && (
          <p className="text-text-secondary">
            Ask a training question. The chatbot will answer using approved
            chunks from Jacob's TikTok library and cite each source.
          </p>
        )}

        {messages.map((message, idx) => {
          if (message.role === "user") {
            return (
              <div key={idx} className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl bg-primary px-4 py-2 text-white">
                  {message.content}
                </div>
              </div>
            );
          }
          return (
            <div key={idx} className="flex justify-start">
              <div className="w-full max-w-[90%]">
                <div className="rounded-2xl bg-surface-muted px-4 py-3 text-text-primary">
                  {renderAnswerMarkdown(message.content)}
                </div>
                {message.citations.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {message.citations.map((cite) => (
                      <a
                        key={`${idx}-${cite.index}`}
                        href={cite.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs text-text-secondary hover:border-border-soft hover:text-text-primary"
                      >
                        <span className="mr-2 font-medium text-primary-soft-text">
                          [{cite.index}]
                        </span>
                        <span className="text-text-primary">{cite.snippet}</span>
                        <div className="mt-1 truncate text-text-muted">
                          {cite.source_url}
                        </div>
                      </a>
                    ))}
                  </div>
                )}
                {message.model && (
                  <div className="mt-1 text-[10px] uppercase tracking-wide text-text-muted">
                    {message.model} · {message.retrieval.length} chunks retrieved
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {pending && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-surface-muted px-4 py-3 text-sm text-text-secondary">
              Thinking…
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-700/60 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="How do I make my triceps bigger?"
          className="flex-1 resize-y rounded-xl border border-border bg-surface-muted px-3 py-2 text-text-primary outline-none focus:border-primary-bright"
          disabled={pending}
        />
        <button
          onClick={submit}
          disabled={pending || !input.trim()}
          className="cta-lift rounded-xl bg-primary px-4 py-2 font-medium text-white shadow disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "…" : "Send"}
        </button>
      </div>
    </main>
  );
}
