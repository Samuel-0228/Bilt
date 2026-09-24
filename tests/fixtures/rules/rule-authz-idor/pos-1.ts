// Positive Fixture 1: Trusting req.body.isAdmin
export function handleUpdate(req: any, res: any) {
  if (req.body.isAdmin) {
    // Escalate user permissions
    req.session.role = "admin";
  }
  res.json({ ok: true });
}
