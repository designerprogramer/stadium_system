import RoleLoginForm from "../components/RoleLoginForm";

export default function SupportLogin() {
  return (
    <RoleLoginForm
      title="Support Login"
      roleName="Support"
      loginEndpoint="/login/support/"
      accentClass="bg-blue-600 hover:bg-blue-700"
    />
  );
}
