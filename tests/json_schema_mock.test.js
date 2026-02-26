const { describe, it, expect } = require("bun:test");
const { generate } = require("../src/json_schema_mock");

describe("generate", () => {
  it("returns null for null/undefined input", () => {
    expect(generate(null)).toBe(null);
    expect(generate(undefined)).toBe(null);
  });

  it("returns null for unknown type", () => {
    expect(generate({ type: "unknown" })).toBe(null);
  });

  it("returns null for type=null", () => {
    expect(generate({ type: "null" })).toBe(null);
  });

  it("picks from enum when present at top level", () => {
    const schema = { enum: ["a", "b", "c"] };
    for (let i = 0; i < 20; i++) {
      expect(schema.enum.includes(generate(schema))).toBeTruthy();
    }
  });

  it("handles union types, ignoring null", () => {
    for (let i = 0; i < 20; i++) {
      const val = generate({ type: ["string", "null"] });
      expect(typeof val).toBe("string");
    }
  });

  // -------------------------------------------------------------------------
  // String
  // -------------------------------------------------------------------------

  describe("string", () => {
    it("returns a fixed date string for format=date", () => {
      expect(generate({ type: "string", format: "date" })).toBe("2024-01-01");
    });

    it("returns a fixed datetime string for format=date-time", () => {
      expect(generate({ type: "string", format: "date-time" })).toBe("2024-01-01T00:00:00Z");
    });

    it("returns an email-shaped string for format=email", () => {
      expect(generate({ type: "string", format: "email" })).toMatch(/^[a-z]+@example\.com$/);
    });

    it("returns a URI-shaped string for format=uri", () => {
      expect(generate({ type: "string", format: "uri" })).toMatch(/^https:\/\/example\.com\//);
    });

    it("returns a slug-shaped string for plain schema", () => {
      expect(generate({ type: "string" })).toMatch(/^[a-z]+-[a-z]+$/);
    });
  });

  // -------------------------------------------------------------------------
  // Integer
  // -------------------------------------------------------------------------

  describe("integer", () => {
    it("returns an integer", () => {
      const val = generate({ type: "integer" });
      expect(val).toBe(Math.floor(val));
    });

    it("respects minimum and maximum", () => {
      for (let i = 0; i < 50; i++) {
        const val = generate({ type: "integer", minimum: 10, maximum: 20 });
        expect(val >= 10 && val <= 20).toBeTruthy();
      }
    });

    it("defaults to range [1, 255]", () => {
      for (let i = 0; i < 50; i++) {
        const val = generate({ type: "integer" });
        expect(val >= 1 && val <= 255).toBeTruthy();
      }
    });
  });

  // -------------------------------------------------------------------------
  // Number
  // -------------------------------------------------------------------------

  describe("number", () => {
    it("returns a finite number", () => {
      expect(isFinite(generate({ type: "number" }))).toBeTruthy();
    });

    it("respects minimum and maximum", () => {
      for (let i = 0; i < 50; i++) {
        const val = generate({ type: "number", minimum: 5.0, maximum: 6.0 });
        expect(val >= 5.0 && val <= 6.0).toBeTruthy();
      }
    });

    it("defaults to range [0.1, 2.0]", () => {
      for (let i = 0; i < 50; i++) {
        const val = generate({ type: "number" });
        expect(val >= 0.1 && val <= 2.0).toBeTruthy();
      }
    });
  });

  // -------------------------------------------------------------------------
  // Boolean
  // -------------------------------------------------------------------------

  describe("boolean", () => {
    it("returns a boolean", () => {
      expect(typeof generate({ type: "boolean" })).toBe("boolean");
    });
  });

  // -------------------------------------------------------------------------
  // Array
  // -------------------------------------------------------------------------

  describe("array", () => {
    it("returns an array", () => {
      expect(Array.isArray(generate({ type: "array", items: { type: "string" } }))).toBeTruthy();
    });

    it("generates items matching the items schema", () => {
      const result = generate({ type: "array", items: { type: "integer" }, minItems: 5, maxItems: 5 });
      expect(result.length).toBe(5);
      for (const val of result) {
        expect(typeof val).toBe("number");
        expect(val).toBe(Math.floor(val));
      }
    });

    it("respects minItems and maxItems", () => {
      for (let i = 0; i < 30; i++) {
        const result = generate({ type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 });
        expect(result.length >= 2 && result.length <= 4).toBeTruthy();
      }
    });

    it("defaults to between 1 and 3 items", () => {
      for (let i = 0; i < 30; i++) {
        const result = generate({ type: "array", items: { type: "boolean" } });
        expect(result.length >= 1 && result.length <= 3).toBeTruthy();
      }
    });
  });

  // -------------------------------------------------------------------------
  // Object
  // -------------------------------------------------------------------------

  describe("object", () => {
    it("returns an object with all properties populated", () => {
      const schema = {
        type: "object",
        properties: {
          name: { type: "string" },
          count: { type: "integer" },
          active: { type: "boolean" },
        },
      };
      const result = generate(schema);
      expect(typeof result.name).toBe("string");
      expect(typeof result.count).toBe("number");
      expect(typeof result.active).toBe("boolean");
    });

    it("returns an empty object when no properties defined", () => {
      expect(generate({ type: "object" })).toEqual({});
    });

    it("handles deeply nested schemas", () => {
      const schema = {
        type: "object",
        properties: {
          users: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                score: { type: "integer" },
              },
            },
          },
        },
      };
      const result = generate(schema);
      expect(Array.isArray(result.users)).toBeTruthy();
      for (const user of result.users) {
        expect(typeof user.name).toBe("string");
        expect(typeof user.score).toBe("number");
      }
    });
  });
});
