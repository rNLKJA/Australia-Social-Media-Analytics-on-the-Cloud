import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes cells with commas, quotes and newlines", () => {
    expect(
      toCsv(
        ["a", "b"],
        [
          { a: 'Brimbank, "C"', b: 1 },
          { a: null, b: "x\ny" },
        ],
      ),
    ).toBe('a,b\r\n"Brimbank, ""C""",1\r\n,"x\ny"\r\n');
  });
});
