import express from "express";

const app = express();
const prisma: any = {};

// Positive Fixture 1: Express endpoint passing req.body directly to prisma
app.post("/api/users", async (req, res) => {
  const user = await prisma.user.create({ data: req.body });
  res.json(user);
});

export default app;
