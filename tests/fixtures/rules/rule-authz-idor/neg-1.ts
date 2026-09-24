// Negative Fixture 1: Deriving role from authenticated server session
export function handleUpdate(req: any, res: any) {
  if (req.user && req.user.role === "admin") {
    // Verified server session
    res.json({ ok: true });
  } else {
    res.status(403).json({ error: "Forbidden" });
  }
}
