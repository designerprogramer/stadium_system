import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, SendHorizontal, Users, Loader2 } from "lucide-react";
import API from "../../lib/api";
import { getCurrentUser } from "../../lib/auth";
import DashboardPageHeader from "../../components/DashboardPageHeader";

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function displayName(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() || user?.username || "Unknown";
}

function initialsFor(user) {
  return displayName(user)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

function profilePictureUrl(value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const apiBase = API.defaults.baseURL || "";
  const rootBase = apiBase.replace(/\/api\/?$/, "");
  return `${rootBase}${value.startsWith("/") ? value : `/${value}`}`;
}

function Avatar({ user, className = "h-9 w-9 text-xs" }) {
  const picture = profilePictureUrl(user?.profile_picture);
  if (picture) {
    return (
      <img
        src={picture}
        alt={displayName(user)}
        className={`${className} shrink-0 rounded-full border border-slate-200 object-cover`}
      />
    );
  }
  return (
    <div className={`${className} flex shrink-0 items-center justify-center rounded-full bg-slate-900 font-black text-white`}>
      {initialsFor(user)}
    </div>
  );
}

function roleBadge(role) {
  if (role === "admin") {
    return (
      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
        Admin
      </span>
    );
  }
  return (
    <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700">
      Staff
    </span>
  );
}

function UnreadBadge({ count }) {
  if (!count) return null;
  return (
    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-black text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

const GROUP_CHAT = { type: "group", id: "group", name: "Stadium Members" };

export default function TeamChat() {
  const currentUser = getCurrentUser();
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [activeChat, setActiveChat] = useState(GROUP_CHAT);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [error, setError] = useState("");
  const [unreadCounts, setUnreadCounts] = useState({ group: 0, direct: {} });
  const chatScrollRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);

  const activeMember = activeChat.type === "direct" ? members.find((member) => member.id === activeChat.id) : null;
  const visibleMembers = useMemo(() => members.filter((member) => member.id !== currentUser?.id), [members, currentUser]);

  const markChatRead = async (chat = activeChat) => {
    try {
      await API.post("/team-chat/mark-read/", chat.type === "direct" ? { recipient: chat.id } : {});
      setUnreadCounts((current) => {
        if (chat.type === "direct") {
          return {
            ...current,
            direct: { ...current.direct, [chat.id]: 0 },
          };
        }
        return { ...current, group: 0 };
      });
    } catch (err) {
      console.error(err);
    }
  };

  const loadUnreadCounts = async () => {
    try {
      const response = await API.get("/team-chat/unread-counts/");
      setUnreadCounts(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadMessages = async (showLoader = false, chat = activeChat) => {
    if (showLoader) {
      setLoading(true);
    }
    try {
      const response = await API.get("/team-chat/", {
        params: chat.type === "direct" ? { recipient: chat.id } : undefined,
      });
      setMessages(response.data);
      setError("");
      await markChatRead(chat);
    } catch (err) {
      console.error(err);
      setError("Wada sheekaysiga kooxda waa la waayay.");
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  const loadMembers = async () => {
    try {
      const response = await API.get("/team-members/");
      setMembers(response.data);
    } catch (err) {
      console.error(err);
      setError("Liiska xubnaha kooxda lama soo rari karin.");
    }
  };

  useEffect(() => {
    loadMembers();
    loadUnreadCounts();
  }, []);

  useEffect(() => {
    shouldAutoScrollRef.current = true;
    loadMessages(true, activeChat);

    const interval = setInterval(() => {
      loadMessages(false, activeChat);
      loadUnreadCounts();
    }, 3000);

    return () => clearInterval(interval);
  }, [activeChat]);

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      const element = chatScrollRef.current;
      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    }
  }, [messages]);

  const handleChatScroll = () => {
    const element = chatScrollRef.current;
    if (!element) return;

    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 80;
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const trimmed = messageText.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError("");
    try {
      shouldAutoScrollRef.current = true;
      const payload = { message: trimmed };
      if (activeChat.type === "direct") {
        payload.recipient = activeChat.id;
      }
      await API.post("/team-chat/", payload);
      setMessageText("");
      await loadMessages(false, activeChat);
      await loadUnreadCounts();
    } catch (err) {
      console.error(err);
      setError("Waa la diri waayay farriinta.");
    } finally {
      setSending(false);
    }
  };

  const selectChat = (chat) => {
    shouldAutoScrollRef.current = true;
    setActiveChat(chat);
    setMessageText("");
    markChatRead(chat);
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-12">
      <DashboardPageHeader
        eyebrow="Operations Communication"
        title="Stadium Team Chat"
        description="Wada sheekaysiga tooska ah ee u dhexeeya maamulka iyo shaqaalaha garoonka."
        icon={MessageSquare}
      />

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Users className="h-5 w-5 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">Kooxda Stadium</h3>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => selectChat(GROUP_CHAT)}
              className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition ${
                activeChat.type === "group"
                  ? "border-sky-300 bg-white"
                  : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50"
              }`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
                <Users className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-800">Stadium Members</p>
                <p className="truncate text-[11px] text-slate-500">Group chat</p>
              </div>
              <UnreadBadge count={unreadCounts.group} />
            </button>

            <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
              {visibleMembers.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => selectChat({ type: "direct", id: member.id, name: displayName(member) })}
                  className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition ${
                    activeChat.type === "direct" && activeChat.id === member.id
                      ? "border-sky-300 bg-white"
                      : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Avatar user={member} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-800">{displayName(member)}</p>
                    <div className="mt-0.5">{roleBadge(member.role)}</div>
                  </div>
                  <UnreadBadge count={unreadCounts.direct?.[member.id] || unreadCounts.direct?.[String(member.id)]} />
                </button>
              ))}
            </div>

            <p className="pt-1 text-[11px] italic text-slate-400">
              Dooro Stadium Members ama qof gaar ah si aad ula sheekaysato.
            </p>
          </div>
        </div>

        <div className="flex h-[500px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">
                {activeChat.type === "group" ? "Stadium Members" : displayName(activeMember)}
              </p>
              <p className="text-xs text-slate-500">
                {activeChat.type === "group" ? "All team group chat" : `Direct chat with @${activeMember?.username || ""}`}
              </p>
            </div>
            {activeChat.type === "direct" && activeMember && roleBadge(activeMember.role)}
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center text-slate-500">
              <Loader2 className="mr-2 h-6 w-6 animate-spin text-sky-500" />
              Soo raraya wada sheekaysiga...
            </div>
          ) : (
            <>
              <div
                ref={chatScrollRef}
                onScroll={handleChatScroll}
                className="flex-1 space-y-4 overflow-y-auto bg-slate-50/50 p-4"
              >
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm italic text-slate-400">
                    Ma jiraan farriimo hadda. Ku qor wax hoos ku yaal si aad u bilowdo.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.sender === currentUser?.id;
                    const senderRole = msg.sender_details?.role || "staff";

                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                            isMe
                              ? "bg-sky-600 text-white"
                              : "border border-slate-200 bg-white text-slate-800"
                          }`}
                        >
                          <div className="mb-1 flex items-center gap-2">
                            <span className={`text-[11px] font-bold ${isMe ? "text-sky-100" : "text-slate-600"}`}>
                              @{msg.sender_details?.username || "unknown"}
                            </span>
                            {!isMe && roleBadge(senderRole)}
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                          <span
                            className={`mt-1 block text-right text-[10px] ${
                              isMe ? "text-sky-100/70" : "text-slate-400"
                            }`}
                          >
                            {formatTime(msg.created_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form onSubmit={handleSend} className="flex gap-2 border-t border-slate-100 bg-white p-3">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={
                    activeChat.type === "group"
                      ? "Ku qor fariinta Stadium Members..."
                      : `Ku qor fariin ${displayName(activeMember)}...`
                  }
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
                <button
                  type="submit"
                  disabled={!messageText.trim() || sending}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-600 text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {sending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <SendHorizontal className="h-5 w-5" />
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
