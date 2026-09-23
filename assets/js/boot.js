/* Ранний флаг: грузится синхронно в <head>, чтобы интро не «мигало». */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('js');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) {
    root.classList.add('intro');
  }
  // Страховка: если основной скрипт не загрузился — показываем всё как есть.
  setTimeout(function () {
    if (!root.classList.contains('app-ready')) {
      root.classList.remove('intro', 'js');
      root.classList.add('intro-done');
    }
  }, 5000);
})();
