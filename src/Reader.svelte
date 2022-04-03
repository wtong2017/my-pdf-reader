<script>
  import { onMount } from "svelte";

  import * as pdfjsViewer from "pdfjs-dist/web/pdf_viewer";

  import { MyLinkService } from "./Reader/myPDFLinkService.js";
  const pdfjsLib = require("pdfjs-dist/webpack.js");

  const myState = {
    pdf: null,
    currentPage: 1,
    zoom: 1,
  };

  let lastPosition = null;
  let lastPositionOffset = null;

  const SEARCH_FOR = "";

  let CMAP_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@2.5.207/cmaps/";
  let CMAP_PACKED = true;

  onMount(() => {
    console.log("mounted");

    const inputElement = document.getElementById("inputElement");
    if (inputElement) {
      // load with input file
      inputElement.onchange = function (event) {
        const file = event.target.files[0];

        // Step 2: Read the file using file reader
        const fileReader = new FileReader();

        fileReader.onload = function () {
          // Step 4:turn array buffer into typed array
          const typedarray = new Uint8Array(this.result);

          // Step 5:PDFJS should be able to read this
          const loadingTask = pdfjsLib.getDocument({
            data: typedarray,
            cMapUrl: CMAP_URL,
            cMapPacked: CMAP_PACKED,
          });
          loadingTask.promise.then(function (pdf) {
            console.log("pdf ready");
            // you can now use *pdf* here
            myState.pdf = pdf;
            pdfViewer.setDocument(myState.pdf);
            pdfLinkService.setDocument(myState.pdf, null);
          });
        };
        // Step 3:Read the file as ArrayBuffer
        fileReader.readAsArrayBuffer(file);
      };
    } else {
      // load with link query
      const queryString = document.location.search.substring(1);
      const urlParams = new URLSearchParams(queryString);
      const loadingTask = pdfjsLib.getDocument({
        url: urlParams.get("file"),
        cMapUrl: CMAP_URL,
        cMapPacked: CMAP_PACKED,
      });
      loadingTask.promise.then(function (pdf) {
        // you can now use *pdf* here
        myState.pdf = pdf;
        pdfViewer.setDocument(myState.pdf);
        pdfLinkService.setDocument(myState.pdf, null);
      });
    }

    const container = document.getElementById("viewerContainer");
    const viewer = document.getElementById("viewer");
    const eventBus = new pdfjsViewer.EventBus();
    const pdfLinkService = new MyLinkService({
      eventBus: eventBus,
      externalLinkTarget: 2, // new tab
    });
    const pdfFindController = new pdfjsViewer.PDFFindController({
      eventBus: eventBus,
      linkService: pdfLinkService,
    });

    const pdfViewer = new pdfjsViewer.PDFViewer({
      container: container,
      eventBus: eventBus,
      linkService: pdfLinkService,
      findController: pdfFindController,
    });
    pdfLinkService.setViewer(pdfViewer);

    eventBus.on("pagesinit", function () {
      // We can use pdfViewer now, e.g. let's change default scale.
      pdfViewer.currentScaleValue = "page-width";

      if (SEARCH_FOR) {
        pdfFindController.executeCommand("find", { query: SEARCH_FOR });
      }
    });

    function goBack() {
      if (lastPosition) {
        lastPosition = null;
        container.scroll(0, lastPositionOffset);
      }
    }

    document.getElementById("back").addEventListener("click", goBack);

    document.addEventListener(
      "click",
      function (event) {
        if (
          event.target.tagName === "A" &&
          event.target.className === "internalLink"
        ) {
          lastPosition = event.target;
        }
      },
      false
    );

    viewer.addEventListener(
      "mousedown",
      function (event) {
        lastPositionOffset =
          -event.currentTarget.getBoundingClientRect().top + 32;
      },
      false
    );

    document
      .querySelector("#sidebar>.closebtn")
      .addEventListener("click", closeNav);
  });

  function closeNav() {
    document.getElementById("sidebar").style.width = "0px";
  }
</script>

<div style="position: relative" class={$$props.class}>
  <div id="viewerContainer">
    <div id="viewer" class="pdfViewer" />
    <div id="sidebar" class="sidebar">
      <div id="content" />
      <button class="closebtn" on:click={closeNav}>&times;</button>
    </div>
  </div>
</div>

<style>
  #viewerContainer {
    overflow: auto;
    position: absolute;
    width: 100%;
    height: 100%;
  }

  .sidebar {
    height: 100%;
    width: 0;
    right: 0;
    top: 0;
    background-color: #fff;
    position: fixed !important;
    z-index: 1;
    overflow: auto;
    transition: 0.5s; /* 0.5 second transition effect to slide in the sidenav */
    padding-top: 60px; /* Place content 60px from the top */
    transition: 0.5s; /* 0.5 second transition effect to slide in the sidenav */
  }

  .sidebar .closebtn {
    position: absolute;
    top: 0;
    right: 25px;
    font-size: 36px;
    margin-left: 50px;
  }
</style>
