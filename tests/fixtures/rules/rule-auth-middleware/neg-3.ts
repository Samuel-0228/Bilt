// Negative Fixture 3: Next.js App Router route with getServerSession / auth check
export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json({ deleted: true });
}

function getServerSession() {
  return Promise.resolve({ user: "admin" });
}
