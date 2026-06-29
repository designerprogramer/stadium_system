import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Loader2, SendHorizontal, XCircle } from "lucide-react";

import API from "../../lib/api";
import { getCurrentUser } from "../../lib/auth";
import DashboardPageHeader from "../../components/DashboardPageHeader";

function formatTime(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusStyle(status) {
  if (status === "resolved") return "bg-emerald-100 text-emerald-700";
  if (status === "closed") return "bg-slate-200 text-slate-700";
  if (status === "waiting_user") return "bg-sky-100 text-sky-700";
  return "bg-amber-100 text-amber-700";
}

function senderLabel(message) {
  if (message?.sender_role === "bot") {
    return "Bot-ka Garoonka";
  }
  if (!message?.sender) {
    return "Taageerada";
  }
  if (message.sender_role === "user") {
    return "Adiga";
  }
  if (message.sender_role === "staff") {
    return `Shaqaale - ${message.sender.username}`;
  }
  if (message.sender_role === "admin") {
    return `Admin - ${message.sender.username}`;
  }
  return message.sender.username;
}

export default function ChatWidget() {
  const currentUser = getCurrentUser();
  const botStorageKey = `stadium_bot_messages_${currentUser?.id || currentUser?.username || "user"}`;
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [automatedMessages, setAutomatedMessages] = useState(() => readStoredBotMessages(botStorageKey));

  const canSend = useMemo(() => {
    return Boolean(message.trim()) && !sending;
  }, [message, sending]);

  const loadConversation = useCallback(async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const response = await API.get("/support/my-conversation/");
      const conv = response.data?.conversation || null;
      setConversation((prev) => {
        if (prev && !conv) {
          setAutomatedMessages([]);
          localStorage.removeItem(botStorageKey);
        }
        return conv;
      });
      if (showLoader && !conv) {
        setAutomatedMessages([]);
        localStorage.removeItem(botStorageKey);
      }
      setError("");
    } catch (apiError) {
      console.error(apiError);
      setError("Failed to load support chat.");
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [botStorageKey]);

  useEffect(() => {
    const initialLoadTimer = setTimeout(() => {
      void loadConversation(true);
    }, 0);

    const intervalId = setInterval(() => {
      void loadConversation(false);
    }, 5000);

    return () => {
      clearTimeout(initialLoadTimer);
      clearInterval(intervalId);
    };
  }, [loadConversation]);

  useEffect(() => {
    localStorage.setItem(botStorageKey, JSON.stringify(automatedMessages.slice(-30)));
  }, [automatedMessages, botStorageKey]);

  const sendMessage = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    setSending(true);
    setError("");

    try {
      const response = await API.post("/support/chatbot/", { message: trimmed });
      const result = response.data;
      const now = new Date().toISOString();
      setAutomatedMessages((current) => {
        const nextMessages = [];
        if (!result.support_created) {
          nextMessages.push({
          id: `local-user-${Date.now()}`,
          sender_role: "user",
          sender: { username: "You" },
          message: trimmed,
          created_at: now,
          });
        }
        nextMessages.push({
          id: `local-bot-${Date.now()}`,
          sender_role: "bot",
          sender: null,
          message: result.answer,
          created_at: now,
        });
        return [...current, ...nextMessages];
      });
      if (result.conversation) {
        setConversation(result.conversation);
      }
      setMessage("");
    } catch (apiError) {
      console.error(apiError);
      setError(apiError?.response?.data?.detail || "Unable to send message.");
    } finally {
      setSending(false);
    }
  };

  const closeConversation = async () => {
    if (!conversation?.id || closing) {
      return;
    }

    setClosing(true);
    setError("");
    try {
      const response = await API.patch(`/support/conversations/${conversation.id}/status/`, {
        status: "closed",
      });
      setConversation(response.data);
    } catch (apiError) {
      console.error(apiError);
      setError(apiError?.response?.data?.detail || "Failed to close conversation.");
    } finally {
      setClosing(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 pb-10">
      <DashboardPageHeader
        eyebrow="Caawiyaha Tooska ah (Chatbot)"
        title="Weydii caawiyaha garoonka"
        description="Bot-ku wuxuu marka hore hubiyaa macluumaadka tooska ah ee garoonka wuxuuna si toos ah u furayaa kiis caawinaad haddii loo baahdo shaqaale."
        icon={Bot}
      />

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <section className="surface p-4 sm:p-5">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Soo raraya wada sheekaysiga...
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-800">
                  Qofka Gacanta ku Haya:{" "}
                  <span className="text-blue-700">
                    {conversation?.assigned_to
                      ? `${conversation.assigned_to.role.toUpperCase()} - ${conversation.assigned_to.username}`
                      : conversation?.assigned_role
                        ? conversation.assigned_role.toUpperCase()
                        : "BOT MARKA HORE, SHAQAALE HADDII LOO GUDBIYO"}
                  </span>
                </p>
                {conversation?.status && (
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${statusStyle(conversation.status)}`}>
                    {conversation.status.replace("_", " ")}
                  </span>
                )}
              </div>

              {conversation?.id && conversation.status !== "closed" && (
                <button
                  type="button"
                  onClick={closeConversation}
                  disabled={closing}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  Xir sheekada
                </button>
              )}
            </div>

            <div className="h-[380px] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
              {[...(conversation?.messages || []), ...automatedMessages].length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  Weydii wax ku saabsan dhacdooyinka la heli karo, qiimaha, iibsashada tikidhada, lacag-bixinta, lacag-celinta, albaabbada, ama skaan-raynta tikidhada.
                </div>
              ) : (
                <div className="space-y-3">
                  {[...(conversation?.messages || []), ...automatedMessages].map((item) => {
                    const mine = item.sender_role === "user";
                    return (
                      <div key={item.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[86%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                            mine
                              ? "bg-blue-600 text-white"
                              : item.sender_role === "bot"
                                ? "border border-blue-100 bg-blue-50 text-blue-900"
                                : "border border-slate-200 bg-white text-slate-700"
                          }`}
                        >
                          <p className={`text-[11px] font-semibold ${mine ? "text-blue-100" : item.sender_role === "bot" ? "text-blue-600" : "text-slate-500"}`}>
                            {senderLabel(item)}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap">{item.message}</p>
                          <p className={`mt-1 text-[11px] ${mine ? "text-blue-100" : item.sender_role === "bot" ? "text-blue-500" : "text-slate-400"}`}>
                            {formatTime(item.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-end gap-2">
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Weydii su'aal. Arrimaha aan la xallin si toos ah ayaa loogu gudbinayaa shaqaalaha..."
                className="min-h-[62px] w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={!canSend}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                aria-label="Send message"
              >
                {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendHorizontal className="h-5 w-5" />}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function readStoredBotMessages(storageKey) {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
