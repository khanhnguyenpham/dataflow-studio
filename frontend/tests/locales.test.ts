import { expect, test } from "vitest";
import en from "../src/locales/en.json";
import vi from "../src/locales/vi.json";
const keys = (x: Record<string, unknown>, prefix = ""): string[] =>
  Object.entries(x).flatMap(([k, v]) =>
    typeof v === "object" && v !== null
      ? keys(v as Record<string, unknown>, `${prefix}${k}.`)
      : [prefix + k],
  );
test("English and Vietnamese expose the same complete translation keys", () =>
  expect(keys(en).sort()).toEqual(keys(vi).sort()));
