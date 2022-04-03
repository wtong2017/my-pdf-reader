<script>
  import Reader from "./Reader.svelte";
  import Menubar from "./Menubar.svelte";
</script>

<style>
  :global(.reader) {
    flex-grow: 1;
  }
</style>

<div class="container row" style="height: 100%">
  <Menubar />
  <Reader class="reader" />
</div>
