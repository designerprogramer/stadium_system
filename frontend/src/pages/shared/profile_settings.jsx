import { useEffect, useMemo, useState } from "react";
import { Camera, KeyRound, Loader2, Save, UserRound } from "lucide-react";

import API from "../../lib/api";
import { getAuthSession, saveAuthSession } from "../../lib/auth";
import DashboardPageHeader from "../../components/DashboardPageHeader";

function roleLabel(role) {
  if (role === "admin") return "Administrator";
  if (role === "staff") return "Staff";
  return "User";
}

function mediaUrl(value) {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("blob:")) return value;
  const apiRoot = (API.defaults.baseURL || "").replace(/\/api\/?$/, "");
  return `${apiRoot}${value.startsWith("/") ? "" : "/"}${value}`;
}

function initialsFor(name) {
  return (
    name
      .split(/\s|_/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "U"
  );
}

export default function ProfileSettingsPage() {
  const [profile, setProfile] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    role: "",
    profile_picture: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [loading, setLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [selectedPicture, setSelectedPicture] = useState(null);
  const [picturePreview, setPicturePreview] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [error, setError] = useState("");

  const fullName = useMemo(() => {
    const joined = `${profile.first_name} ${profile.last_name}`.trim();
    return joined || profile.username || "Profile";
  }, [profile]);

  const loadProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await API.get("/me/");
      setProfile(response.data);
    } catch (apiError) {
      setError(apiError?.response?.data?.detail || "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePictureChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedPicture(file);
    setPicturePreview(URL.createObjectURL(file));
  };

  const submitProfile = async (event) => {
    event.preventDefault();
    setProfileMessage("");
    setError("");
    setProfileSaving(true);

    try {
      const payload = new FormData();
      payload.append("username", profile.username);
      payload.append("email", profile.email);
      payload.append("first_name", profile.first_name || "");
      payload.append("last_name", profile.last_name || "");
      if (selectedPicture) {
        payload.append("profile_picture", selectedPicture);
      }

      const response = await API.patch("/me/", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setProfile(response.data);
      setSelectedPicture(null);
      setPicturePreview("");
      setProfileMessage("Profile updated successfully.");

      const session = getAuthSession();
      if (session?.user) {
        saveAuthSession({
          ...session,
          user: {
            ...session.user,
            username: response.data.username,
            email: response.data.email,
            first_name: response.data.first_name,
            last_name: response.data.last_name,
            profile_picture: response.data.profile_picture,
          },
        });
      }
      window.dispatchEvent(new CustomEvent("profile:changed", { detail: { user: response.data } }));
    } catch (apiError) {
      const detail = apiError?.response?.data;
      if (typeof detail === "string") {
        setError(detail);
      } else if (detail?.detail) {
        setError(detail.detail);
      } else {
        setError("Failed to update profile.");
      }
    } finally {
      setProfileSaving(false);
    }
  };

  const submitPassword = async (event) => {
    event.preventDefault();
    setPasswordMessage("");
    setError("");
    setPasswordSaving(true);

    try {
      await API.post("/me/change-password/", passwordForm);
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
      setPasswordMessage("Password changed successfully.");
    } catch (apiError) {
      const detail = apiError?.response?.data;
      if (typeof detail === "string") {
        setError(detail);
      } else if (detail?.detail) {
        setError(detail.detail);
      } else if (detail?.current_password?.[0]) {
        setError(detail.current_password[0]);
      } else if (detail?.confirm_password?.[0]) {
        setError(detail.confirm_password[0]);
      } else if (detail?.new_password?.[0]) {
        setError(detail.new_password[0]);
      } else {
        setError("Failed to change password.");
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
        Loading profile...
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-12">
      <DashboardPageHeader
        eyebrow="Account"
        title="Profile Settings"
        description={`${fullName} | ${roleLabel(profile.role)}`}
        icon={UserRound}
      />

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={submitProfile} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-2">
              <UserRound className="h-5 w-5 text-slate-700" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Basic Information</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="relative h-24 w-24 shrink-0">
                {picturePreview || profile.profile_picture ? (
                  <img
                    src={mediaUrl(picturePreview || profile.profile_picture)}
                    alt=""
                    className="h-24 w-24 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-900 text-3xl font-semibold text-white">
                    {initialsFor(fullName)}
                  </span>
                )}
                <label className="absolute bottom-0 right-0 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-slate-900 text-white shadow-lg transition hover:bg-black">
                  <Camera className="h-4 w-4" />
                  <input type="file" accept="image/*" onChange={handlePictureChange} className="sr-only" />
                </label>
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-slate-950">{fullName}</p>
                <p className="mt-1 truncate text-sm text-slate-500">{profile.email}</p>
                <p className="mt-2 text-xs font-semibold text-slate-500">Click the camera to choose a profile picture.</p>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Username</label>
              <input
                name="username"
                value={profile.username}
                onChange={handleProfileChange}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Email</label>
              <input
                type="email"
                name="email"
                value={profile.email}
                onChange={handleProfileChange}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">First name</label>
                <input
                  name="first_name"
                  value={profile.first_name || ""}
                  onChange={handleProfileChange}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Last name</label>
                <input
                  name="last_name"
                  value={profile.last_name || ""}
                  onChange={handleProfileChange}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <span className="text-xs text-slate-500">Role: {roleLabel(profile.role)}</span>
            <button
              type="submit"
              disabled={profileSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {profileSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save profile
            </button>
          </div>

          {profileMessage && <p className="mt-3 text-sm font-semibold text-emerald-700">{profileMessage}</p>}
        </form>

        <form onSubmit={submitPassword} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-2">
              <KeyRound className="h-5 w-5 text-slate-700" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Security</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Current password</label>
              <input
                type="password"
                name="current_password"
                value={passwordForm.current_password}
                onChange={handlePasswordChange}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">New password</label>
              <input
                type="password"
                name="new_password"
                value={passwordForm.new_password}
                onChange={handlePasswordChange}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Confirm new password</label>
              <input
                type="password"
                name="confirm_password"
                value={passwordForm.confirm_password}
                onChange={handlePasswordChange}
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={passwordSaving}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-400"
          >
            {passwordSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Update password
          </button>

          {passwordMessage && <p className="mt-3 text-sm font-semibold text-emerald-700">{passwordMessage}</p>}
        </form>
      </div>
    </div>
  );
}
