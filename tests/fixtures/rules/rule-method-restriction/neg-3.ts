// Negative Fixture 3: Next.js explicit GET method
export async function GET(request: Request) {
  return Response.json({ status: "handled GET" });
}
