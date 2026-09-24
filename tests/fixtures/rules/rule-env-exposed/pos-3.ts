// Positive Fixture 3: Vite client prefix on database password
export const viteConfig = {
  dbPassword: import.meta.env.VITE_DB_PASSWORD,
};
