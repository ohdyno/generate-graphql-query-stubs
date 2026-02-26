const { describe, it, expect } = require("bun:test");
const {
  generate,
  generateString,
  generateInteger,
  generateNumber,
  generateArray,
  generateObject,
} = require("../src/json_schema_mock");

// ---------------------------------------------------------------------------
// generateString
// ---------------------------------------------------------------------------

describe("generateString", () => {
  it("returns a value from enum when provided", () => {
    const schema = { enum: ["fire", "water", "grass"] };
    for (let i = 0; i < 20; i++) {
      expect(schema.enum.includes(generateString(schema))).toBeTruthy();
    }
  });

  it("returns a fixed date string for format=date", () => {
    expect(generateString({ format: "date" })).toBe("2024-01-01");
  });

  it("returns a fixed datetime string for format=date-time", () => {
    expect(generateString({ format: "date-time" })).toBe("2024-01-01T00:00:00Z");
  });

  it("returns an email-shaped string for format=email", () => {
    expect(generateString({ format: "email" })).toMatch(/^[a-z]+@example\.com$/);
  });

  it("returns a URI-shaped string for format=uri", () => {
    expect(generateString({ format: "uri" })).toMatch(/^https:\/\/example\.com\//);
  });

  it("returns a slug-shaped string for plain schema", () => {
    expect(generateString({})).toMatch(/^[a-z]+-[a-z]+$/);
  });
});

// ---------------------------------------------------------------------------
// generateInteger
// ---------------------------------------------------------------------------

describe("generateInteger", () => {
  it("returns an integer", () => {
    const val = generateInteger({});
    expect(val).toBe(Math.floor(val));
  });

  it("respects minimum and maximum", () => {
    for (let i = 0; i < 50; i++) {
      const val = generateInteger({ minimum: 10, maximum: 20 });
      expect(val >= 10 && val <= 20).toBeTruthy();
    }
  });

  it("defaults to range [1, 255]", () => {
    for (let i = 0; i < 50; i++) {
      const val = generateInteger({});
      expect(val >= 1 && val <= 255).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// generateNumber
// ---------------------------------------------------------------------------

describe("generateNumber", () => {
  it("returns a finite number", () => {
    expect(isFinite(generateNumber({}))).toBeTruthy();
  });

  it("respects minimum and maximum", () => {
    for (let i = 0; i < 50; i++) {
      const val = generateNumber({ minimum: 5.0, maximum: 6.0 });
      expect(val >= 5.0 && val <= 6.0).toBeTruthy();
    }
  });

  it("defaults to range [0.1, 2.0]", () => {
    for (let i = 0; i < 50; i++) {
      const val = generateNumber({});
      expect(val >= 0.1 && val <= 2.0).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// generateArray
// ---------------------------------------------------------------------------

describe("generateArray", () => {
  it("returns an array", () => {
    expect(Array.isArray(generateArray({ items: { type: "string" } }))).toBeTruthy();
  });

  it("generates items matching the items schema", () => {
    const result = generateArray({ items: { type: "integer" }, minItems: 5, maxItems: 5 });
    expect(result.length).toBe(5);
    for (const val of result) {
      expect(typeof val).toBe("number");
      expect(val).toBe(Math.floor(val));
    }
  });

  it("respects minItems and maxItems", () => {
    for (let i = 0; i < 30; i++) {
      const result = generateArray({ items: { type: "string" }, minItems: 2, maxItems: 4 });
      expect(result.length >= 2 && result.length <= 4).toBeTruthy();
    }
  });

  it("defaults to between 1 and 3 items", () => {
    for (let i = 0; i < 30; i++) {
      const result = generateArray({ items: { type: "boolean" } });
      expect(result.length >= 1 && result.length <= 3).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// generateObject
// ---------------------------------------------------------------------------

describe("generateObject", () => {
  it("returns an object with all properties populated", () => {
    const schema = {
      properties: {
        name: { type: "string" },
        count: { type: "integer" },
        active: { type: "boolean" },
      },
    };
    const result = generateObject(schema);
    expect(typeof result.name).toBe("string");
    expect(typeof result.count).toBe("number");
    expect(typeof result.active).toBe("boolean");
  });

  it("returns an empty object when no properties defined", () => {
    expect(generateObject({})).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// generate — dispatch by type
// ---------------------------------------------------------------------------

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

  it("picks from enum directly when present at top level", () => {
    const schema = { enum: ["a", "b", "c"] };
    for (let i = 0; i < 20; i++) {
      expect(schema.enum.includes(generate(schema))).toBeTruthy();
    }
  });

  it("handles union types, ignoring null", () => {
    // ["string", "null"] should generate a string, not null
    for (let i = 0; i < 20; i++) {
      const val = generate({ type: ["string", "null"] });
      expect(typeof val).toBe("string");
    }
  });

  it("dispatches 'string' correctly", () => {
    expect(typeof generate({ type: "string" })).toBe("string");
  });

  it("dispatches 'integer' correctly", () => {
    const val = generate({ type: "integer" });
    expect(typeof val).toBe("number");
    expect(val).toBe(Math.floor(val));
  });

  it("dispatches 'number' correctly", () => {
    expect(typeof generate({ type: "number" })).toBe("number");
  });

  it("dispatches 'boolean' correctly", () => {
    expect(typeof generate({ type: "boolean" })).toBe("boolean");
  });

  it("dispatches 'array' correctly", () => {
    expect(Array.isArray(generate({ type: "array", items: { type: "string" } }))).toBeTruthy();
  });

  it("dispatches 'object' and recurses into properties", () => {
    const schema = {
      type: "object",
      properties: {
        id: { type: "integer" },
        label: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
    };
    const result = generate(schema);
    expect(typeof result.id).toBe("number");
    expect(typeof result.label).toBe("string");
    expect(Array.isArray(result.tags)).toBeTruthy();
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
