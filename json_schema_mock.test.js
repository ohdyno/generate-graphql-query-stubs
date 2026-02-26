const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  generate,
  generateString,
  generateInteger,
  generateNumber,
  generateArray,
  generateObject,
} = require("./json_schema_mock");

// ---------------------------------------------------------------------------
// generateString
// ---------------------------------------------------------------------------

describe("generateString", () => {
  it("returns a value from enum when provided", () => {
    const schema = { enum: ["fire", "water", "grass"] };
    for (let i = 0; i < 20; i++) {
      assert.ok(schema.enum.includes(generateString(schema)));
    }
  });

  it("returns a fixed date string for format=date", () => {
    assert.equal(generateString({ format: "date" }), "2024-01-01");
  });

  it("returns a fixed datetime string for format=date-time", () => {
    assert.equal(generateString({ format: "date-time" }), "2024-01-01T00:00:00Z");
  });

  it("returns an email-shaped string for format=email", () => {
    assert.match(generateString({ format: "email" }), /^[a-z]+@example\.com$/);
  });

  it("returns a URI-shaped string for format=uri", () => {
    assert.match(generateString({ format: "uri" }), /^https:\/\/example\.com\//);
  });

  it("returns a slug-shaped string for plain schema", () => {
    assert.match(generateString({}), /^[a-z]+-[a-z]+$/);
  });
});

// ---------------------------------------------------------------------------
// generateInteger
// ---------------------------------------------------------------------------

describe("generateInteger", () => {
  it("returns an integer", () => {
    const val = generateInteger({});
    assert.equal(val, Math.floor(val));
  });

  it("respects minimum and maximum", () => {
    for (let i = 0; i < 50; i++) {
      const val = generateInteger({ minimum: 10, maximum: 20 });
      assert.ok(val >= 10 && val <= 20, `${val} out of range [10, 20]`);
    }
  });

  it("defaults to range [1, 255]", () => {
    for (let i = 0; i < 50; i++) {
      const val = generateInteger({});
      assert.ok(val >= 1 && val <= 255, `${val} out of default range`);
    }
  });
});

// ---------------------------------------------------------------------------
// generateNumber
// ---------------------------------------------------------------------------

describe("generateNumber", () => {
  it("returns a finite number", () => {
    assert.ok(isFinite(generateNumber({})));
  });

  it("respects minimum and maximum", () => {
    for (let i = 0; i < 50; i++) {
      const val = generateNumber({ minimum: 5.0, maximum: 6.0 });
      assert.ok(val >= 5.0 && val <= 6.0, `${val} out of range [5, 6]`);
    }
  });

  it("defaults to range [0.1, 2.0]", () => {
    for (let i = 0; i < 50; i++) {
      const val = generateNumber({});
      assert.ok(val >= 0.1 && val <= 2.0, `${val} out of default range`);
    }
  });
});

// ---------------------------------------------------------------------------
// generateArray
// ---------------------------------------------------------------------------

describe("generateArray", () => {
  it("returns an array", () => {
    assert.ok(Array.isArray(generateArray({ items: { type: "string" } })));
  });

  it("generates items matching the items schema", () => {
    const result = generateArray({ items: { type: "integer" }, minItems: 5, maxItems: 5 });
    assert.equal(result.length, 5);
    for (const val of result) {
      assert.equal(typeof val, "number");
      assert.equal(val, Math.floor(val));
    }
  });

  it("respects minItems and maxItems", () => {
    for (let i = 0; i < 30; i++) {
      const result = generateArray({ items: { type: "string" }, minItems: 2, maxItems: 4 });
      assert.ok(result.length >= 2 && result.length <= 4);
    }
  });

  it("defaults to between 1 and 3 items", () => {
    for (let i = 0; i < 30; i++) {
      const result = generateArray({ items: { type: "boolean" } });
      assert.ok(result.length >= 1 && result.length <= 3);
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
    assert.equal(typeof result.name, "string");
    assert.equal(typeof result.count, "number");
    assert.equal(typeof result.active, "boolean");
  });

  it("returns an empty object when no properties defined", () => {
    assert.deepEqual(generateObject({}), {});
  });
});

// ---------------------------------------------------------------------------
// generate — dispatch by type
// ---------------------------------------------------------------------------

describe("generate", () => {
  it("returns null for null/undefined input", () => {
    assert.equal(generate(null), null);
    assert.equal(generate(undefined), null);
  });

  it("returns null for unknown type", () => {
    assert.equal(generate({ type: "unknown" }), null);
  });

  it("returns null for type=null", () => {
    assert.equal(generate({ type: "null" }), null);
  });

  it("picks from enum directly when present at top level", () => {
    const schema = { enum: ["a", "b", "c"] };
    for (let i = 0; i < 20; i++) {
      assert.ok(schema.enum.includes(generate(schema)));
    }
  });

  it("handles union types, ignoring null", () => {
    // ["string", "null"] should generate a string, not null
    for (let i = 0; i < 20; i++) {
      const val = generate({ type: ["string", "null"] });
      assert.equal(typeof val, "string");
    }
  });

  it("dispatches 'string' correctly", () => {
    assert.equal(typeof generate({ type: "string" }), "string");
  });

  it("dispatches 'integer' correctly", () => {
    const val = generate({ type: "integer" });
    assert.equal(typeof val, "number");
    assert.equal(val, Math.floor(val));
  });

  it("dispatches 'number' correctly", () => {
    assert.equal(typeof generate({ type: "number" }), "number");
  });

  it("dispatches 'boolean' correctly", () => {
    assert.equal(typeof generate({ type: "boolean" }), "boolean");
  });

  it("dispatches 'array' correctly", () => {
    assert.ok(Array.isArray(generate({ type: "array", items: { type: "string" } })));
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
    assert.equal(typeof result.id, "number");
    assert.equal(typeof result.label, "string");
    assert.ok(Array.isArray(result.tags));
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
    assert.ok(Array.isArray(result.users));
    for (const user of result.users) {
      assert.equal(typeof user.name, "string");
      assert.equal(typeof user.score, "number");
    }
  });
});
