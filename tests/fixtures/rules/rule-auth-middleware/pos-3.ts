// Positive Fixture 3: Next.js App Router admin deletion without auth check
export async function DELETE(request: Request) {
  // Directly performing admin mutation without session or auth
  return Response.json({ deleted: true });
}
