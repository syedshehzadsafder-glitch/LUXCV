/* ==========================================================================
   LUXCV - pdf-export.js
   PDF export uses the browser's own print engine ("Save as PDF"), driven by
   css/print.css. No library and no network access are needed, and the PDF
   keeps real, selectable text.

   Honesty note: window.print() only opens the print window. Pages cannot see
   whether the person then saved, printed or cancelled, so this module never
   reports that a file was created.
   ========================================================================== */
(function () {
  'use strict';

  var LuxCV = (window.LuxCV = window.LuxCV || {});

  /* Browsers use the page title as the default PDF file name. */
  function filenameFor(resume) {
    var name = resume && resume.personal ? String(resume.personal.fullName || '') : '';
    name = name.replace(/[\u0000-\u001f<>:"\/\\|?*]+/g, ' ').replace(/\s+/g, ' ').trim();
    return name ? name + ' - Resume' : 'LUXCV Resume';
  }

  /* Sets the document title to the file name; returns a function that puts
     the old title back. */
  function applyTitle(resume) {
    var previous = document.title;
    document.title = filenameFor(resume);
    return function restore() {
      document.title = previous;
    };
  }

  function isSupported() {
    return typeof window.print === 'function';
  }

  /* Opens the print window. Returns true when it was opened, false when the
     browser refused or printing is unsupported. */
  function print(resume) {
    if (!isSupported()) {
      return false;
    }
    var restore = applyTitle(resume);

    function done() {
      window.removeEventListener('afterprint', done);
      restore();
    }

    window.addEventListener('afterprint', done);
    try {
      window.print();
      return true;
    } catch (error) {
      done();
      return false;
    }
  }

  LuxCV.PdfExport = {
    filenameFor: filenameFor,
    applyTitle: applyTitle,
    isSupported: isSupported,
    print: print
  };
})();
