// Positive Fixture 3: Next.js App Router ALL handler
export async function ALL(request: Request) {
  return Response.json({ status: "handled any method" });
}
