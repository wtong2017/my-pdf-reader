import { PDFViewer } from "pdfjs-dist/web/pdf_viewer";

/* eslint-disable no-case-declarations */
const CSS_UNITS = 96.0 / 72.0;
const DEFAULT_SCALE_VALUE = "auto";
const UNKNOWN_SCALE = 0;
const SCROLLBAR_PADDING = 40;
const VERTICAL_PADDING = 5;

function parseQueryString(query) {
  const parts = query.split("&");
  const params = Object.create(null);
  for (let i = 0, ii = parts.length; i < ii; ++i) {
    const param = parts[i].split("=");
    const key = param[0].toLowerCase();
    const value = param.length > 1 ? param[1] : null;
    params[decodeURIComponent(key)] = decodeURIComponent(value);
  }
  return params;
}

/**
 * Performs navigation functions inside PDF, such as opening specified page,
 * or destination.
 * @implements {IPDFLinkService}
 */
class MyLinkService {
  /**
   * @param {PDFLinkServiceOptions} options
   */
  constructor({
    eventBus,
    externalLinkTarget = null,
    externalLinkRel = null,
    externalLinkEnabled = true,
    ignoreDestinationZoom = false,
  } = {}) {
    this.eventBus = eventBus;
    this.externalLinkTarget = externalLinkTarget;
    this.externalLinkRel = externalLinkRel;
    this.externalLinkEnabled = externalLinkEnabled;
    this._ignoreDestinationZoom = ignoreDestinationZoom;

    this.baseUrl = null;
    this.pdfDocument = null;
    this.pdfViewer = null;
    this.pdfHistory = null;

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

  setHistory(pdfHistory) {
    this.pdfHistory = pdfHistory;
  }

  /**
   * @type {number}
   */
  get pagesCount() {
    return this.pdfDocument ? this.pdfDocument.numPages : 0;
  }

  /**
   * @type {number}
   */
  get page() {
    return this.pdfViewer.currentPageNumber;
  }

  /**
   * @param {number} value
   */
  set page(value) {
    this.pdfViewer.currentPageNumber = value;
  }

  /**
   * @type {number}
   */
  get rotation() {
    return this.pdfViewer.pagesRotation;
  }

  /**
   * @param {number} value
   */
  set rotation(value) {
    this.pdfViewer.pagesRotation = value;
  }

  /**
   * @private
   */
  _goToDestinationHelper(rawDest, namedDest = null, explicitDest) {
    // Dest array looks like that: <page-ref> </XYZ|/FitXXX> <args..>
    const destRef = explicitDest[0];
    let pageNumber;

    if (destRef instanceof Object) {
      pageNumber = this._cachedPageNumber(destRef);

      if (pageNumber === null) {
        // Fetch the page reference if it's not yet available. This could
        // only occur during loading, before all pages have been resolved.
        this.pdfDocument
          .getPageIndex(destRef)
          .then((pageIndex) => {
            this.cachePageRef(pageIndex + 1, destRef);
            this._goToDestinationHelper(rawDest, namedDest, explicitDest);
          })
          .catch(() => {
            console.error(
              `PDFLinkService._goToDestinationHelper: "${destRef}" is not ` +
                `a valid page reference, for dest="${rawDest}".`
            );
          });
        return;
      }
    } else if (Number.isInteger(destRef)) {
      pageNumber = destRef + 1;
    } else {
      console.error(
        `PDFLinkService._goToDestinationHelper: "${destRef}" is not ` +
          `a valid destination reference, for dest="${rawDest}".`
      );
      return;
    }
    if (!pageNumber || pageNumber < 1 || pageNumber > this.pagesCount) {
      console.error(
        `PDFLinkService._goToDestinationHelper: "${pageNumber}" is not ` +
          `a valid page number, for dest="${rawDest}".`
      );
      return;
    }

    if (this.pdfHistory) {
      // Update the browser history before scrolling the new destination into
      // view, to be able to accurately capture the current document position.
      this.pdfHistory.pushCurrentPosition();
      this.pdfHistory.push({ namedDest, explicitDest, pageNumber });
    }

    // this.pdfViewer.scrollPageIntoView({
    //   pageNumber,
    //   destArray: explicitDest,
    //   ignoreDestinationZoom: this._ignoreDestinationZoom,
    // });
    return this.getScrollPos(this.pdfViewer, {
      pageNumber,
      destArray: explicitDest,
      ignoreDestinationZoom: this._ignoreDestinationZoom,
      isCitation:
        typeof namedDest === "string" && namedDest.split(".")[0] === "cite",
    }).then((ret) => {
      const { scrollLeft, scrollTop, msg } = ret;

      const parent = this.pdfViewer._pages[pageNumber - 1].div.offsetParent;
      console.log(scrollLeft, scrollTop);
      if (typeof namedDest === "string" && namedDest.split(".")[0] === "cite") {
        // if it is a citation
        console.log("citation on clicked");
      } else {
        parent.scrollLeft = scrollLeft;
        parent.scrollTop = scrollTop;
      }
      const node = document.createElement("div");
      node.style.position = "absolute";
      node.style.top = scrollTop + "px";
      node.style.left = scrollLeft + "px";
      node.style.height = "10px";
      node.style.width = "10px";
      node.style.background = "red";
      this.pdfViewer.container.appendChild(node);
      // console.log(document.elementFromPoint(left, top));
      console.log(explicitDest, pageNumber);
      return msg;
    });
  }

  // override the scrollPageIntoView function in pdfjs
  getScrollPos(
    viewer,
    {
      pageNumber,
      destArray = null,
      allowNegativeOffset = false,
      ignoreDestinationZoom = false,
      isCitation = false,
    }
  ) {
    if (!viewer.pdfDocument) {
      return;
    }
    const pageView =
      Number.isInteger(pageNumber) && viewer._pages[pageNumber - 1];
    if (!pageView) {
      console.error(
        `${viewer._name}.scrollPageIntoView: ` +
          `"${pageNumber}" is not a valid pageNumber parameter.`
      );
      return;
    }

    if (viewer.isInPresentationMode || !destArray) {
      viewer._setCurrentPageNumber(
        pageNumber,
        /* resetCurrentPageView = */ true
      );
      return;
    }
    let x = 0;
    let y = 0;
    let width = 0;
    let height = 0;
    let widthScale;
    let heightScale;
    const changeOrientation = pageView.rotation % 180 !== 0;
    const pageWidth =
      (changeOrientation ? pageView.height : pageView.width) /
      pageView.scale /
      CSS_UNITS;
    const pageHeight =
      (changeOrientation ? pageView.width : pageView.height) /
      pageView.scale /
      CSS_UNITS;
    let scale = 0;
    switch (destArray[1].name) {
      case "XYZ":
        x = destArray[2];
        y = destArray[3];
        scale = destArray[4];
        // If x and/or y coordinates are not supplied, default to
        // _top_ left of the page (not the obvious bottom left,
        // since aligning the bottom of the intended page with the
        // top of the window is rarely helpful).
        x = x !== null ? x : 0;
        y = y !== null ? y : pageHeight;
        break;
      case "Fit":
      case "FitB":
        scale = "page-fit";
        break;
      case "FitH":
      case "FitBH":
        y = destArray[2];
        scale = "page-width";
        // According to the PDF spec, section 12.3.2.2, a `null` value in the
        // parameter should maintain the position relative to the new page.
        if (y === null && viewer._location) {
          x = viewer._location.left;
          y = viewer._location.top;
        } else if (typeof y !== "number") {
          // The "top" value isn't optional, according to the spec, however some
          // bad PDF generators will pretend that it is (fixes bug 1663390).
          y = pageHeight;
        }
        break;
      case "FitV":
      case "FitBV":
        x = destArray[2];
        width = pageWidth;
        height = pageHeight;
        scale = "page-height";
        break;
      case "FitR":
        x = destArray[2];
        y = destArray[3];
        width = destArray[4] - x;
        height = destArray[5] - y;
        const hPadding = viewer.removePageBorders ? 0 : SCROLLBAR_PADDING;
        const vPadding = viewer.removePageBorders ? 0 : VERTICAL_PADDING;

        widthScale =
          (viewer.container.clientWidth - hPadding) / width / CSS_UNITS;
        heightScale =
          (viewer.container.clientHeight - vPadding) / height / CSS_UNITS;
        scale = Math.min(Math.abs(widthScale), Math.abs(heightScale));
        break;
      default:
        console.error(
          `${viewer._name}.scrollPageIntoView: ` +
            `"${destArray[1].name}" is not a valid destination type.`
        );
        return;
    }

    if (!ignoreDestinationZoom) {
      if (scale && scale !== viewer._currentScale) {
        viewer.currentScaleValue = scale;
      } else if (viewer._currentScale === UNKNOWN_SCALE) {
        viewer.currentScaleValue = DEFAULT_SCALE_VALUE;
      }
    }

    if (scale === "page-fit" && !destArray[4]) {
      // viewer._scrollIntoView({
      //   pageDiv: pageView.div,
      //   pageNumber,
      // });
      return this._getScrollPos(viewer, {
        page: pageView,
        pageNumber,
        isCitation,
      });
    }

    const boundingRect = [
      pageView.viewport.convertToViewportPoint(x, y),
      pageView.viewport.convertToViewportPoint(x + width, y + height),
    ];
    let left = Math.min(boundingRect[0][0], boundingRect[1][0]);
    let top = Math.min(boundingRect[0][1], boundingRect[1][1]);

    if (!allowNegativeOffset) {
      // Some bad PDF generators will create destinations with e.g. top values
      // that exceeds the page height. Ensure that offsets are not negative,
      // to prevent a previous page from becoming visible (fixes bug 874482).
      left = Math.max(left, 0);
      top = Math.max(top, 0);
    }
    // viewer._scrollIntoView({
    //   pageDiv: pageView.div,
    //   pageSpot: { left, top },
    //   pageNumber,
    // });
    return this._getScrollPos(viewer, {
      page: pageView,
      pageSpot: { left, top },
      pageNumber,
      isCitation,
    });
  }

  _getScrollPos(
    viewer,
    { page, pageSpot = null, pageNumber = null, isCitation = false }
  ) {
    let result;
    const pageDiv = page.div;
    if (viewer instanceof PDFViewer) {
      if (!pageSpot && !this.isInPresentationMode) {
        const left = pageDiv.offsetLeft + pageDiv.clientLeft;
        const right = left + pageDiv.clientWidth;
        const { scrollLeft, clientWidth } = this.container;
        if (
          this._isScrollModeHorizontal ||
          left < scrollLeft ||
          right > scrollLeft + clientWidth
        ) {
          pageSpot = { left: 0, top: 0 };
        }
      }
      console.log(isCitation, "outside");
      result = this.scrollPos(page, pageSpot, false, isCitation);
    } else {
      console.error("Unsupport viewer");
    }
    return result;
  }

  /**
   * This method will, when available, also update the browser history.
   *
   * @param {string|Array} dest - The named, or explicit, PDF destination.
   */
  async goToDestination(dest) {
    if (!this.pdfDocument) {
      return;
    }
    let namedDest, explicitDest;
    if (typeof dest === "string") {
      namedDest = dest;
      explicitDest = await this.pdfDocument.getDestination(dest);
    } else {
      namedDest = null;
      explicitDest = await dest;
    }
    if (!Array.isArray(explicitDest)) {
      console.error(
        `PDFLinkService.goToDestination: "${explicitDest}" is not ` +
          `a valid destination array, for dest="${dest}".`
      );
      return;
    }
    this._goToDestinationHelper(dest, namedDest, explicitDest).then((msg) => {
      const sidebar = this.pdfViewer.container.querySelector("#sidebar");
      sidebar.style.width = "250px";
      sidebar.querySelector("#content").innerHTML = `<div>${msg}</div`;
    });
  }

  /**
   * This method will, when available, also update the browser history.
   *
   * @param {number|string} val - The page number, or page label.
   */
  goToPage(val) {
    if (!this.pdfDocument) {
      return;
    }
    const pageNumber =
      (typeof val === "string" && this.pdfViewer.pageLabelToPageNumber(val)) ||
      val | 0;
    if (
      !(
        Number.isInteger(pageNumber) &&
        pageNumber > 0 &&
        pageNumber <= this.pagesCount
      )
    ) {
      console.error(`PDFLinkService.goToPage: "${val}" is not a valid page.`);
      return;
    }

    if (this.pdfHistory) {
      // Update the browser history before scrolling the new page into view,
      // to be able to accurately capture the current document position.
      this.pdfHistory.pushCurrentPosition();
      this.pdfHistory.pushPage(pageNumber);
    }

    this.pdfViewer.scrollPageIntoView({ pageNumber });
  }

  /**
   * @param {string|Array} dest - The PDF destination object.
   * @returns {string} The hyperlink to the PDF object.
   */
  getDestinationHash(dest) {
    if (typeof dest === "string") {
      if (dest.length > 0) {
        return this.getAnchorUrl("#" + escape(dest));
      }
    } else if (Array.isArray(dest)) {
      const str = JSON.stringify(dest);
      if (str.length > 0) {
        return this.getAnchorUrl("#" + escape(str));
      }
    }
    return this.getAnchorUrl("");
  }

  /**
   * Prefix the full url on anchor links to make sure that links are resolved
   * relative to the current URL instead of the one defined in <base href>.
   * @param {string} anchor - The anchor hash, including the #.
   * @returns {string} The hyperlink to the PDF object.
   */
  getAnchorUrl(anchor) {
    return (this.baseUrl || "") + anchor;
  }

  /**
   * @param {string} hash
   */
  setHash(hash) {
    if (!this.pdfDocument) {
      return;
    }
    let pageNumber, dest;
    if (hash.includes("=")) {
      const params = parseQueryString(hash);
      if ("search" in params) {
        this.eventBus.dispatch("findfromurlhash", {
          source: this,
          query: params.search.replace(/"/g, ""),
          phraseSearch: params.phrase === "true",
        });
      }
      // borrowing syntax from "Parameters for Opening PDF Files"
      if ("page" in params) {
        pageNumber = params.page | 0 || 1;
      }
      if ("zoom" in params) {
        // Build the destination array.
        const zoomArgs = params.zoom.split(","); // scale,left,top
        const zoomArg = zoomArgs[0];
        const zoomArgNumber = parseFloat(zoomArg);

        if (!zoomArg.includes("Fit")) {
          // If the zoomArg is a number, it has to get divided by 100. If it's
          // a string, it should stay as it is.
          dest = [
            null,
            { name: "XYZ" },
            zoomArgs.length > 1 ? zoomArgs[1] | 0 : null,
            zoomArgs.length > 2 ? zoomArgs[2] | 0 : null,
            zoomArgNumber ? zoomArgNumber / 100 : zoomArg,
          ];
        } else {
          if (zoomArg === "Fit" || zoomArg === "FitB") {
            dest = [null, { name: zoomArg }];
          } else if (
            zoomArg === "FitH" ||
            zoomArg === "FitBH" ||
            zoomArg === "FitV" ||
            zoomArg === "FitBV"
          ) {
            dest = [
              null,
              { name: zoomArg },
              zoomArgs.length > 1 ? zoomArgs[1] | 0 : null,
            ];
          } else if (zoomArg === "FitR") {
            if (zoomArgs.length !== 5) {
              console.error(
                'PDFLinkService.setHash: Not enough parameters for "FitR".'
              );
            } else {
              dest = [
                null,
                { name: zoomArg },
                zoomArgs[1] | 0,
                zoomArgs[2] | 0,
                zoomArgs[3] | 0,
                zoomArgs[4] | 0,
              ];
            }
          } else {
            console.error(
              `PDFLinkService.setHash: "${zoomArg}" is not ` +
                "a valid zoom value."
            );
          }
        }
      }
      if (dest) {
        this.pdfViewer.scrollPageIntoView({
          pageNumber: pageNumber || this.page,
          destArray: dest,
          allowNegativeOffset: true,
        });
      } else if (pageNumber) {
        this.page = pageNumber; // simple page
      }
      if ("pagemode" in params) {
        this.eventBus.dispatch("pagemode", {
          source: this,
          mode: params.pagemode,
        });
      }
      // Ensure that this parameter is *always* handled last, in order to
      // guarantee that it won't be overridden (e.g. by the "page" parameter).
      if ("nameddest" in params) {
        this.goToDestination(params.nameddest);
      }
    } else {
      // Named (or explicit) destination.
      dest = unescape(hash);
      try {
        dest = JSON.parse(dest);

        if (!Array.isArray(dest)) {
          // Avoid incorrectly rejecting a valid named destination, such as
          // e.g. "4.3" or "true", because `JSON.parse` converted its type.
          dest = dest.toString();
        }
      } catch (ex) {}

      if (typeof dest === "string" || isValidExplicitDestination(dest)) {
        this.goToDestination(dest);
        return;
      }
      console.error(
        `PDFLinkService.setHash: "${unescape(hash)}" is not ` +
          "a valid destination."
      );
    }
  }

  /**
   * @param {string} action
   */
  executeNamedAction(action) {
    // See PDF reference, table 8.45 - Named action
    switch (action) {
      case "GoBack":
        if (this.pdfHistory) {
          this.pdfHistory.back();
        }
        break;

      case "GoForward":
        if (this.pdfHistory) {
          this.pdfHistory.forward();
        }
        break;

      case "NextPage":
        this.pdfViewer.nextPage();
        break;

      case "PrevPage":
        this.pdfViewer.previousPage();
        break;

      case "LastPage":
        this.page = this.pagesCount;
        break;

      case "FirstPage":
        this.page = 1;
        break;

      default:
        break; // No action according to spec
    }

    this.eventBus.dispatch("namedaction", {
      source: this,
      action,
    });
  }

  /**
   * @param {number} pageNum - page number.
   * @param {Object} pageRef - reference to the page.
   */
  cachePageRef(pageNum, pageRef) {
    if (!pageRef) {
      return;
    }
    const refStr =
      pageRef.gen === 0 ? `${pageRef.num}R` : `${pageRef.num}R${pageRef.gen}`;
    this._pagesRefCache[refStr] = pageNum;
  }

  /**
   * @private
   */
  _cachedPageNumber(pageRef) {
    const refStr =
      pageRef.gen === 0 ? `${pageRef.num}R` : `${pageRef.num}R${pageRef.gen}`;
    return this._pagesRefCache?.[refStr] || null;
  }

  /**
   * @param {number} pageNumber
   */
  isPageVisible(pageNumber) {
    return this.pdfViewer.isPageVisible(pageNumber);
  }

  /**
   * @param {number} pageNumber
   */
  isPageCached(pageNumber) {
    return this.pdfViewer.isPageCached(pageNumber);
  }

  /* eslint-disable no-unmodified-loop-condition */
  // override ui_utils.js
  scrollPos(
    page,
    spot,
    skipOverflowHiddenElements = false,
    isCitation = false
  ) {
    // Assuming offsetParent is available (it's not available when viewer is in
    // hidden iframe or object). We have to scroll: if the offsetParent is not set
    // producing the error. See also animationStarted.
    const element = page.div;
    let parent = element.offsetParent;
    if (!parent) {
      console.error("offsetParent is not set -- cannot scroll");
      return;
    }
    let offsetY = element.offsetTop + element.clientTop;
    let offsetX = element.offsetLeft + element.clientLeft;
    //   console.log(offsetX, element.clientTop);
    while (
      (parent.clientHeight === parent.scrollHeight &&
        parent.clientWidth === parent.scrollWidth) ||
      (skipOverflowHiddenElements &&
        getComputedStyle(parent).overflow === "hidden")
    ) {
      if (parent.dataset._scaleY) {
        offsetY /= parent.dataset._scaleY;
        offsetX /= parent.dataset._scaleX;
      }
      offsetY += parent.offsetTop;
      offsetX += parent.offsetLeft;
      parent = parent.offsetParent;
      if (!parent) {
        return; // no need to scroll
      }
    }
    console.log(offsetX, offsetY);
    console.log(spot);
    if (spot) {
      if (spot.top !== undefined) {
        offsetY += spot.top;
      }
      if (spot.left !== undefined) {
        offsetX += spot.left;
        //   parent.scrollLeft = offsetX;
      }
    }
    //   parent.scrollTop = offsetY;

    console.log("hello", isCitation);
    // get citation
    let msg = "";
    const pageLeft = spot.left;
    const pageTop = spot.top;
    let promise;
    if (isCitation) {
      console.log(page);
      // console.log(page.draw());

      let textLayer = page.textLayer;
      if (!textLayer) {
        const textLayerDiv = document.createElement("div");
        textLayerDiv.className = "textLayer";
        textLayerDiv.style.width = page.div.style.width;
        textLayerDiv.style.height = page.div.style.height;

        textLayer = page.textLayerFactory.createTextLayerBuilder(
          textLayerDiv,
          page.id - 1,
          page.viewport,
          page.textLayerMode === 2,
          page.eventBus
        );
        page.div.appendChild(textLayerDiv);
        const readableStream = page.pdfPage.streamTextContent({
          normalizeWhitespace: true,
          includeMarkedContent: true,
        });
        textLayer.setTextContentStream(readableStream);
        textLayer.render();
        promise = textLayer.textLayerRenderTask.promise.then(() => {
          const spans = textLayer.textDivs;
          // const spans = textLayerDiv.querySelectorAll("span");
          // console.log(element, spans);
          // console.log(spans.length);
          // console.log(pageLeft, pageTop, element.clientLeft, element.clientTop);
          for (const span of spans) {
            const left = parseFloat(span.style.left);
            const top = parseFloat(span.style.top);
            // console.log(left, top);
            if (Math.abs(left - pageLeft) < 1 && Math.abs(top - pageTop) < 10) {
              msg = span.innerHTML;
              let currentEl = span.nextSibling;
              while (!currentEl.innerHTML.match(/\[\d+\]/)) {
                msg += " " + currentEl.innerHTML;
                currentEl = currentEl.nextSibling;
              }
              // console.log("found", msg, span);
            }
          }
        });
        // console.log(msg);
        // console.log(page);
        // console.log(textLayer);
        // console.log("here");
      }

      // page.draw().then((p) => {
      //   console.log("hello", p);
      // });
      // this.pdfDocument
      //   .getPageIndex(destRef)
      //   .then((pageIndex) => {
      //     this.cachePageRef(pageIndex + 1, destRef);
      //     this._goToDestinationHelper(rawDest, namedDest, explicitDest);
      //   })
      //   .catch(() => {
      //     console.error(
      //       `PDFLinkService._goToDestinationHelper: "${destRef}" is not ` +
      //         `a valid page reference, for dest="${rawDest}".`
      //     );
      //   });
    }

    if (!promise) {
      promise = Promise.resolve({
        scrollLeft: offsetX,
        scrollTop: offsetY,
        pageLeft,
        pageTop,
        msg,
      });
    }
    return promise.then(() => {
      return {
        scrollLeft: offsetX,
        scrollTop: offsetY,
        pageLeft,
        pageTop,
        msg,
      };
    });
  }
}

function isValidExplicitDestination(dest) {
  if (!Array.isArray(dest)) {
    return false;
  }
  const destLength = dest.length;
  if (destLength < 2) {
    return false;
  }
  const page = dest[0];
  if (
    !(
      typeof page === "object" &&
      Number.isInteger(page.num) &&
      Number.isInteger(page.gen)
    ) &&
    !(Number.isInteger(page) && page >= 0)
  ) {
    return false;
  }
  const zoom = dest[1];
  if (!(typeof zoom === "object" && typeof zoom.name === "string")) {
    return false;
  }
  let allowNull = true;
  switch (zoom.name) {
    case "XYZ":
      if (destLength !== 5) {
        return false;
      }
      break;
    case "Fit":
    case "FitB":
      return destLength === 2;
    case "FitH":
    case "FitBH":
    case "FitV":
    case "FitBV":
      if (destLength !== 3) {
        return false;
      }
      break;
    case "FitR":
      if (destLength !== 6) {
        return false;
      }
      allowNull = false;
      break;
    default:
      return false;
  }
  for (let i = 2; i < destLength; i++) {
    const param = dest[i];
    if (!(typeof param === "number" || (allowNull && param === null))) {
      return false;
    }
  }
  return true;
}

export { MyLinkService };
