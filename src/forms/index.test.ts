import { describe, expect, it } from "vitest";
import { forms, getForm, isExampleForm, visibleForms } from "@/forms/index";

describe("form discovery", () => {
  it("discovers both example and top-level forms", () => {
    const slugs = forms.map((f) => f.slug);
    expect(slugs).toContain("ping");
    expect(slugs).toContain("contact");
    expect(slugs).toContain("add-new-job-opportunity");
  });

  it("getForm resolves by slug", () => {
    expect(getForm("contact")?.slug).toBe("contact");
    expect(getForm("nope")).toBeUndefined();
  });
});

describe("isExampleForm", () => {
  it("flags forms under forms/examples/ (including the relocated ping)", () => {
    expect(isExampleForm("ping")).toBe(true);
    expect(isExampleForm("contact")).toBe(true);
    expect(isExampleForm("wizard-demo")).toBe(true);
  });

  it("does not flag top-level non-example forms", () => {
    expect(isExampleForm("add-new-job-opportunity")).toBe(false);
    expect(isExampleForm("add-job-opportunity-info")).toBe(false);
  });
});

describe("visibleForms", () => {
  it("returns every form when examples are enabled", () => {
    expect(visibleForms(true)).toHaveLength(forms.length);
  });

  it("omits example forms when examples are disabled", () => {
    const slugs = visibleForms(false).map((f) => f.slug);
    expect(slugs).not.toContain("ping");
    expect(slugs).not.toContain("contact");
    expect(slugs).toContain("add-new-job-opportunity");
    expect(slugs).toContain("add-job-opportunity-info");
  });
});
