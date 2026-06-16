import { describe, expect, it } from "vitest";
import { forms, getForm, isExampleForm, visibleForms } from "@/forms/index";
import { FormSchema } from "@/lib/schema";
import { resolveIcon } from "@/lib/icons";

// NOTE: personal (gitignored) forms under forms/*.form.ts are not present in
// every checkout, so these assertions cover only the committed example forms.

describe("form discovery", () => {
  it("discovers the committed example forms", () => {
    const slugs = forms.map((f) => f.slug);
    expect(slugs).toContain("ping");
    expect(slugs).toContain("contact");
    expect(slugs).toContain("wizard-demo");
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
    expect(slugs).not.toContain("wizard-demo");
  });
});

describe("form definitions", () => {
  it("has at least one form", () => {
    expect(forms.length).toBeGreaterThan(0);
  });

  for (const form of forms) {
    it(`form "${form.slug}" validates against FormSchema`, () => {
      expect(FormSchema.safeParse(form).success).toBe(true);
    });

    it(`form "${form.slug}" has a resolvable icon (if declared)`, () => {
      if (form.icon != null) expect(resolveIcon(form.icon)).toBeTruthy();
    });
  }
});
