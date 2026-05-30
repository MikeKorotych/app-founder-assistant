import { extractJsonObject, parseSearchIntent } from "./parse";

describe("extractJsonObject", () => {
  it("returns the object from a plain JSON string", () => {
    expect(extractJsonObject('{"keywords":[],"categories":[]}')).toBe(
      '{"keywords":[],"categories":[]}',
    );
  });

  it("unwraps a ```json fenced block", () => {
    const text = 'here:\n```json\n{"keywords":["a"],"categories":[]}\n```\n';
    expect(extractJsonObject(text)).toBe('{"keywords":["a"],"categories":[]}');
  });

  it("recovers the object from surrounding prose", () => {
    expect(extractJsonObject('sure! {"keywords":["x"]} done')).toBe('{"keywords":["x"]}');
  });

  it("returns null when there is no object", () => {
    expect(extractJsonObject("no json here")).toBeNull();
  });
});

describe("parseSearchIntent", () => {
  it("parses keywords + categories", () => {
    const result = parseSearchIntent('{"keywords":["crm","sales"],"categories":["software"]}');
    expect(result).toEqual({ keywords: ["crm", "sales"], categories: ["software"] });
  });

  it("trims, drops blanks/non-strings, and dedupes case-insensitively", () => {
    const result = parseSearchIntent(
      '{"keywords":[" CRM ","crm","",42,"Sales","sales"],"categories":["Software","software"]}',
    );
    expect(result.keywords).toEqual(["CRM", "Sales"]);
    expect(result.categories).toEqual(["Software"]);
  });

  it("defaults missing fields to empty arrays", () => {
    expect(parseSearchIntent('{"keywords":["a"]}')).toEqual({
      keywords: ["a"],
      categories: [],
    });
    expect(parseSearchIntent("{}")).toEqual({ keywords: [], categories: [] });
  });

  it("survives fenced output", () => {
    const result = parseSearchIntent('```json\n{"keywords":["k"],"categories":["c"]}\n```');
    expect(result).toEqual({ keywords: ["k"], categories: ["c"] });
  });

  it("throws when no JSON object is present", () => {
    expect(() => parseSearchIntent("totally not json")).toThrow(/no JSON object/);
  });

  it("throws on a malformed JSON object", () => {
    expect(() => parseSearchIntent('{"keywords": [,,]}')).toThrow(/not valid JSON/);
  });
});
