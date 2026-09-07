import { describe, expect, it } from "vitest";
import {
  buildOpenRoofPermitsQuery,
  buildPermitsForParcelQuery,
  buildPermitsForParcelsQuery,
} from "@/lib/queries/permits";

describe("buildOpenRoofPermitsQuery", () => {
  it("encodes 'older than five years within five miles of Kissimmee'", () => {
    const { sql, params } = buildOpenRoofPermitsQuery({
      lat: 28.2919,
      lng: -81.4076,
      radiusMiles: 5,
      minYearsOpen: 5,
    });
    expect(params.minYearsOpen).toBe(5);
    expect(sql).toContain("is_roofing");
    expect(sql).toContain("is_open");
    expect(sql).toContain("days_open >= 1825");
    expect(sql).toContain("<= 5");
    expect(sql).toContain("bbb_rating");
    expect(sql).toContain("source_url");
    expect(sql).toMatch(/ORDER BY days_open DESC\nLIMIT 100$/);
  });
  it("escapes contractor terms for ILIKE", () => {
    const { sql } = buildOpenRoofPermitsQuery({
      lat: 28.29,
      lng: -81.4,
      contractor: "ABC' OR 1=1 --%",
    });
    expect(sql).toContain("contractor_name ILIKE '%ABC'' OR 1=1 --\\%%' ESCAPE '\\'");
  });
});

describe("parcel permit queries", () => {
  it("orders roofing/open first and validates ids", () => {
    const sql = buildPermitsForParcelQuery("212529200000010390");
    expect(sql).toContain("parcel_identifier = '212529200000010390'");
    expect(sql).toContain("ORDER BY is_roofing DESC, is_open DESC");
    expect(() => buildPermitsForParcelQuery("1;2")).toThrow(RangeError);
    expect(buildPermitsForParcelsQuery(["1", "2"], true)).toContain("AND is_roofing");
  });
});
