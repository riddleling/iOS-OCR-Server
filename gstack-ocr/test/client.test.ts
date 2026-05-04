import { describe, it, expect } from "vitest";
import { IOSClient } from "../src/client";

describe("IOSClient", () => {
  describe("ocrImage", () => {
    it("should return error for non-existent file", async () => {
      const client = new IOSClient("192.168.50.225", 8150);
      const result = await client.ocrImage("/non/existent/file.png");
      expect(result.success).toBe(false);
      expect(result.error).toContain("不存在");
    });
  });

  describe("isAvailable", () => {
    it("should return boolean", async () => {
      const client = new IOSClient("192.168.50.225", 8150);
      const result = await client.isAvailable();
      expect(typeof result).toBe("boolean");
    });
  });
});
