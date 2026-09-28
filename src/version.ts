import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string; name: string };

export const VERSION: string = pkg.version;
export const PACKAGE_NAME: string = pkg.name;
