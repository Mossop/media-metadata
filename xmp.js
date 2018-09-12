const { DOMParser } = require("xmldom");
const UTF8 = require("utf-8");

const NS_XMP = "http://ns.adobe.com/xap/1.0/";
const NS_RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const NS_XMLNS = "http://www.w3.org/2000/xmlns/";

const RDF_DESCRIPTION = "Description";
const RDF_SEQ = "Seq";
const RDF_BAG = "Bag";
const RDF_ALT = "Alt";
const RDF_LI = "li";

const ELEMENT_NODE = 1;
const ATTRIBUTE_NODE = 2;

module.exports = {
  NS_XMP,
};

function* nodeChildren(element, type) {
  let node = element.firstChild;
  while (node) {
    if (node.nodeType == type) {
      yield node;
    }
    node = node.nextSibling;
  }
}

function* elementChildren(element) {
  yield* nodeChildren(element, ELEMENT_NODE);
}

function* attributeChildren(element) {
  yield* nodeChildren(element, ATTRIBUTE_NODE);
}

class XMPParser {
  constructor(data, metadata){
    this.data = data;
    this.metadata = metadata;
  }

  parseContainer(container, list) {
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
          list.push(child.textContent);
        } else {
          throw new Error("Complex list item found in RDF.");
        }
      } else {
        throw new Error(`Unexpected node in RDF container: ${child.localName}.`);
      }
    }
  }

  parseDescription(element, parent) {
    for (let attribute of attributeChildren(element)) {
      if (attribute.namespaceURI == NS_RDF || attribute.namespaceURI == NS_XMLNS) {
        continue;
      }

      parent[`${attribute.namespaceURI}${attribute.localName}`] = attribute.value;
    }

    for (let child of elementChildren(element)) {
      let property = `${child.namespaceURI}${child.localName}`;
      let children = Array.from(elementChildren(child));
      let next = children[0];
      if (children.length == 1 && next.namespaceURI == NS_RDF) {
        if (next.localName == RDF_DESCRIPTION) {
          parent[property] = {};
          this.parseDescription(next, parent[property]);
        } else if (next.localName == RDF_SEQ || next.localName == RDF_BAG || next.localName == RDF_ALT) {
          parent[property] = [];
          this.parseContainer(next, parent[property]);
        } else {
          throw new Error(`Unexpected RDF type in graph: ${next.localName}.`);
        }
      } else if (children.length == 0) {
        parent[property] = child.textContent;
      } else if (child.getAttributeNS(NS_RDF, "parseType") == "Resource") {
        parent[property] = {};
        this.parseDescription(child, parent[property]);
      } else {
        throw new Error("Unexpected children in RDF Description.");
      }
    }
  }

  parseRDF(element, parent) {
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

  parseElement(element) {
    if (element.namespaceURI == NS_RDF && element.localName == "RDF") {
      this.parseRDF(element, this.metadata);
    } else {
      for (let node of elementChildren(element)) {
        this.parseElement(node);
      }
    }
  }

  parse() {
    // The header is null terminated.
    let offset = NS_XMP.length + 1;
    let buffer = new Uint8Array(this.data.buffer, this.data.byteOffset + offset, this.data.byteLength - offset);

    let parser = new DOMParser();
    let document = parser.parseFromString(UTF8.getStringFromBytes(buffer));

    this.parseElement(document.documentElement);
  }
}

module.exports.parseXmpData = function parseXmpData(data, metadata) {
  metadata.xmp = {};
  let parser = new XMPParser(data, metadata.xmp);
  parser.parse();
};
