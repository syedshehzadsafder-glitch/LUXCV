/* ==========================================================================
   LUXCV - pdf-download.js
   "Download PDF": creates an IMAGE-based PDF in the browser and downloads it.
   Each page is a picture of the resume, so the text in this PDF is not
   selectable and ATS systems cannot read it. For a PDF with real text use
   "Save as PDF" (the browser's print window, see pdf-export.js).

   Libraries (MIT, bundled in js/vendor/, loaded only when first needed):
     html2canvas 1.4.1  draws the rendered resume onto a canvas
     jsPDF 2.5.2        packs the canvas pictures into an A4 PDF

   Pages are cut between entries, never through a line of text. Later pages
   get a top and bottom margin continued from the page background.
   Nothing leaves the browser.
   ========================================================================== */
(function () {
  'use strict';

  var LuxCV = (window.LuxCV = window.LuxCV || {});

  var PAGE_W_PX = 794;          /* 210 mm at 96 dpi */
  var PAGE_H_PX = 1123;         /* 297 mm at 96 dpi */
  var MARGIN_PX = 45;           /* about 12 mm on continuation pages */
  var SCALE = 2;                /* canvas pixels per CSS pixel */
  var JPEG_QUALITY = 0.92;
  var NO_CUT = '.rs-header, .rs-item, .rs-heading, .rs-name, .rs-title, .rs-photo, p, li, h1, h2, h3';

  var loading = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = function () { reject(new Error('Could not load ' + src)); };
      document.head.appendChild(script);
    });
  }

  function loadLibraries() {
    if (window.html2canvas && window.jspdf && window.jspdf.jsPDF) {
      return Promise.resolve();
    }
    if (!loading) {
      loading = loadScript('js/vendor/html2canvas.min.js')
        .then(function () { return loadScript('js/vendor/jspdf.umd.min.js'); })
        .catch(function (error) { loading = null; throw error; });
    }
    return loading;
  }

  function isSupported() {
    return typeof document.createElement('canvas').getContext === 'function';
  }

  /* Y positions (CSS px from the top of the sheet) where cutting would slice
     through content: every text block's span. */
  function blockedSpans(sheet) {
    var top = sheet.getBoundingClientRect().top;
    return Array.prototype.map.call(sheet.querySelectorAll(NO_CUT), function (node) {
      var rect = node.getBoundingClientRect();
      /* Headings must stay with what follows them. */
      var extra = node.classList.contains('rs-heading') ? 14 : 0;
      return { from: rect.top - top, to: rect.bottom - top + extra };
    }).filter(function (span) { return span.to - span.from > 0; });
  }

  function isCutSafe(y, spans) {
    for (var i = 0; i < spans.length; i += 1) {
      if (y > spans[i].from + 1 && y < spans[i].to - 1) {
        return false;
      }
    }
    return true;
  }

  /* True when the rows around y (about 7 CSS px) are all blank. */
  function bandBlank(rowBlank, y) {
    for (var d = -3.5; d <= 3.5; d += 0.5) {
      if (!rowBlank(y + d)) {
        return false;
      }
    }
    return true;
  }

  /* Returns [[from, to], …] in CSS px, one pair per page. */
  function planPages(totalHeight, spans, rowBlank) {
    var pages = [];
    var start = 0;
    var guard = 0;

    while (guard < 50) {
      guard += 1;
      var top = pages.length ? MARGIN_PX : 0;
      var room = PAGE_H_PX - top;
      if (totalHeight - start <= room) {
        pages.push([start, totalHeight]);
        break;
      }
      var limit = start + room - MARGIN_PX;
      var cut = 0;
      /* The canvas can place text a few pixels away from where the page
         measured it, so the picture itself decides. First choice: a clear
         band of blank rows (a real gap) that is also between entries.
         Then any clear band, then any gap between entries, then the limit. */
      for (var pass = 0; pass < 3 && !cut; pass += 1) {
        for (var y = limit; y > start + room * 0.5; y -= 1) {
          var gap = rowBlank ? rowBlank(y) && bandBlank(rowBlank, y) : true;
          var safe = isCutSafe(y, spans);
          if ((pass === 0 && gap && safe) || (pass === 1 && gap) || (pass === 2 && safe)) {
            cut = y;
            break;
          }
        }
      }
      if (!cut) {
        cut = limit; /* one giant block: cut where it must be */
      }
      pages.push([start, cut]);
      start = cut;
    }
    return pages;
  }

  /* html2canvas misreads "mm" lengths inside gradients (the sidebar bands),
     so in the copy it draws they are rewritten as pixels. */
  var MM_TO_PX = 96 / 25.4;

  function gradientToPx(value) {
    return value
      .replace(/calc\(\s*([\d.]+)mm\s*-\s*([\d.]+)px\s*\)/g, function (all, mm, px) {
        return (parseFloat(mm) * MM_TO_PX - parseFloat(px)).toFixed(2) + 'px';
      })
      .replace(/([\d.]+)mm/g, function (all, mm) {
        return (parseFloat(mm) * MM_TO_PX).toFixed(2) + 'px';
      });
  }

  function fixGradients(doc) {
    Array.prototype.forEach.call(doc.querySelectorAll('.resume-sheet, .resume-sheet *'), function (node) {
      var image = doc.defaultView.getComputedStyle(node).backgroundImage;
      if (image && image.indexOf('gradient') !== -1 && image.indexOf('mm') !== -1) {
        node.style.backgroundImage = gradientToPx(image);
      }
    });
  }

  /* True when a pixel row of the rendered sheet holds no text: only a few
     colour changes (background bands, rules). The page margins are stretched
     from such a row. */
  function makeRowBlank(canvas) {
    var ctx = canvas.getContext('2d');
    var cache = {};
    return function rowBlank(y) {
      var row = Math.max(0, Math.min(canvas.height - 1, Math.round(y * SCALE)));
      if (cache[row] !== undefined) {
        return cache[row];
      }
      var data = ctx.getImageData(0, row, canvas.width, 1).data;
      var changes = 0;
      for (var i = 4; i < data.length; i += 4) {
        var diff = Math.abs(data[i] - data[i - 4]) + Math.abs(data[i + 1] - data[i - 3]) + Math.abs(data[i + 2] - data[i - 2]);
        if (diff > 24) {
          changes += 1;
        }
      }
      cache[row] = changes <= 12;
      return cache[row];
    };
  }

  function fileName(resume) {
    return LuxCV.PdfExport.filenameFor(resume) + '.pdf';
  }

  /* Draws one page: the slice of the full canvas plus continued margins. */
  function composePage(full, range, isFirst, rowBlank) {
    var topMargin = isFirst ? 0 : MARGIN_PX * SCALE;
    var from = Math.round(range[0] * SCALE);
    var to = Math.min(full.height, Math.round(range[1] * SCALE));
    var sliceH = Math.max(1, to - from);

    var page = document.createElement('canvas');
    page.width = full.width;
    page.height = PAGE_H_PX * SCALE;
    var ctx = page.getContext('2d');

    /* Fill the page with the sheet's own background first. */
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, page.width, page.height);

    ctx.drawImage(full, 0, from, full.width, sliceH, 0, topMargin, full.width, sliceH);

    /* Margins continue the row of background just outside the slice, so
       sidebar colour bands run unbroken to the page edge. */
    function stretch(sourceY, destY, destH) {
      if (destH <= 0) { return; }
      var y = Math.max(0, Math.min(full.height - 1, sourceY));
      /* Use the nearest row without text, so no letters are smeared. */
      for (var step = 0; step < 400 && !rowBlank(y / SCALE); step += 1) {
        var up = y - step;
        var down = y + step;
        if (up >= 0 && rowBlank(up / SCALE)) { y = up; break; }
        if (down < full.height && rowBlank(down / SCALE)) { y = down; break; }
      }
      ctx.drawImage(full, 0, y, full.width, 1, 0, destY, full.width, destH);
    }
    if (!isFirst) {
      stretch(from, 0, topMargin);
    }
    var used = topMargin + sliceH;
    if (used < page.height) {
      stretch(to, used, page.height - used);
    }
    return page;
  }

  /* Builds the PDF and starts the download.
     Resolves { fileName, pages } once the browser has been handed the file;
     rejects with an Error when anything fails. */
  function download(resume, templateId) {
    var Data = LuxCV.Data;
    var host = null;

    return loadLibraries().then(function () {
      var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      return fontsReady;
    }).then(function () {
      host = document.createElement('div');
      host.setAttribute('aria-hidden', 'true');
      host.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + PAGE_W_PX + 'px;pointer-events:none;';
      var sheet = LuxCV.Renderer.build(resume, templateId, {
        links: false,
        printVersion: templateId === 'midnight-premium'
      });
      host.appendChild(sheet);
      document.body.appendChild(host);

      var height = Math.ceil(sheet.getBoundingClientRect().height);
      var spans = blockedSpans(sheet);

      return window.html2canvas(sheet, {
        scale: SCALE,
        backgroundColor: null,
        useCORS: false,
        logging: false,
        width: PAGE_W_PX,
        height: height,
        windowWidth: PAGE_W_PX,
        onclone: function (doc) { fixGradients(doc); }
      }).then(function (canvas) {
        var rowBlank = makeRowBlank(canvas);
        var pages = planPages(height, spans, rowBlank);
        var jsPDF = window.jspdf.jsPDF;
        var pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
        pdf.setProperties({ title: LuxCV.PdfExport.filenameFor(resume), creator: 'LUXCV' });

        pages.forEach(function (range, index) {
          if (index > 0) {
            pdf.addPage('a4', 'portrait');
          }
          var page = composePage(canvas, range, index === 0, rowBlank);
          pdf.addImage(page.toDataURL('image/jpeg', JPEG_QUALITY), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
        });

        var name = fileName(resume);
        pdf.save(name);
        return { fileName: name, pages: pages.length };
      });
    }).then(function (result) {
      if (host && host.parentNode) { host.parentNode.removeChild(host); }
      return result;
    }, function (error) {
      if (host && host.parentNode) { host.parentNode.removeChild(host); }
      throw error;
    });
  }

  LuxCV.PdfDownload = {
    isSupported: isSupported,
    download: download,
    planPages: planPages
  };
})();
