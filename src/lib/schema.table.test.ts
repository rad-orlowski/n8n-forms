import { describe, it, expect } from "vitest";
import { defineForm } from "./schema";

describe("defineForm: format table", () => {
  it("accepts a response field with format:table + columns + expand", () => {
    const form = defineForm({
      slug: "data-table",
      title: "Data table",
      pages: [
        { method: "GET", fields: [{ type: "description", content: "Load" }] },
      ],
      response: {
        fields: [
          {
            key: "items",
            format: "table",
            columns: [
              {
                key: "name",
                label: "Name",
                sortable: true,
                kind: "text",
              },
              {
                key: "score",
                label: "Score",
                sortable: true,
                align: "right",
                kind: "customCell",
              },
              {
                key: "amount",
                label: "Amount",
                sortable: true,
                align: "right",
                kind: "customCell",
              },
            ],
            expand: [
              {
                key: "detail",
                label: "Detail",
                kind: "itemDetail",
              },
              { key: "messages", label: "Thread", kind: "thread" },
            ],
          },
        ],
      },
    });
    expect(form.response?.fields?.[0].format).toBe("table");
    expect(form.response?.fields?.[0].columns?.length).toBe(3);
  });

  it("accepts arbitrary renderer-name kinds on columns and expand", () => {
    // `kind` is a free-string renderer name resolved through the table registry,
    // not a fixed enum — any string is a valid (possibly unregistered) name.
    expect(() =>
      defineForm({
        slug: "kind-coverage",
        title: "Kind coverage",
        pages: [{ fields: [{ type: "description", content: "Load" }] }],
        response: {
          fields: [
            {
              key: "items",
              format: "table",
              columns: [{ key: "count", kind: "customCell" }],
              expand: [
                { key: "tagList", label: "Tags", kind: "tagPanel" },
                { key: "detail", label: "Detail", kind: "detailPanel" },
              ],
            },
          ],
        },
      }),
    ).not.toThrow();
  });

  it("accepts a generic filters config", () => {
    const form = defineForm({
      slug: "filtered",
      title: "Filtered",
      pages: [{ fields: [{ type: "description", content: "Load" }] }],
      response: {
        fields: [
          {
            key: "items",
            format: "table",
            columns: [{ key: "name", sortable: true }],
            filters: [{ key: "status", label: "Status" }],
          },
        ],
      },
    });
    expect(form.response?.fields?.[0].filters?.[0].key).toBe("status");
  });

  it("rejects a column without a key", () => {
    expect(() =>
      defineForm({
        slug: "x",
        title: "x",
        pages: [{ fields: [{ type: "text", name: "a" }] }],
        response: {
          fields: [
            {
              key: "items",
              format: "table",
              columns: [{ label: "no key" } as never],
            },
          ],
        },
      }),
    ).toThrow();
  });
});
