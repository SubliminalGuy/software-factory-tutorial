export type ImageCopyTarget =
	| { kind: "path"; path: string }
	| { kind: "address"; address: string };

/** Extracts the file path a marky-asset URL was built from. */
export function assetPathFromUrl(url: URL): string {
	const queryPath = url.searchParams.get("path");
	if (queryPath) return queryPath;
	const encodedPath = url.pathname.startsWith("/")
		? url.pathname.slice(1)
		: url.pathname;
	return decodeURIComponent(encodedPath);
}

/**
 * What a context menu should offer as the "image path" for an image source:
 * workspace images load through the marky-asset protocol whose URL carries the
 * absolute file path, linked images have an address instead, and data URLs
 * have neither.
 */
export function imageCopyTarget(srcUrl: string): ImageCopyTarget | null {
	let url: URL;
	try {
		url = new URL(srcUrl);
	} catch {
		return null;
	}
	switch (url.protocol) {
		case "marky-asset:": {
			const assetPath = assetPathFromUrl(url);
			return assetPath ? { kind: "path", path: assetPath } : null;
		}
		case "data:":
			return null;
		default:
			return { kind: "address", address: url.href };
	}
}
