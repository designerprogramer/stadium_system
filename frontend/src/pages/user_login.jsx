import RoleLoginForm from "../components/RoleLoginForm";

export default function UserLogin() {
  return (
    <RoleLoginForm
      title="Customer Login"
      roleName="Customer"
      loginEndpoint="/login/user/"
      accentClass=""
    />
  );
}
