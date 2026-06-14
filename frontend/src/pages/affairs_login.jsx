import RoleLoginForm from "../components/RoleLoginForm";

export default function AffairsLogin() {
  return (
    <RoleLoginForm
      title="Affairs Login"
      roleName="Affairs"
      loginEndpoint="/login/affairs/"
      accentClass="bg-purple-600 hover:bg-purple-700"
    />
  );
}
