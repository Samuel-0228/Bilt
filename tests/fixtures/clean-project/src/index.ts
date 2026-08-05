import capitalize from "lodash/capitalize";

const port = process.env.PORT || 3000;
console.log(`Server running on port ${port} with ${capitalize("clean")} state`);
export {};
