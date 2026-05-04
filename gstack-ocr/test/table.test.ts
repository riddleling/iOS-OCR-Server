import { describe, it, expect } from "vitest";
import { extractTable, tableToCSV, tableToJSON } from "../src/table";

describe("Table extraction", () => {
  describe("extractTable", () => {
    it("should extract tab-separated table", () => {
      const text = "Name\tAge\tCity\nJohn\t30\tNYC\nJane\t25\tLA";
      const result = extractTable(text);
      expect(result.rows.length).toBe(2);
      expect(result.headers).toEqual(["Name", "Age", "City"]);
      expect(result.rows[0].Name).toBe("John");
    });

    it("should extract pipe-separated table", () => {
      const text = "Name | Age | City\nJohn | 30 | NYC";
      const result = extractTable(text);
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].Name).toBe("John");
    });

    it("should return empty for invalid input", () => {
      const result = extractTable("No table here");
      expect(result.rows.length).toBe(0);
    });
  });

  describe("tableToCSV", () => {
    it("should convert to CSV format", () => {
      const rows = [{ Name: "John", Age: "30" }];
      const csv = tableToCSV(["Name", "Age"], rows);
      expect(csv).toContain("Name,Age");
      expect(csv).toContain("John,30");
      // Values with special chars should be quoted
      const csvWithComma = tableToCSV(["Name"], [{ Name: "Doe, John" }]);
      expect(csvWithComma).toContain('"Doe, John"');
    });
  });

  describe("tableToJSON", () => {
    it("should convert to JSON format", () => {
      const rows = [{ Name: "John", Age: "30" }];
      const json = tableToJSON(rows);
      expect(JSON.parse(json)).toEqual(rows);
    });
  });
});
