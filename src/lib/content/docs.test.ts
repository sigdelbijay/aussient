import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkSection, cleanConfig, isDocKey, scheduleProblem, type HomeSectionDoc } from "./docs";

const section = (type: HomeSectionDoc["type"], config: Record<string, unknown>, extra: Partial<HomeSectionDoc> = {}): HomeSectionDoc => ({
  id: "s1",
  type,
  title: "",
  active: true,
  startsAt: "",
  endsAt: "",
  config,
  ...extra,
});

describe("checkSection", () => {
  it("accepts a complete hero and drops blank optional boxes", () => {
    const result = checkSection(
      section("hero", {
        headline: "New season",
        subheading: "  ",
        image: "https://res.cloudinary.com/demo/image/upload/hero.jpg",
        button: { label: "Shop now", href: "/new-in" },
        secondaryButton: { label: "", href: "" },
      }),
    );
    assert.deepEqual(result, {
      config: { headline: "New season", image: "https://res.cloudinary.com/demo/image/upload/hero.jpg", button: { label: "Shop now", href: "/new-in" } },
    });
  });

  it("lists what's missing in plain words", () => {
    const result = checkSection(section("promo-banner", { heading: "Sale" }, { title: "Big sale" }));
    assert.ok("problems" in result);
    assert.match(result.problems.join("\n"), /Big sale: image — required/);
  });

  it("rejects pictures from outside the media library and unsafe links", () => {
    const result = checkSection(
      section("gift-guide", { cards: [{ title: "For her", image: "https://evil.example/a.jpg", href: "javascript:alert(1)" }] }),
    );
    assert.ok("problems" in result);
    assert.equal(result.problems.length, 2);
    assert.match(result.problems[0], /cards 1 image — upload it/);
    assert.match(result.problems[1], /cards 1 href — use a shop page/);
  });

  it("checks the start and end dates", () => {
    const result = checkSection(section("newsletter", { heading: "Join" }, { startsAt: "2026-12-01T09:00", endsAt: "2026-11-01T09:00" }));
    assert.ok("problems" in result);
    assert.match(result.problems[0], /end must be after the start/);
  });
});

describe("helpers", () => {
  it("cleanConfig removes empty text, lists and links", () => {
    assert.deepEqual(cleanConfig({ a: " x ", b: "", c: { label: "", href: "" }, d: ["", "y"], e: 3 }), { a: "x", d: ["y"], e: 3 });
  });

  it("scheduleProblem is blank for a valid range or no dates", () => {
    assert.equal(scheduleProblem("", ""), "");
    assert.equal(scheduleProblem("2026-11-01T09:00", "2026-11-02T09:00"), "");
    assert.equal(scheduleProblem("tomorrow", ""), "the start date isn't a date");
  });

  it("isDocKey only allows known content", () => {
    assert.ok(isDocKey("home"));
    assert.ok(isDocKey("page:clx123"));
    assert.ok(!isDocKey("settings"));
    assert.ok(!isDocKey("page:../../etc"));
  });
});
