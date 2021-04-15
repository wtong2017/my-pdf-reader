/**
 * @implements {IPDFLinkService}
 */
class MyLinkService {
  constructor() {
    this.externalLinkTarget = null;
    this.externalLinkRel = null;
    this.externalLinkEnabled = true;
    this._ignoreDestinationZoom = false;

    this.baseUrl = null;
    this.pdfDocument = null;

    this._pagesRefCache = null;
  }

  setDocument(pdfDocument, baseUrl = null) {
    this.baseUrl = baseUrl;
    this.pdfDocument = pdfDocument;
    this._pagesRefCache = Object.create(null);
  }

  setViewer(pdfViewer) {
    this.pdfViewer = pdfViewer;
  }

  /**
   * @type {number}
   */
  get pagesCount() {
    return 0;
  }

  /**
   * @type {number}
   */
  get page() {
    return 0;
  }

  /**
   * @param {number} value
   */
  set page(value) {}

  /**
   * @type {number}
   */
  get rotation() {
    return 0;
  }

  /**
   * @param {number} value
   */
  set rotation(value) {}

  /**
   * @param {string|Array} dest - The named, or explicit, PDF destination.
   */
  async goToDestination(dest) {
    const sidebar = this.pdfViewer.container.querySelector("#sidebar");
    sidebar.style.width = "250px";
  }

  /**
   * @param {number|string} val - The page number, or page label.
   */
  goToPage(val) {}

  /**
   * @param dest - The PDF destination object.
   * @returns {string} The hyperlink to the PDF object.
   */
  getDestinationHash(dest) {
    return "#";
  }

  /**
   * @param hash - The PDF parameters/hash.
   * @returns {string} The hyperlink to the PDF object.
   */
  getAnchorUrl(hash) {
    return "#";
  }

  /**
   * @param {string} hash
   */
  setHash(hash) {}

  /**
   * @param {string} action
   */
  executeNamedAction(action) {}

  /**
   * @param {number} pageNum - page number.
   * @param {Object} pageRef - reference to the page.
   */
  cachePageRef(pageNum, pageRef) {}

  /**
   * @param {number} pageNumber
   */
  isPageVisible(pageNumber) {
    return true;
  }

  /**
   * @param {number} pageNumber
   */
  isPageCached(pageNumber) {
    return true;
  }

  /**
   * @deprecated
   */
  navigateTo(dest) {
    console.error(
      "Deprecated method: `navigateTo`, use `goToDestination` instead."
    );
    this.goToDestination(dest);
  }
}

export { MyLinkService };
