import { describe, it, expect } from "vitest";
import {
  TAXONOMY,
  MANDATORY_CATEGORIES,
  getAllCategories,
  getCategoryMeta,
  isMandatoryCategory,
} from "../../src/core/readiness/taxonomy.js";

describe("Readiness Taxonomy", () => {
  it("should contain exactly 14 categories", () => {
    expect(TAXONOMY).toHaveLength(14);
    expect(getAllCategories()).toHaveLength(14);
  });

  it("should define exactly 6 mandatory categories", () => {
    expect(MANDATORY_CATEGORIES).toHaveLength(6);
    expect(MANDATORY_CATEGORIES).toEqual([
      "secrets-and-env",
      "auth",
      "authorization",
      "input-validation",
      "api-abuse-and-cost",
      "database",
    ]);
  });

  it("should correctly identify mandatory categories", () => {
    expect(isMandatoryCategory("secrets-and-env")).toBe(true);
    expect(isMandatoryCategory("auth")).toBe(true);
    expect(isMandatoryCategory("authorization")).toBe(true);
    expect(isMandatoryCategory("input-validation")).toBe(true);
    expect(isMandatoryCategory("api-abuse-and-cost")).toBe(true);
    expect(isMandatoryCategory("database")).toBe(true);

    expect(isMandatoryCategory("dependencies")).toBe(false);
    expect(isMandatoryCategory("file-uploads")).toBe(false);
    expect(isMandatoryCategory("payments")).toBe(false);
    expect(isMandatoryCategory("privacy-and-pii")).toBe(false);
    expect(isMandatoryCategory("monitoring-rollback")).toBe(false);
  });

  it("should provide metadata for every category", () => {
    for (const cat of getAllCategories()) {
      const meta = getCategoryMeta(cat);
      expect(meta).toBeDefined();
      expect(meta!.id).toBe(cat);
      expect(meta!.name).toBeTruthy();
      expect(meta!.description).toBeTruthy();
      expect(["automated", "guided"]).toContain(meta!.mode);
      expect(["enforced", "guided", "partial", "coming-soon"]).toContain(
        meta!.enforcement,
      );
    }
  });
});
