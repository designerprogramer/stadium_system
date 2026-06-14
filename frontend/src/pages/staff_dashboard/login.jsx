import RoleLoginForm from "../../components/RoleLoginForm";

export default function StaffLogin() {
  return (
    <RoleLoginForm
      title="Staff Login"
      roleName="Staff"
      loginEndpoint="/login/staff/"
      accentClass="bg-emerald-600 hover:bg-emerald-700"
    />
  );
}
