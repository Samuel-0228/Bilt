// Positive Fixture 2: Trusting req.query.role
export function getPermissions(req: any, res: any) {
  const role = req.query.role || "viewer";
  res.json({ role });
}
