import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIMEOUT_MS,
  buildZodSchema,
  defaultValues,
  defineForm,
  isStaticField,
  resolveTimeoutMs,
  type FieldDef,
  type FormSchema,
  type PageDef,
} from "./schema";

const page = (fields: FieldDef[]): PageDef => ({ fields });
const form = (overrides: Partial<FormSchema> = {}): FormSchema => ({
  slug: "demo",
  title: "Demo",
  pages: [page([{ type: "text", name: "q" }])],
  ...overrides,
});

describe("defineForm", () => {
  it("returns the schema unchanged for a valid form", () => {
    const schema = form();
    expect(defineForm(schema)).toBe(schema);
  });

  it("tolerates a form with no pages", () => {
    const schema = { slug: "empty", title: "Empty", pages: [] };
    expect(defineForm(schema)).toBe(schema);
  });

  it("throws when page 0 uses optionsFrom", () => {
    expect(() =>
      defineForm(
        form({ pages: [page([{ type: "select", name: "s", optionsFrom: "x" }])] }),
      ),
    ).toThrow(/optionsFrom on page 0/);
  });

  it("throws when page 0 uses valueFrom", () => {
    expect(() =>
      defineForm(
        form({ pages: [page([{ type: "text", name: "t", valueFrom: "x" }])] }),
      ),
    ).toThrow(/valueFrom on page 0/);
  });

  it("names the field by type when name is absent in the diagnostic", () => {
    expect(() =>
      defineForm(form({ pages: [page([{ type: "select", optionsFrom: "x" }])] })),
    ).toThrow(/"select"/);
  });

  it("allows dynamic fields on pages at index >= 1", () => {
    const schema = form({
      pages: [
        page([{ type: "text", name: "a" }]),
        page([{ type: "select", name: "b", optionsFrom: "opts" }]),
      ],
    });
    expect(defineForm(schema)).toBe(schema);
  });
});

describe("resolveTimeoutMs", () => {
  it("prefers the page override", () => {
    expect(resolveTimeoutMs(form({ timeoutMs: 5000 }), { fields: [], timeoutMs: 1000 })).toBe(1000);
  });

  it("falls back to the form default", () => {
    expect(resolveTimeoutMs(form({ timeoutMs: 5000 }), { fields: [] })).toBe(5000);
  });

  it("falls back to DEFAULT_TIMEOUT_MS when neither is set", () => {
    expect(resolveTimeoutMs(form(), { fields: [] })).toBe(DEFAULT_TIMEOUT_MS);
  });

  it("passes through the indefinite sentinel", () => {
    expect(resolveTimeoutMs(form(), { fields: [], timeoutMs: "indefinite" })).toBe("indefinite");
  });
});

describe("isStaticField", () => {
  it.each(["heading", "description", "image", "alert"])("is true for %s", (type) => {
    expect(isStaticField({ type })).toBe(true);
  });

  it.each(["text", "email", "select", "number", "checkbox"])("is false for %s", (type) => {
    expect(isStaticField({ type })).toBe(false);
  });
});

describe("buildZodSchema", () => {
  it("skips static and nameless fields", () => {
    const schema = buildZodSchema([
      { type: "heading", content: "Hi" },
      { type: "text" }, // no name
      { type: "text", name: "ok" },
    ]);
    expect(Object.keys(schema.shape)).toEqual(["ok"]);
  });

  describe("email", () => {
    it("required rejects empty and invalid, accepts valid", () => {
      const s = buildZodSchema([{ type: "email", name: "e", required: true }]);
      expect(s.safeParse({ e: "" }).success).toBe(false);
      expect(s.safeParse({ e: "nope" }).success).toBe(false);
      expect(s.safeParse({ e: "a@b.com" }).success).toBe(true);
    });

    it("optional accepts empty string or a valid address", () => {
      const s = buildZodSchema([{ type: "email", name: "e" }]);
      expect(s.safeParse({ e: "" }).success).toBe(true);
      expect(s.safeParse({ e: "a@b.com" }).success).toBe(true);
      expect(s.safeParse({ e: "nope" }).success).toBe(false);
    });
  });

  describe("url", () => {
    it("required rejects empty and invalid", () => {
      const s = buildZodSchema([{ type: "url", name: "u", required: true }]);
      expect(s.safeParse({ u: "" }).success).toBe(false);
      expect(s.safeParse({ u: "noturl" }).success).toBe(false);
      expect(s.safeParse({ u: "https://x.com" }).success).toBe(true);
    });

    it("optional accepts empty string", () => {
      const s = buildZodSchema([{ type: "url", name: "u" }]);
      expect(s.safeParse({ u: "" }).success).toBe(true);
      expect(s.safeParse({ u: "https://x.com" }).success).toBe(true);
    });
  });

  describe("number / rating", () => {
    it("coerces strings and enforces min/max", () => {
      const s = buildZodSchema([{ type: "number", name: "n", required: true, min: 1, max: 10 }]);
      expect(s.safeParse({ n: "5" }).success).toBe(true);
      expect(s.safeParse({ n: "0" }).success).toBe(false);
      expect(s.safeParse({ n: "11" }).success).toBe(false);
    });

    it("optional number can be omitted", () => {
      const s = buildZodSchema([{ type: "number", name: "n" }]);
      expect(s.safeParse({}).success).toBe(true);
    });

    it("rating shares the numeric branch", () => {
      const s = buildZodSchema([{ type: "rating", name: "r", required: true, max: 5 }]);
      expect(s.safeParse({ r: 3 }).success).toBe(true);
      expect(s.safeParse({ r: 6 }).success).toBe(false);
    });
  });

  describe("checkbox", () => {
    it("required must be checked", () => {
      const s = buildZodSchema([{ type: "checkbox", name: "c", required: true }]);
      expect(s.safeParse({ c: true }).success).toBe(true);
      expect(s.safeParse({ c: false }).success).toBe(false);
    });

    it("optional accepts either boolean or omission", () => {
      const s = buildZodSchema([{ type: "checkbox", name: "c" }]);
      expect(s.safeParse({ c: false }).success).toBe(true);
      expect(s.safeParse({}).success).toBe(true);
    });
  });

  describe("richtext", () => {
    it("required rejects empty markup but accepts real text", () => {
      const s = buildZodSchema([{ type: "richtext", name: "rt", required: true }]);
      expect(s.safeParse({ rt: "<p></p>" }).success).toBe(false);
      expect(s.safeParse({ rt: "<p>&nbsp;</p>" }).success).toBe(false);
      expect(s.safeParse({ rt: "<p>hello</p>" }).success).toBe(true);
    });

    it("required accepts embedded media even without text", () => {
      const s = buildZodSchema([{ type: "richtext", name: "rt", required: true }]);
      expect(s.safeParse({ rt: '<img src="x.png">' }).success).toBe(true);
    });

    it("optional accepts empty content", () => {
      const s = buildZodSchema([{ type: "richtext", name: "rt" }]);
      expect(s.safeParse({ rt: "<p></p>" }).success).toBe(true);
    });
  });

  describe("default (text/textarea/select/date/custom)", () => {
    it("required rejects empty string", () => {
      const s = buildZodSchema([{ type: "text", name: "t", required: true }]);
      expect(s.safeParse({ t: "" }).success).toBe(false);
      expect(s.safeParse({ t: "x" }).success).toBe(true);
    });

    it("optional can be omitted", () => {
      const s = buildZodSchema([{ type: "select", name: "sel" }]);
      expect(s.safeParse({}).success).toBe(true);
    });
  });
});

describe("defaultValues", () => {
  it("uses type-appropriate empty values and skips static/nameless fields", () => {
    expect(
      defaultValues([
        { type: "text", name: "t" },
        { type: "checkbox", name: "c" },
        { type: "rating", name: "r" },
        { type: "heading", content: "x" },
        { type: "number" }, // no name
      ]),
    ).toEqual({ t: "", c: false, r: 0 });
  });
});
