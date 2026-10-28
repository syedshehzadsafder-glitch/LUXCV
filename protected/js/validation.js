/* ==========================================================================
   LUXCV - validation.js
   Pure validation helpers. Field validators return '' when the value is valid
   or a short, human-readable message when it is not. Empty optional values
   are valid; combine with required() where a value must be present.

   validateResume(resume) applies every rule to a whole resume and returns
   errors keyed by stable paths, so an error stays attached to the right entry
   when other entries are added or removed:

     personal.email                    summary
     experience.<entryId>.role         education.<entryId>.school
     projects.<entryId>.link           certifications.<entryId>.url   …
   ========================================================================== */
(function () {
  'use strict';

  var LuxCV = (window.LuxCV = window.LuxCV || {});

  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var PHONE_PATTERN = /^[+()\d\s.-]{7,25}$/;
  var UNSAFE_SCHEME = /^\s*(?:javascript|data|vbscript|file|blob|about):/i;

  /* Maximum lengths, shared with the form (maxlength attributes). */
  var LIMITS = {
    name: 80,
    short: 100,
    email: 120,
    phone: 25,
    url: 300,
    summary: 1000,
    text: 2000,
    skill: 40,
    maxSkills: 50
  };

  var MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
    'august', 'september', 'october', 'november', 'december'];

  function clean(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  /* ---------- single-field validators ---------- */

  function required(value, label) {
    return clean(value) ? '' : (label || 'This field') + ' is required.';
  }

  function email(value) {
    var text = clean(value);
    if (!text) {
      return '';
    }
    var valid = EMAIL_PATTERN.test(text) && text.indexOf('..') === -1 && text.length <= 254;
    return valid ? '' : 'Enter a valid email address, like name@example.com.';
  }

  function phone(value) {
    var text = clean(value);
    if (!text) {
      return '';
    }
    var digits = text.replace(/\D/g, '').length;
    return PHONE_PATTERN.test(text) && digits >= 7 && digits <= 15
      ? ''
      : 'Enter a valid phone number, like +44 20 7946 0958.';
  }

  /* Returns a safe, absolute http(s) URL for the value, or '' when the value
     is empty or not a usable web address. A missing scheme is assumed to be
     https. Other schemes (javascript:, data:, mailto:, …) are never accepted. */
  function normalizeUrl(value) {
    var text = clean(value);
    if (!text || UNSAFE_SCHEME.test(text) || /\s/.test(text)) {
      return '';
    }
    var candidate = /^https?:\/\//i.test(text) ? text : 'https://' + text.replace(/^\/+/, '');
    try {
      var parsed = new URL(candidate);
      var host = parsed.hostname;
      var ok = (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        !parsed.username && !parsed.password &&
        host.indexOf('.') > 0 && !/\.$/.test(host) && !/\.\./.test(host);
      return ok ? parsed.href : '';
    } catch (error) {
      return '';
    }
  }

  function url(value) {
    var text = clean(value);
    if (!text) {
      return '';
    }
    return normalizeUrl(text) ? '' : 'Enter a valid web address, like example.com/portfolio.';
  }

  function linkedin(value) {
    var text = clean(value);
    if (!text) {
      return '';
    }
    var href = normalizeUrl(text);
    if (!href) {
      return 'Enter a valid web address, like linkedin.com/in/your-name.';
    }
    var host = new URL(href).hostname.toLowerCase();
    return host === 'linkedin.com' || /\.linkedin\.com$/.test(host)
      ? ''
      : 'Enter a LinkedIn address, like linkedin.com/in/your-name.';
  }

  function maxLength(value, limit) {
    return clean(value).length <= limit ? '' : 'Keep this under ' + limit + ' characters.';
  }

  /* ---------- dates ---------- */

  function buildDate(year, month) {
    var latest = new Date().getFullYear() + 10;
    if (year < 1950 || year > latest) {
      return null;
    }
    return { year: year, month: month };
  }

  /* Understands "2022", "Jun 2022", "June 2022", "06/2022" and "2022-06".
     Returns { year, month } (month is 0 when only a year was given) or null. */
  function parseDate(value) {
    var text = clean(value).replace(/\s+/g, ' ');
    var match;

    if (!text) {
      return null;
    }
    if ((match = /^(\d{4})$/.exec(text))) {
      return buildDate(+match[1], 0);
    }
    if ((match = /^(\d{4})[-/](\d{1,2})$/.exec(text))) {
      return +match[2] >= 1 && +match[2] <= 12 ? buildDate(+match[1], +match[2]) : null;
    }
    if ((match = /^(\d{1,2})[-/](\d{4})$/.exec(text))) {
      return +match[1] >= 1 && +match[1] <= 12 ? buildDate(+match[2], +match[1]) : null;
    }
    if ((match = /^([A-Za-z]{3,9})\.?,? (\d{4})$/.exec(text))) {
      var name = match[1].toLowerCase();
      for (var i = 0; i < MONTHS.length; i += 1) {
        if (MONTHS[i].indexOf(name) === 0) {
          return buildDate(+match[2], i + 1);
        }
      }
    }
    return null;
  }

  function isOpenEnded(value) {
    return /^(present|current|now|ongoing)$/i.test(clean(value));
  }

  /* options.allowOpen lets an end date say "Present". */
  function dateFormat(value, options) {
    var text = clean(value);
    if (!text) {
      return '';
    }
    if (options && options.allowOpen && isOpenEnded(text)) {
      return '';
    }
    return parseDate(text) ? '' : 'Use a format like Jun 2022, 06/2022 or 2022.';
  }

  function dateOrder(start, end) {
    var from = parseDate(start);
    var to = parseDate(end);
    if (!from || !to) {
      return '';
    }
    var fromKey = from.year * 100 + (from.month || 1);
    var toKey = to.year * 100 + (to.month || 12);
    return toKey < fromKey ? 'The end date can’t be before the start date.' : '';
  }

  /* ---------- whole-resume validation ---------- */

  function joinLines(value) {
    return Array.isArray(value) ? value.join('\n') : '';
  }

  function validateResume(resume) {
    var Data = LuxCV.Data;
    var errors = {};
    var firstKey = '';
    var data = resume && typeof resume === 'object' ? resume : {};

    /* Records the first message for a key; later rules never overwrite it. */
    function add(key, message) {
      if (message && !errors[key]) {
        errors[key] = message;
        if (!firstKey) {
          firstKey = key;
        }
      }
    }

    function each(listName, handler) {
      (Array.isArray(data[listName]) ? data[listName] : []).forEach(function (entry) {
        /* Entries the user has not started are ignored, not flagged. */
        if (entry && entry.id && Data.entryHasContent(entry)) {
          handler(entry, listName + '.' + entry.id + '.');
        }
      });
    }

    var p = data.personal || {};
    add('personal.fullName', required(p.fullName, 'Full name') || maxLength(p.fullName, LIMITS.name));
    add('personal.jobTitle', maxLength(p.jobTitle, LIMITS.short));
    add('personal.email', required(p.email, 'Email') || email(p.email) || maxLength(p.email, LIMITS.email));
    add('personal.phone', phone(p.phone));
    add('personal.location', maxLength(p.location, LIMITS.short));
    add('personal.linkedin', linkedin(p.linkedin) || maxLength(p.linkedin, LIMITS.url));
    add('personal.website', url(p.website) || maxLength(p.website, LIMITS.url));

    add('summary', maxLength(data.summary, LIMITS.summary));

    each('experience', function (e, key) {
      add(key + 'role', required(e.role, 'Job title') || maxLength(e.role, LIMITS.short));
      add(key + 'company', required(e.company, 'Company') || maxLength(e.company, LIMITS.short));
      add(key + 'location', maxLength(e.location, LIMITS.short));
      add(key + 'start', dateFormat(e.start));
      if (!e.current) {
        add(key + 'end', dateFormat(e.end, { allowOpen: true }) || dateOrder(e.start, e.end));
      }
      add(key + 'highlights', maxLength(joinLines(e.highlights), LIMITS.text));
    });

    each('education', function (e, key) {
      add(key + 'school', required(e.school, 'Institution') || maxLength(e.school, LIMITS.short));
      add(key + 'degree', required(e.degree, 'Qualification') || maxLength(e.degree, LIMITS.short));
      add(key + 'field', maxLength(e.field, LIMITS.short));
      add(key + 'location', maxLength(e.location, LIMITS.short));
      add(key + 'start', dateFormat(e.start));
      add(key + 'end', dateFormat(e.end, { allowOpen: true }) || dateOrder(e.start, e.end));
      add(key + 'details', maxLength(e.details, LIMITS.text));
      add(key + 'coursework', maxLength((e.coursework || []).join(', '), LIMITS.text));
    });

    each('projects', function (e, key) {
      add(key + 'name', required(e.name, 'Project name') || maxLength(e.name, LIMITS.short));
      add(key + 'link', url(e.link) || maxLength(e.link, LIMITS.url));
      add(key + 'technologies', maxLength((e.technologies || []).join(', '), LIMITS.text));
      add(key + 'description', maxLength(e.description, LIMITS.text));
    });

    each('certifications', function (e, key) {
      add(key + 'name', required(e.name, 'Certification name') || maxLength(e.name, LIMITS.short));
      add(key + 'issuer', maxLength(e.issuer, LIMITS.short));
      add(key + 'date', dateFormat(e.date));
      add(key + 'url', url(e.url) || maxLength(e.url, LIMITS.url));
    });

    each('languages', function (e, key) {
      add(key + 'name', required(e.name, 'Language') || maxLength(e.name, LIMITS.short));
      add(key + 'level', maxLength(e.level, LIMITS.short));
    });

    return { errors: errors, count: Object.keys(errors).length, firstKey: firstKey };
  }

  LuxCV.Validation = {
    LIMITS: LIMITS,
    required: required,
    email: email,
    phone: phone,
    url: url,
    linkedin: linkedin,
    normalizeUrl: normalizeUrl,
    maxLength: maxLength,
    parseDate: parseDate,
    dateFormat: dateFormat,
    dateOrder: dateOrder,
    validateResume: validateResume
  };
})();
