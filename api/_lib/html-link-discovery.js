import { parse } from "parse5";

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

/**
 * Extract document anchor hrefs with the HTML5 parsing algorithm.
 *
 * Script/style contents and inert template contents are deliberately excluded:
 * markup-looking text inside those contexts is not a live document link.
 */
export function extractHTMLLinks(html) {
  if (typeof html !== "string" || html.length === 0) return [];

  const document = parse(html, { scriptingEnabled: true });
  const links = [];
  const pending = [...(document.childNodes || [])].reverse();

  while (pending.length > 0) {
    const node = pending.pop();

    if (!node || node.nodeName === "script" || node.nodeName === "style" || node.nodeName === "template") {
      continue;
    }

    if (
      node.tagName === "a" &&
      node.namespaceURI === HTML_NAMESPACE
    ) {
      const href = node.attrs?.find((attribute) => attribute.name === "href")?.value?.trim();
      if (href) links.push(href);
    }

    const children = node.childNodes || [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      pending.push(children[index]);
    }
  }

  return links;
}
