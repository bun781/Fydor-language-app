import { describe, expect, it } from "vitest";
import { getTourSteps, resolveTourScope } from "@/components/system/guidedTourCatalog";

describe("guided tour route scopes", () => {
  it("opens the lesson library tour from the lessons route", () => {
    const scope = resolveTourScope("/lessons/manage");

    expect(scope).toBe("/lessons/manage::lessons");
    expect(getTourSteps(scope)).not.toBeNull();
  });

  it("opens the builder tour from the builder route alias", () => {
    const scope = resolveTourScope("/admin/imports");

    expect(scope).toBe("/lessons/manage::builder");
    expect(getTourSteps(scope)).not.toBeNull();
  });
});
