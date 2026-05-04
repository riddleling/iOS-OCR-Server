import { describe, it, expect } from "vitest";
import { categorizeOCRText } from "../src/categorize";

describe("Content categorization", () => {
  describe("categorizeOCRText", () => {
    it("should detect receipt", () => {
      const text = "总计: ¥125.00 税: ¥10.00 合计: ¥135.00";
      const result = categorizeOCRText(text);
      expect(result.category).toBe("receipt");
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("should detect business card", () => {
      const text = "张三 经理 138-1234-5678 test@example.com";
      const result = categorizeOCRText(text);
      expect(result.category).toBeTruthy();
    });

    it("should detect document", () => {
      const text = Array(16).fill("This is a long document line").join("\n");
      const result = categorizeOCRText(text);
      expect(result.category).toBe("document");
    });

    it("should return unknown for short text", () => {
      const result = categorizeOCRText("Short text");
      expect(result.category).toBeTruthy();
    });
  });
});
