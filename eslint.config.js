export default [
  {
    ignores: ["dist/**/*", "coverage/**/*", "node_modules/**/*", "**/*.ts"],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "off",
      "no-console": "off",
    },
  },
];
