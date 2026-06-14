import RoleLoginForm from "../components/RoleLoginForm";

export default function AdminLogin() {
  return (
    <RoleLoginForm
      title="Admin Login"
      roleName="Admin"
      loginEndpoint="/login/admin/"
      accentClass="bg-slate-900 hover:bg-black"
    />
  );
}
