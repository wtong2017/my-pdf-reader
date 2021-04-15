import App from "./App.svelte";
import "pdfjs-dist/web/pdf_viewer.css";
import "./global.css";

const app = new App({
  target: document.getElementById("root"), // entry point in ../public/index.html
});

export default app;
