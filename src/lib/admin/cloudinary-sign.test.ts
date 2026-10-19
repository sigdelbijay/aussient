import { it } from "node:test";
import assert from "node:assert/strict";
import { signParams } from "./cloudinary-sign";

it("signs upload params the way Cloudinary expects (example from their docs)", () => {
  const signature = signParams(
    {
      timestamp: 1315060510,
      public_id: "sample_image",
      eager: "w_400,h_300,c_pad|w_260,h_200,c_crop",
      api_key: "ignored", // never part of the signature
      file: "ignored",
    },
    "abcd",
  );
  assert.equal(signature, "bfd09f95f331f558cbd1320e67aa8d488770583e");
});
