import { describe, expect, it } from "vitest";
import { assetPathFromUrl, imageCopyTarget } from "./imageContextMenu";

describe("imageCopyTarget", () => {
	it("extracts the absolute file path behind a marky-asset URL", () => {
		expect(
			imageCopyTarget(
				`marky-asset://local/?path=${encodeURIComponent("/Users/me/notes/pic.png")}`,
			),
		).toEqual({ kind: "path", path: "/Users/me/notes/pic.png" });
	});

	it("copies the address of linked images", () => {
		expect(imageCopyTarget("https://example.com/cat.png?size=large")).toEqual({
			kind: "address",
			address: "https://example.com/cat.png?size=large",
		});
	});

	it("has no target for data URLs and unparseable sources", () => {
		expect(imageCopyTarget("data:image/png;base64,iVBORw0=")).toBeNull();
		expect(imageCopyTarget("")).toBeNull();
	});
});

describe("assetPathFromUrl", () => {
	it("prefers the path query parameter over the URL pathname", () => {
		expect(
			assetPathFromUrl(new URL("marky-asset://local/?path=%2Fws%2Fimg.png")),
		).toBe("/ws/img.png");
	});

	it("decodes an escaped pathname", () => {
		expect(
			assetPathFromUrl(new URL("marky-asset://local/%2Fws%2Fimg.png")),
		).toBe("/ws/img.png");
	});
});
