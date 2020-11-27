const pdfjsLib = require('pdfjs-dist/webpack.js');
import * as pdfjsViewer from 'pdfjs-dist/web/pdf_viewer';

import "pdfjs-dist/web/pdf_viewer.css"

var myState = {
    pdf: null,
    currentPage: 1,
    zoom: 1
}

let lastPosition = null

var SEARCH_FOR = ""

// var CMAP_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@2.5.207/cmaps/";
// var CMAP_PACKED = true;

var inputElement = document.getElementById("inputElement")
if (inputElement) {
    // load with input file
    inputElement.onchange = function (event) {

        var file = event.target.files[0];

        //Step 2: Read the file using file reader
        var fileReader = new FileReader();

        fileReader.onload = function () {

            //Step 4:turn array buffer into typed array
            var typedarray = new Uint8Array(this.result);

            //Step 5:PDFJS should be able to read this
            var loadingTask = pdfjsLib.getDocument({
                data: typedarray,
                // cMapUrl: CMAP_URL,
                // cMapPacked: CMAP_PACKED
            });
            loadingTask.promise.then(function (pdf) {
                // you can now use *pdf* here
                myState.pdf = pdf;
                pdfViewer.setDocument(myState.pdf);
                pdfLinkService.setDocument(myState.pdf, null);
                render();
            });
        };
        //Step 3:Read the file as ArrayBuffer
        fileReader.readAsArrayBuffer(file);
    }
} else {
    // load with link query
    let queryString = document.location.search.substring(1)
    const urlParams = new URLSearchParams(queryString);
    var loadingTask = pdfjsLib.getDocument({
        url: urlParams.get("file"),
        // cMapUrl: CMAP_URL,
        // cMapPacked: CMAP_PACKED
    });
    loadingTask.promise.then(function (pdf) {
        // you can now use *pdf* here
        myState.pdf = pdf;
        pdfViewer.setDocument(myState.pdf);
        pdfLinkService.setDocument(myState.pdf, null);
        render();
    });
}

var container = document.getElementById("viewerContainer");
var eventBus = new pdfjsViewer.EventBus();
var pdfLinkService = new pdfjsViewer.PDFLinkService({
    eventBus: eventBus,
    externalLinkTarget: 2 // new tab
});
var pdfFindController = new pdfjsViewer.PDFFindController({
    eventBus: eventBus,
    linkService: pdfLinkService,
});

var pdfViewer = new pdfjsViewer.PDFViewer({
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

function render() {

}

function goBack() {
    if (lastPosition) {
        lastPosition.scrollIntoView()
        lastPosition = null
    }
}

document.getElementById("back").addEventListener("click", goBack);

document.addEventListener('click', function (event) {
    if (event.target.tagName == 'A' && event.target.className == "internalLink") {
        lastPosition = event.target
    }
}, false);