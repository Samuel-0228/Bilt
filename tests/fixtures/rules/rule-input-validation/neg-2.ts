import { z } from "zod";

const db: any = {};
const Schema = z.object({ name: z.string() });

// Negative Fixture 2: Next.js route with schema safeParse
export async function POST(request: Request) {
  const json = await request.json();
  const parsed = Schema.safeParse(json);
  if (!parsed.success) {
    return new Response("Invalid body", { status: 400 });
  }
  const res = await db.insert(parsed.data);
  return Response.json(res);
}
