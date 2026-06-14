import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCheck,
  Loader2,
  SendHorizontal,
  ShieldAlert,
  UserCheck,
} from "lucide-react";

import API from "../../lib/api";
import DashboardPageHeader from "../../components/DashboardPageHeader";

function formatTime(value) {
  if (!value) return "";
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
  if (status === "assigned") return "bg-indigo-100 text-indigo-700";
  return "bg-amber-100 text-amber-700";
}

function senderLabel(message) {
  if (!message?.sender) return "Support";
  if (message.sender_role === "user") return `User - ${message.sender.username}`;
  if (message.sender_role === "staff") return `Staff - ${message.sender.username}`;
  if (message.sender_role === "admin") return `Admin - ${message.sender.username}`;
  return message.sender.username;
}

export default function SupportInbox({ role }) {
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState("");
  const [reply, setReply] = useState("");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [scope, setScope] = useState("admin");

  const canReply = useMemo(() => Boolean(reply.trim()) && !sending, [reply, sending]);

  const loadConversations = useCallback(async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }

    const params = {};
    if (statusFilter !== "all") params.status = statusFilter;
    if (mineOnly) params.mine = 1;
    if (query.trim()) params.q = query.trim();
    if (role === "admin") params.scope = scope;

    try {
      const response = await API.get("/support/conversations/", { params });
      const items = response.data || [];
      setConversations(items);
      setError("");

      if (!selectedId && items.length) {
        setSelectedId(items[0].id);
      }
      if (selectedId && !items.some((item) => item.id === selectedId)) {
        setSelectedId(items[0]?.id || null);
      }
    } catch (apiError) {
      console.error(apiError);
      setError("Failed to load support conversations.");
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [mineOnly, query, role, scope, selectedId, statusFilter]);

  const loadConversationDetail = useCallback(async (conversationId, showLoader = false) => {
    if (!conversationId) {
      setSelectedConversation(null);
      return;
    }

    if (showLoader) {
      setDetailLoading(true);
    }

    try {
      const response = await API.get(`/support/conversations/${conversationId}/`);
      setSelectedConversation(response.data);
      setError("");
    } catch (apiError) {
      console.error(apiError);
      setError("Failed to load conversation details.");
    } finally {
      if (showLoader) {
        setDetailLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const initialLoadTimer = setTimeout(() => {
      void loadConversations(true);
    }, 0);

    return () => clearTimeout(initialLoadTimer);
  }, [loadConversations]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadConversations(false);
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [loadConversations]);

  useEffect(() => {
    const detailLoadTimer = setTimeout(() => {
      void loadConversationDetail(selectedId, true);
    }, 0);

    return () => clearTimeout(detailLoadTimer);
  }, [loadConversationDetail, selectedId]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      void loadConversations(false);
      if (selectedId) {
        void loadConversationDetail(selectedId, false);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [loadConversationDetail, loadConversations, selectedId]);

  const sendReply = async () => {
    const text = reply.trim();
    if (!text || !selectedId) {
      return;
    }

    setSending(true);
    setError("");
    try {
      const response = await API.post(`/support/conversations/${selectedId}/messages/`, {
        message: text,
      });
      setSelectedConversation(response.data);
      setReply("");
      await loadConversations(false);
    } catch (apiError) {
      console.error(apiError);
      setError(apiError?.response?.data?.detail || "Failed to send reply.");
    } finally {
      setSending(false);
    }
  };

  const assignSelf = async () => {
    if (!selectedId) return;
    setActionLoading(true);
    setError("");
    try {
      const response = await API.patch(`/support/conversations/${selectedId}/assign-self/`);
      setSelectedConversation(response.data);
      await loadConversations(false);
    } catch (apiError) {
      console.error(apiError);
      setError(apiError?.response?.data?.detail || "Failed to assign conversation.");
    } finally {
      setActionLoading(false);
    }
  };

  const escalateToAdmin = async () => {
    if (!selectedId || role !== "staff") return;
    setActionLoading(true);
    setError("");
    try {
      const response = await API.patch(`/support/conversations/${selectedId}/escalate/`);
      setSelectedConversation(response.data);
      await loadConversations(false);
    } catch (apiError) {
      console.error(apiError);
      setError(apiError?.response?.data?.detail || "Failed to escalate conversation.");
    } finally {
      setActionLoading(false);
    }
  };

  const setConversationStatus = async (nextStatus) => {
    if (!selectedId || !nextStatus) return;
    setActionLoading(true);
    setError("");
    try {
      const response = await API.patch(`/support/conversations/${selectedId}/status/`, {
        status: nextStatus,
      });
      setSelectedConversation(response.data);
      await loadConversations(false);
    } catch (apiError) {
      console.error(apiError);
      setError(apiError?.response?.data?.detail || "Failed to update status.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <DashboardPageHeader
        eyebrow="Human support inbox"
        title={role === "admin" ? "Admin Support Queue" : "Staff Support Queue"}
        description="Pick a conversation, take action, and send real replies to users."
        icon={SendHorizontal}
      />

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[360px,1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="space-y-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search user or issue"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
            />

            <div className="grid grid-cols-2 gap-2">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
              >
                <option value="all">All status</option>
                <option value="new">New</option>
                <option value="assigned">Assigned</option>
                <option value="waiting_user">Waiting user</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>

              {role === "admin" ? (
                <select
                  value={scope}
                  onChange={(event) => setScope(event.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
                >
                  <option value="admin">Admin queue</option>
                  <option value="all">All conversations</option>
                </select>
              ) : (
                <button
                  type="button"
                  onClick={() => setMineOnly((prev) => !prev)}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    mineOnly
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {mineOnly ? "Mine only" : "All queue"}
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <div className="py-8 text-center text-sm text-slate-500">
                <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                Loading queue...
              </div>
            ) : conversations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                No conversations match this filter.
              </div>
            ) : (
              conversations.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selectedId === item.id
                      ? "border-blue-300 bg-blue-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{item.user?.username || "User"}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusStyle(item.status)}`}>
                      {item.status?.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {item.last_message_preview || "No message yet"}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {formatTime(item.last_message_at || item.created_at)}
                  </p>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          {!selectedId ? (
            <div className="flex h-[520px] items-center justify-center text-sm text-slate-500">
              Select a conversation from the queue.
            </div>
          ) : detailLoading && !selectedConversation ? (
            <div className="flex h-[520px] items-center justify-center text-sm text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading conversation...
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <p className="text-lg font-bold text-slate-900">
                    {selectedConversation?.user?.username || "User"} support thread
                  </p>
                  <p className="text-xs text-slate-500">
                    Action taker:{" "}
                    {selectedConversation?.assigned_to
                      ? `${selectedConversation.assigned_to.role.toUpperCase()} - ${selectedConversation.assigned_to.username}`
                      : selectedConversation?.assigned_role?.toUpperCase()}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Category: {selectedConversation?.category} | Priority: {selectedConversation?.priority}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={assignSelf}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <UserCheck className="h-4 w-4" />
                    Assign me
                  </button>

                  {role === "staff" && (
                    <button
                      type="button"
                      onClick={escalateToAdmin}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ShieldAlert className="h-4 w-4" />
                      Escalate
                    </button>
                  )}

                  <select
                    value={selectedConversation?.status || ""}
                    onChange={(event) => setConversationStatus(event.target.value)}
                    disabled={actionLoading}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none"
                  >
                    <option value="new">New</option>
                    <option value="assigned">Assigned</option>
                    <option value="waiting_user">Waiting user</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="h-[380px] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
                {!selectedConversation?.messages?.length ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    No messages yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedConversation.messages.map((item) => {
                      const isAgent = item.sender_role === "staff" || item.sender_role === "admin";
                      const mine = isAgent && item.sender?.role === role;
                      return (
                        <div key={item.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm ${
                              mine ? "bg-blue-700 text-white" : "border border-slate-200 bg-white text-slate-700"
                            }`}
                          >
                            <p className={`text-[11px] font-semibold ${mine ? "text-blue-100" : "text-slate-500"}`}>
                              {senderLabel(item)}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap">{item.message}</p>
                            <p className={`mt-1 text-[11px] ${mine ? "text-blue-100" : "text-slate-400"}`}>
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
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      sendReply();
                    }
                  }}
                  placeholder="Write your reply to user..."
                  className="min-h-[62px] w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-700"
                />
                <button
                  type="button"
                  onClick={sendReply}
                  disabled={!canReply}
                  className="rounded-full bg-blue-700 p-3 text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  aria-label="Send reply"
                >
                  {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendHorizontal className="h-5 w-5" />}
                </button>
              </div>

              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <CheckCheck className="h-4 w-4 text-slate-400" />
                Replies are human only. User receives your message directly.
              </div>
              {selectedConversation?.priority === "urgent" && (
                <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-rose-600">
                  <AlertTriangle className="h-4 w-4" />
                  Urgent case: prioritize response and resolution.
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
