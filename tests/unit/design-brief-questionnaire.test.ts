import { describe, it, expect } from "vitest";
import { parseColorInput } from "../../src/core/design/brief/questionnaire.js";

describe("Design Brief Questionnaire - parseColorInput", () => {
  it("parses empty string to empty array", () => {
    expect(parseColorInput("")).toEqual([]);
    expect(parseColorInput("   ")).toEqual([]);
  });

  it("parses space separated colors", () => {
    expect(parseColorInput("#ff0000 #00ff00")).toEqual(["#ff0000", "#00ff00"]);
  });

  it("parses comma separated colors", () => {
    expect(parseColorInput("#ff0000, cream, dark blue")).toEqual(["#ff0000", "cream", "dark", "blue"]);
  });
});
