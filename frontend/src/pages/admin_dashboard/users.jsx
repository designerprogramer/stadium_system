import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Trash2, UserPlus, X } from "lucide-react";

import API from "../../lib/api";
import { getApiErrorMessage } from "../../lib/apiError";
import DashboardPageHeader from "../../components/DashboardPageHeader";

const NEW_USER = {
  username: "",
  email: "",
  first_name: "",
  last_name: "",
  role: "staff",
  password: "",
};

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [newUser, setNewUser] = useState(NEW_USER);
  const [editingUserId, setEditingUserId] = useState(null);
  const [editData, setEditData] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = {};
      if (roleFilter !== "all") {
        params.role = roleFilter;
      }
      if (search.trim()) {
        params.q = search.trim();
      }

      const response = await API.get("/admin/users/", { params });
      setUsers(response.data);
    } catch (apiError) {
      setError("Failed to load users.");
      console.error(apiError);
    } finally {
      setLoading(false);
    }
  }, [roleFilter, search]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadUsers();
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [loadUsers]);

  const handleNewUserChange = (event) => {
    const { name, value } = event.target;
    setNewUser((prev) => ({ ...prev, [name]: value }));
  };

  const createUser = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await API.post("/admin/users/", newUser);
      setMessage("User created successfully.");
      setNewUser(NEW_USER);
      await loadUsers();
    } catch (apiError) {
      setError(getApiErrorMessage(apiError, "Failed to create user."));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (user) => {
    setEditingUserId(user.id);
    setEditData({
      username: user.username || "",
      email: user.email || "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      role: user.role || "user",
      is_active: Boolean(user.is_active),
      password: "",
    });
  };

  const updateUser = async (userId) => {
    if (!editData) return;
    setSaving(true);
    setError("");
    setMessage("");

    const payload = { ...editData };
    if (!payload.password) {
      delete payload.password;
    }

    try {
      await API.patch(`/admin/users/${userId}/`, payload);
      setMessage("User updated successfully.");
      setEditingUserId(null);
      setEditData(null);
      await loadUsers();
    } catch (apiError) {
      setError(getApiErrorMessage(apiError, "Failed to update user."));
    } finally {
      setSaving(false);
    }
  };

  const requestDeleteUser = (user) => {
    setDeleteTarget(user);
  };

  const confirmDeleteUser = async () => {
    if (!deleteTarget) {
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await API.delete(`/admin/users/${deleteTarget.id}/`);
      setMessage("User deleted successfully.");
      setDeleteTarget(null);
      await loadUsers();
    } catch (apiError) {
      setError(getApiErrorMessage(apiError, "Failed to delete user."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <DashboardPageHeader
        eyebrow="Access control"
        title="Manage Staff And User Accounts"
        description="Create, edit, and deactivate account access from one place."
        icon={UserPlus}
      />

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-blue-700" />
          <h3 className="text-lg font-bold text-slate-900">Add New Account</h3>
        </div>

        <form onSubmit={createUser} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <input
            name="username"
            value={newUser.username}
            onChange={handleNewUserChange}
            required
            placeholder="Username"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
          />
          <input
            type="email"
            name="email"
            value={newUser.email}
            onChange={handleNewUserChange}
            required
            placeholder="Email"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
          />
          <input
            name="first_name"
            value={newUser.first_name}
            onChange={handleNewUserChange}
            placeholder="First name"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
          />
          <input
            name="last_name"
            value={newUser.last_name}
            onChange={handleNewUserChange}
            placeholder="Last name"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
          />
          <select
            name="role"
            value={newUser.role}
            onChange={handleNewUserChange}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
          >
            <option value="staff">Staff</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <input
            type="password"
            name="password"
            value={newUser.password}
            onChange={handleNewUserChange}
            required
            placeholder="Password"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
          />

          <button
            type="submit"
            disabled={saving}
            className="md:col-span-2 xl:col-span-3 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {saving ? "Saving..." : "Create account"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search users"
            className="min-w-[220px] flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
          />
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
          >
            <option value="all">All roles</option>
            <option value="staff">Staff</option>
            <option value="user">Users</option>
            <option value="admin">Admins</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center text-slate-500">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Loading users...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-2 font-semibold">Username</th>
                  <th className="pb-2 font-semibold">Email</th>
                  <th className="pb-2 font-semibold">Role</th>
                  <th className="pb-2 font-semibold">Status</th>
                  <th className="pb-2 font-semibold">Joined</th>
                  <th className="pb-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isEditing = editingUserId === user.id;

                  return (
                    <tr key={user.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-2">
                        {isEditing ? (
                          <input
                            value={editData?.username || ""}
                            onChange={(event) => setEditData((prev) => ({ ...prev, username: event.target.value }))}
                            className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          />
                        ) : (
                          <span className="font-semibold text-slate-800">{user.username}</span>
                        )}
                      </td>

                      <td className="py-2">
                        {isEditing ? (
                          <input
                            value={editData?.email || ""}
                            onChange={(event) => setEditData((prev) => ({ ...prev, email: event.target.value }))}
                            className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          />
                        ) : (
                          <span className="text-slate-600">{user.email}</span>
                        )}
                      </td>

                      <td className="py-2">
                        {isEditing ? (
                          <select
                            value={editData?.role || "user"}
                            onChange={(event) => setEditData((prev) => ({ ...prev, role: event.target.value }))}
                            className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          >
                            <option value="staff">staff</option>
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                          </select>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase text-slate-700">
                            {user.role}
                          </span>
                        )}
                      </td>

                      <td className="py-2">
                        {isEditing ? (
                          <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={Boolean(editData?.is_active)}
                              onChange={(event) =>
                                setEditData((prev) => ({
                                  ...prev,
                                  is_active: event.target.checked,
                                }))
                              }
                            />
                            Active
                          </label>
                        ) : user.is_active ? (
                          <span className="text-emerald-700">Active</span>
                        ) : (
                          <span className="text-rose-700">Inactive</span>
                        )}
                      </td>

                      <td className="py-2 text-slate-500">{new Date(user.date_joined).toLocaleDateString()}</td>

                      <td className="py-2">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="password"
                              placeholder="New password (optional)"
                              value={editData?.password || ""}
                              onChange={(event) => setEditData((prev) => ({ ...prev, password: event.target.value }))}
                              className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => updateUser(user.id)}
                              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingUserId(null);
                                setEditData(null);
                              }}
                              className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(user)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => requestDeleteUser(user)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Delete User Account</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete <span className="font-semibold">{deleteTarget.username}</span>? This action cannot be undone.
            </p>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteUser}
                disabled={saving}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-400"
              >
                {saving ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
