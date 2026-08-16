/** Parse srcset the way HTML does: URLs stop at comma or whitespace. */
export function parseHtmlSrcset(srcset: string): Array<{ url: string; descriptors: string }> {
  const candidates: Array<{ url: string; descriptors: string }> = [];
  let remaining = srcset;

  while (remaining.length > 0) {
    remaining = remaining.replace(/^\s+/, "");
    if (remaining.length === 0) {
      break;
    }

    const urlMatch = remaining.match(/^[^,\s]+/);
    const url = urlMatch?.[0] ?? "";
    remaining = remaining.slice(url.length).replace(/^[^\S,]+/, "");

    const descriptorMatch = remaining.match(/^[^,]*/);
    const descriptors = (descriptorMatch?.[0] ?? "").trim();
    remaining = remaining.slice(descriptorMatch?.[0]?.length ?? 0).replace(/^,/, "");

    if (url.length > 0) {
      candidates.push({ url, descriptors });
    }
  }

  return candidates;
}
