import { describe, expect, it } from "vitest";
import { getByPath, setByPath } from "./json-path.js";

describe("getByPath / setByPath", () => {
  it("reads and writes a nested scalar", () => {
    const obj = { contact: { email: "old@example.com" } };
    expect(getByPath(obj, "contact.email")).toBe("old@example.com");
    setByPath(obj, "contact.email", "new@example.com");
    expect(obj.contact.email).toBe("new@example.com");
  });

  it("reads and writes an array index", () => {
    const obj = { experience: [{ bullets: ["a", "b"] }] };
    expect(getByPath(obj, "experience[0].bullets[1]")).toBe("b");
    setByPath(obj, "experience[0].bullets[1]", "updated");
    expect(obj.experience[0]?.bullets[1]).toBe("updated");
  });

  it("clamps an out-of-range array index to an append", () => {
    const obj = { skills: ["a", "b"] };
    setByPath(obj, "skills[5]", "c");
    expect(obj.skills).toEqual(["a", "b", "c"]);
  });

  it("creates missing intermediate structures", () => {
    const obj: Record<string, unknown> = {};
    setByPath(obj, "contact.email", "a@example.com");
    expect(obj).toEqual({ contact: { email: "a@example.com" } });
  });

  it("returns undefined for a path that doesn't exist", () => {
    expect(getByPath({ a: 1 }, "b.c")).toBeUndefined();
  });

  it("replaces a whole top-level field", () => {
    const obj = { skills: ["a"] };
    setByPath(obj, "skills", ["x", "y"]);
    expect(obj.skills).toEqual(["x", "y"]);
  });
});
