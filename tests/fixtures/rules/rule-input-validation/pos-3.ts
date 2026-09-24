// Positive Fixture 3: Next.js route inserting body directly to db
const db: any = {};

export async function POST(request: Request) {
  const body = await request.json();
  const res = await db.insert(body);
  return Response.json(res);
}
