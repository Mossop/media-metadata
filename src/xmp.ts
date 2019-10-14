import { DOMParser } from "xmldom";

import { DataReader } from "./datareader";
import { Metadata, XmpData, XmpType } from "./metadata";

const NS_RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const NS_XMLNS = "http://www.w3.org/2000/xmlns/";

const RDF_DESCRIPTION = "Description";
const RDF_SEQ = "Seq";
const RDF_BAG = "Bag";
const RDF_ALT = "Alt";
const RDF_LI = "li";

const ELEMENT_NODE = 1;

function isElement(node: Node): node is HTMLElement {
  return node.nodeType === ELEMENT_NODE;
}

function* elementChildren(element: HTMLElement): Iterable<HTMLElement> {
  let node = element.firstChild;
  while (node) {
    if (isElement(node)) {
      yield node;
    }
    node = node.nextSibling;
  }
}

function* attributeChildren(element: HTMLElement): Iterable<Attr> {
  for (let i = 0; i < element.attributes.length; i++) {
    let attr = element.attributes.item(i);
    if (attr) {
      yield attr;
    }
  }
}

class XMPParser {
  private metadata: XmpData;

  public constructor(metadata: XmpData){
    this.metadata = metadata;
  }

  private parseContainer(container: HTMLElement, list: XmpType[]): void {
    for (let child of elementChildren(container)) {
      if (child.namespaceURI == NS_RDF && child.localName == RDF_LI) {
        let children = Array.from(elementChildren(child));
        let next = children[0];
        if (child.getAttributeNS(NS_RDF, "parseType") == "Resource") {
          let value = {};
          list.push(value);
          this.parseDescription(child, value);
        } else if (children.length == 1 && next.namespaceURI == NS_RDF && next.localName == RDF_DESCRIPTION) {
          let value = {};
          list.push(value);
          this.parseDescription(next, value);
        } else if (children.length == 0) {
          let content = child.textContent;
          if (content !== null) {
            list.push(content);
          }
        } else {
          throw new Error("Complex list item found in RDF.");
        }
      } else {
        throw new Error(`Unexpected node in RDF container: ${child.localName}.`);
      }
    }
  }

  private parseDescription(element: HTMLElement, parent: XmpData): void {
    for (let attribute of attributeChildren(element)) {
      if (attribute.namespaceURI == NS_RDF || attribute.namespaceURI == NS_XMLNS) {
        continue;
      }

      parent[`${attribute.namespaceURI}${attribute.localName}`] = attribute.value;
    }

    for (let child of elementChildren(element)) {
      let property = `${child.namespaceURI}${child.localName}`;
      let children = Array.from(elementChildren(child));

      if (children.length == 1 && children[0].namespaceURI == NS_RDF) {
        let next = children[0];
        if (next.localName == RDF_DESCRIPTION) {
          let description: XmpData = {};
          this.parseDescription(next, description);
          parent[property] = description;
        } else if (next.localName == RDF_SEQ || next.localName == RDF_BAG || next.localName == RDF_ALT) {
          let container: XmpData[] = [];
          this.parseContainer(next, container);
          parent[property] = container;
        } else {
          throw new Error(`Unexpected RDF type in graph: ${next.localName}.`);
        }
      } else if (children.length == 0) {
        let content = child.textContent;
        if (content !== null) {
          parent[property] = content;
        }
      } else if (child.getAttributeNS(NS_RDF, "parseType") == "Resource") {
        let description: XmpData = {};
        this.parseDescription(child, description);
        parent[property] = description;
      } else {
        throw new Error("Unexpected children in RDF Description.");
      }
    }
  }

  private parseRDF(element: HTMLElement, parent: XmpData): void {
    for (let child of elementChildren(element)) {
      if (child.namespaceURI == NS_RDF && child.localName == RDF_DESCRIPTION) {
        let about = child.getAttributeNS(NS_RDF, "about");
        if (about) {
          throw new Error("Unexpected RDF Description node in document.");
        }

        this.parseDescription(child, parent);
      }
    }
  }

  public parseElement(element: HTMLElement): void {
    if (element.namespaceURI == NS_RDF && element.localName == "RDF") {
      this.parseRDF(element, this.metadata);
    } else {
      for (let node of elementChildren(element)) {
        this.parseElement(node);
      }
    }
  }
}

export async function parseXmpData(reader: DataReader, metadata: Metadata, length: number): Promise<void> {
  let buffer = Buffer.from(await reader.readData(length));
  let xml = buffer.toString("utf8");

  let parser = new DOMParser();
  let document = parser.parseFromString(xml);

  let xmp = new XMPParser(metadata.xmp);
  xmp.parseElement(document.documentElement);
}
