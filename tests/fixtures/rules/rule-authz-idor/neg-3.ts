// Negative Fixture 3: Query parameter passed to authorization checker
export function verifyOwnership(req: any, ownerId: string) {
  return req.user.id === ownerId;
}
