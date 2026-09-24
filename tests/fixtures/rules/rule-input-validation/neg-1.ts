import express from "express";
import { z } from "zod";

const app = express();
const prisma: any = {};

const UserSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
});

// Negative Fixture 1: Express endpoint validating with Zod
app.post("/api/users", async (req, res) => {
  const validated = UserSchema.parse(req.body);
  const user = await prisma.user.create({ data: validated });
  res.json(user);
});

export default app;
