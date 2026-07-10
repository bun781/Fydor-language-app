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

  it.each([
    ["/fydor-exchange", "/fydor-exchange"],
    ["/fydor-exchange/import", "/fydor-exchange::install"],
    ["/fydor-exchange/export", "/fydor-exchange::export"],
    ["/review", "/review::start"],
    ["/study/imported-content", "/study/imported-content"],
    ["/study/fill-blank", "/study/fill-blank"],
    ["/study/multiple-choice", "/study/multiple-choice"]
  ])("resolves the page guide for %s", (route, expectedScope) => {
    const scope = resolveTourScope(route);

    expect(scope).toBe(expectedScope);
    expect(getTourSteps(scope)).not.toBeNull();
  });
});
