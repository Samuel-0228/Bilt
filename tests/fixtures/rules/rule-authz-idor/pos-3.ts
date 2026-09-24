// Positive Fixture 3: Relying on localStorage for admin check
export function checkAdminClient() {
  const role = localStorage.getItem("role");
  return role === "admin";
}
