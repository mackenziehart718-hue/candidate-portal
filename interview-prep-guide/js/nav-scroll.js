/** Toggles .scrolled on .page-nav once the user scrolls past the top of the page. */
(function () {
  var nav = document.querySelector('.page-nav');
  if (!nav) return;
  var THRESHOLD = 8;

  function update() {
    nav.classList.toggle('scrolled', window.scrollY > THRESHOLD);
  }

  update();
  window.addEventListener('scroll', update, { passive: true });
})();
