/* Логика информационных страниц */
(function () {
  'use strict';
  var year = document.getElementById('year');
  if (year) year.textContent = String(Math.max(2026, new Date().getFullYear()));
  var nav = document.querySelector('.page-nav');
  if (nav) {
    var update = function () { nav.classList.toggle('scrolled', window.scrollY > 10); };
    addEventListener('scroll', update, { passive: true });
    update();
  }
})();
