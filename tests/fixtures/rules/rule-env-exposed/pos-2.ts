// Positive Fixture 2: Next.js public client prefix on secret
export const clientConfig = {
  exposedSecret: process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY,
};
