<script>
  let openItem = "";
  function handleClick(event) {
    let clickedItem = event.target.id;
    if (openItem == event.target.id) {
      openItem = "";
    } else {
      openItem = clickedItem;
    }
  }
</script>

<div class="container row">
  <div class="menubar">
    <button id="plugin" on:click={handleClick}>Plugin</button>
  </div>
    <div class="extendedMenu" style="display: {openItem != "" ? "" : "none"}"/>
</div>

<style>
  .menubar {
    /* width: 50px; */
    height: 100%;
    background-color: silver;
  }
  .extendedMenu {
    width: 100px;
    background-color: snow;
  }
</style>
