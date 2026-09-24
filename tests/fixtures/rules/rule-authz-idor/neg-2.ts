// Negative Fixture 2: Verified session object
export function getPermissions(session: any) {
  return session.user?.isAdmin ? ["all"] : ["read"];
}
