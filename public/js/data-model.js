/* ==========================================================================
   LUXCV - data-model.js
   Template catalogue and the resume data shape. Pure data, no DOM access.
   All modules share one namespace: window.LuxCV.

   Each template entry is metadata only. template-renderer.js reads it to
   build the markup and templates.css skins it, so adding a template means
   adding one entry here, one sample in sample-data.js and one skin block in
   templates.css.
   ========================================================================== */
(function () {
  'use strict';

  var LuxCV = (window.LuxCV = window.LuxCV || {});

  var SCHEMA_VERSION = 4;

  /* Filter chips shown in the gallery. A template may belong to several. */
  var CATEGORIES = [
    { id: 'all', label: 'All' },
    { id: 'professional', label: 'Professional' },
    { id: 'modern', label: 'Modern' },
    { id: 'minimal', label: 'Minimal' },
    { id: 'creative', label: 'Creative' },
    { id: 'tech', label: 'Tech' },
    { id: 'student', label: 'Student' },
    { id: 'ats', label: 'ATS-friendly' }
  ];

  /* Section ids understood by the renderer:
       summary, experience, education, skills, projects, languages, contact
     `sections.main` / `sections.side` set which section goes in which
     column and in what order. `contact` listed in a column puts contact
     details there; otherwise they sit in the header.
     `headings` overrides the default section titles.
     `skillStyle`: chips | inline | list | columns | grouped. */
  var TEMPLATES = [
    {
      id: 'executive-gold',
      name: 'Executive Gold',
      category: 'Professional',
      categories: ['professional'],
      tags: ['Executive', 'Single column'],
      description: 'A refined single-column layout with a centred header and fine gold detailing.',
      bestFor: 'Senior leadership, director and board-level roles.',
      sections: {
        main: ['summary', 'experience', 'education', 'skills', 'languages'],
        side: []
      },
      headings: { summary: 'Executive Profile', experience: 'Professional Experience' },
      skillStyle: 'inline'
    },
    {
      id: 'modern-professional',
      name: 'Modern Professional',
      category: 'Modern',
      categories: ['modern', 'professional'],
      tags: ['Modern', 'Two column'],
      description: 'A contemporary two-column layout with a full-height sidebar for contact details and skills.',
      bestFor: 'Product, design, marketing and consulting roles.',
      sections: {
        main: ['summary', 'experience', 'education'],
        side: ['contact', 'skills', 'languages']
      },
      headings: {},
      skillStyle: 'chips'
    },
    {
      id: 'minimalist-white',
      name: 'Minimalist White',
      category: 'Minimal',
      categories: ['minimal', 'ats'],
      tags: ['Minimal', 'Single column'],
      description: 'Clean and quiet, with generous whitespace and section titles set in a slim margin.',
      bestFor: 'Any role where clarity matters more than decoration.',
      sections: {
        main: ['summary', 'experience', 'education', 'skills', 'languages'],
        side: []
      },
      headings: {},
      skillStyle: 'inline'
    },
    {
      id: 'creative-portfolio',
      name: 'Creative Portfolio',
      category: 'Creative',
      categories: ['creative', 'modern'],
      tags: ['Creative', 'Portfolio'],
      description: 'Distinctive typography, numbered sections and a portfolio grid that puts your best work first.',
      bestFor: 'Designers, art directors, writers and other makers.',
      sections: {
        main: ['summary', 'projects', 'experience'],
        side: ['contact', 'skills', 'education', 'languages']
      },
      headings: { summary: 'About', projects: 'Selected Work' },
      skillStyle: 'chips'
    },
    {
      id: 'corporate-classic',
      name: 'Corporate Classic',
      category: 'Professional',
      categories: ['professional', 'ats'],
      tags: ['Traditional', 'Single column'],
      description: 'A traditional serif layout with ruled headings, familiar to hiring managers in every industry.',
      bestFor: 'Finance, law, government and established corporations.',
      sections: {
        main: ['summary', 'experience', 'education', 'skills', 'languages'],
        side: []
      },
      headings: { summary: 'Professional Summary', experience: 'Professional Experience' },
      skillStyle: 'inline'
    },
    {
      id: 'tech-specialist',
      name: 'Tech Specialist',
      category: 'Tech',
      categories: ['tech', 'modern'],
      tags: ['Technical', 'Projects'],
      description: 'Leads with a grouped technical-skills panel, then projects and the technologies behind them.',
      bestFor: 'Software, data, DevOps and other engineering roles.',
      sections: {
        main: ['summary', 'skills', 'projects', 'experience', 'education', 'languages'],
        side: []
      },
      headings: { skills: 'Technical Skills' },
      skillStyle: 'grouped'
    },
    {
      id: 'student-graduate',
      name: 'Student & Graduate',
      category: 'Student',
      categories: ['student'],
      tags: ['Education first', 'Coursework'],
      description: 'Puts education, coursework and academic projects ahead of work history.',
      bestFor: 'Students, graduates and early-career applicants.',
      sections: {
        main: ['summary', 'education', 'projects', 'experience'],
        side: ['skills', 'languages']
      },
      headings: { summary: 'Objective', projects: 'Academic Projects' },
      skillStyle: 'list'
    },
    {
      id: 'elegant-serif',
      name: 'Elegant Serif',
      category: 'Minimal',
      categories: ['minimal', 'creative'],
      tags: ['Editorial', 'Serif'],
      description: 'Editorial typography with a drop-cap profile, italic headings and unhurried spacing.',
      bestFor: 'Publishing, academia, communications and the arts.',
      sections: {
        main: ['summary', 'experience', 'education', 'skills', 'languages'],
        side: []
      },
      headings: { summary: 'Profile' },
      skillStyle: 'columns'
    },
    {
      id: 'compact-ats',
      name: 'Compact ATS-Friendly',
      category: 'ATS-friendly',
      categories: ['ats', 'professional'],
      tags: ['ATS-friendly', 'Compact'],
      description: 'Plain, dense and predictable: conventional headings and a single column that parsers read cleanly.',
      bestFor: 'Online applications screened by applicant-tracking systems.',
      sections: {
        main: ['summary', 'experience', 'education', 'skills', 'projects', 'languages'],
        side: []
      },
      headings: {
        summary: 'Professional Summary',
        experience: 'Work Experience'
      },
      skillStyle: 'inline',
      photo: false,
      accent: false
    },
    {
      id: 'midnight-premium',
      name: 'Midnight Premium',
      category: 'Modern',
      categories: ['modern', 'creative'],
      tags: ['Dark', 'Premium'],
      description: 'A sophisticated dark layout with gold accents, built for impact on screen.',
      bestFor: 'Leadership, strategy and brand-conscious roles.',
      printNote: 'Dark on screen. When printed or saved as PDF it switches to a light, ink-friendly version automatically.',
      sections: {
        main: ['summary', 'experience', 'education'],
        side: ['contact', 'skills', 'languages']
      },
      headings: {},
      skillStyle: 'chips'
    }
  ];

  var DEFAULT_TEMPLATE_ID = TEMPLATES[0].id;

  /* Template ids used in Part 1 map onto their closest Part 2 design, so a
     saved choice or an old bookmark still resolves. */
  var LEGACY_IDS = {
    aurelia: 'executive-gold',
    meridian: 'modern-professional',
    onyx: 'midnight-premium',
    ivory: 'minimalist-white',
    sterling: 'corporate-classic',
    solstice: 'creative-portfolio'
  };

  function findById(id) {
    for (var i = 0; i < TEMPLATES.length; i += 1) {
      if (TEMPLATES[i].id === id) {
        return TEMPLATES[i];
      }
    }
    return null;
  }

  /* Returns the canonical template id for any known id, alias or
     differently-cased value, or null when it is unknown. */
  function resolveTemplateId(value) {
    if (typeof value !== 'string') {
      return null;
    }
    var id = value.trim().toLowerCase();
    if (findById(id)) {
      return id;
    }
    return Object.prototype.hasOwnProperty.call(LEGACY_IDS, id) ? LEGACY_IDS[id] : null;
  }

  function getTemplate(id) {
    var resolved = resolveTemplateId(id);
    return resolved ? findById(resolved) : null;
  }

  function isValidTemplateId(id) {
    return resolveTemplateId(id) !== null;
  }

  function getTemplatesByCategory(categoryId) {
    if (!categoryId || categoryId === 'all') {
      return TEMPLATES.slice();
    }
    return TEMPLATES.filter(function (template) {
      return template.categories.indexOf(categoryId) !== -1;
    });
  }

  function isValidCategory(id) {
    return CATEGORIES.some(function (category) {
      return category.id === id;
    });
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* Stable ids for repeated entries. The counter guarantees uniqueness inside
     a session; ids only ever contain letters, digits, "-" and "_" so they are
     safe in DOM ids and in dotted error keys such as "experience.<id>.role". */
  var idCounter = 0;

  function newId(prefix) {
    idCounter += 1;
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' +
      idCounter.toString(36) + Math.random().toString(36).slice(2, 5);
  }

  /* ---------- appearance settings ----------
     Settings are part of the resume (they travel with the draft) but are
     separate from the content and from the template definitions.
       accent:   '' = the template's own colour, or a #rrggbb colour
       fontSize: 'sm' | 'md' | 'lg'  (scales all resume text; see FONT_SIZES) */
  var FONT_SIZES = [
    { id: 'sm', label: 'Small', scale: 0.92 },
    { id: 'md', label: 'Medium', scale: 1 },
    { id: 'lg', label: 'Large', scale: 1.08 }
  ];

  /* Curated accents that stay readable on white paper (contrast 4.5:1 or better). */
  var ACCENTS = [
    { id: 'gold', label: 'Antique gold', value: '#8c6a1f' },
    { id: 'navy', label: 'Navy', value: '#1f4e8c' },
    { id: 'teal', label: 'Teal', value: '#0b7d78' },
    { id: 'emerald', label: 'Emerald', value: '#2c7a4b' },
    { id: 'burgundy', label: 'Burgundy', value: '#7b2d3b' },
    { id: 'vermilion', label: 'Vermilion', value: '#b8431f' },
    { id: 'violet', label: 'Violet', value: '#5b3fa0' },
    { id: 'slate', label: 'Slate', value: '#3e4756' }
  ];

  function isValidAccent(value) {
    return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
  }

  function isValidFontSize(value) {
    return FONT_SIZES.some(function (size) { return size.id === value; });
  }

  function getFontScale(id) {
    var match = FONT_SIZES.filter(function (size) { return size.id === id; })[0];
    return match ? match.scale : 1;
  }

  function createSettings() {
    return { accent: '', fontSize: 'md' };
  }

  function cleanSettings(raw) {
    var source = raw && typeof raw === 'object' ? raw : {};
    return {
      accent: isValidAccent(source.accent) ? source.accent.toLowerCase() : '',
      fontSize: isValidFontSize(source.fontSize) ? source.fontSize : 'md'
    };
  }

  /* Content is stored separately from design, so changing the template
     never touches the user's words.

     personal:         { fullName, jobTitle, email, phone, location,
                         linkedin, website, photo }
     experience[]:     { id, role, company, location, start, end, current, highlights[] }
     education[]:      { id, degree, school, field, location, start, end, details, coursework[] }
     skills[]:         { id, name, group }              (group is optional)
     projects[]:       { id, name, link, description, technologies[] }
     certifications[]: { id, name, issuer, date, url }
     languages[]:      { id, name, level }

     Dates are free text ("Jun 2022", "2022", "06/2022"); validation.js checks
     the format. `photo` is a small JPEG/PNG/WebP data URL or ''. */
  function createEmptyResume() {
    return {
      schemaVersion: SCHEMA_VERSION,
      templateId: DEFAULT_TEMPLATE_ID,
      personal: {
        fullName: '',
        jobTitle: '',
        email: '',
        phone: '',
        location: '',
        linkedin: '',
        website: '',
        photo: ''
      },
      summary: '',
      experience: [],
      education: [],
      skills: [],
      projects: [],
      certifications: [],
      languages: [],
      settings: createSettings()
    };
  }

  /* ---------- entry factories (each call returns a new, empty entry) ---------- */

  function createExperience() {
    return {
      id: newId('exp'),
      role: '',
      company: '',
      location: '',
      start: '',
      end: '',
      current: false,
      highlights: []
    };
  }

  function createEducation() {
    return {
      id: newId('edu'),
      degree: '',
      school: '',
      field: '',
      location: '',
      start: '',
      end: '',
      details: '',
      coursework: []
    };
  }

  function createSkill(name, group) {
    return { id: newId('skl'), name: name || '', group: group || '' };
  }

  function createProject() {
    return { id: newId('prj'), name: '', link: '', description: '', technologies: [] };
  }

  function createCertification() {
    return { id: newId('crt'), name: '', issuer: '', date: '', url: '' };
  }

  function createLanguage() {
    return { id: newId('lng'), name: '', level: '' };
  }

  var LIST_TYPES = ['experience', 'education', 'skills', 'projects', 'certifications', 'languages'];

  var FACTORIES = {
    experience: createExperience,
    education: createEducation,
    skills: createSkill,
    projects: createProject,
    certifications: createCertification,
    languages: createLanguage
  };

  /* True when an entry holds any user text or list item. Ids and the
     "current position" flag do not count, so a freshly added entry is "empty"
     and is not validated until the user starts filling it in. */
  function entryHasContent(entry) {
    if (!entry || typeof entry !== 'object') {
      return false;
    }
    return Object.keys(entry).some(function (key) {
      var value = entry[key];
      if (key === 'id') {
        return false;
      }
      if (typeof value === 'string') {
        return value.trim() !== '';
      }
      return Array.isArray(value) && value.length > 0;
    });
  }

  /* Profile photos are stored as small data URLs made by the editor. */
  var PHOTO_PATTERN = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
  /* A 360 x 360 JPEG data URL is normally 40-90 KB of text. Anything above this
     limit (about 190 KB of image data) is never stored. */
  var PHOTO_MAX_LENGTH = 260000;

  function isPhotoData(value) {
    return typeof value === 'string' && value.length <= PHOTO_MAX_LENGTH && PHOTO_PATTERN.test(value);
  }

  /* Gives every entry a unique, safe id (adds missing ones, replaces
     duplicates or odd values). Mutates and returns the resume. */
  function ensureIds(resume) {
    var seen = {};
    LIST_TYPES.forEach(function (type) {
      list(resume[type]).forEach(function (item) {
        if (!item || typeof item !== 'object') {
          return;
        }
        if (typeof item.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(item.id) || seen[item.id]) {
          item.id = newId(type.slice(0, 3));
        }
        seen[item.id] = true;
      });
    });
    return resume;
  }

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  /* Forces a value to the type of the matching default. */
  function coerce(defaultValue, value) {
    if (typeof defaultValue === 'string') {
      if (typeof value === 'string') {
        return value;
      }
      return typeof value === 'number' ? String(value) : '';
    }
    if (typeof defaultValue === 'boolean') {
      return value === true;
    }
    if (Array.isArray(defaultValue)) {
      return Array.isArray(value)
        ? value.filter(function (item) { return typeof item === 'string'; })
        : [];
    }
    return defaultValue;
  }

  function sanitizeEntry(template, raw) {
    var source = raw && typeof raw === 'object' ? raw : {};
    var out = {};
    Object.keys(template).forEach(function (key) {
      out[key] = coerce(template[key], source[key]);
    });
    return out;
  }

  /* Builds a clean, current-version resume from anything that was read back
     from storage or an older version of the app: unknown keys are dropped,
     every field is forced to its expected type, strings become skill and
     language entries, and every entry gets a stable id. The input is never
     modified. */
  function migrateResume(raw) {
    var source = raw && typeof raw === 'object' ? raw : {};
    var base = createEmptyResume();
    var personalSource = source.personal && typeof source.personal === 'object' ? source.personal : {};

    var out = {
      schemaVersion: SCHEMA_VERSION,
      templateId: resolveTemplateId(source.templateId) || DEFAULT_TEMPLATE_ID,
      personal: {},
      summary: coerce('', source.summary),
      settings: cleanSettings(source.settings)
    };

    Object.keys(base.personal).forEach(function (key) {
      out.personal[key] = coerce('', personalSource[key]);
    });
    if (!isPhotoData(out.personal.photo)) {
      out.personal.photo = '';
    }

    LIST_TYPES.forEach(function (type) {
      var template = FACTORIES[type]();
      out[type] = list(source[type]).map(function (item) {
        if (typeof item === 'string') {
          item = { name: item };
        }
        return sanitizeEntry(template, item);
      });
    });

    return ensureIds(out);
  }

  /* Returns a complete resume object: missing sections become empty arrays
     and missing personal fields become empty strings. Never mutates input. */
  function normalizeResume(resume) {
    var base = createEmptyResume();
    var source = resume && typeof resume === 'object' ? resume : {};
    var out = {};

    Object.keys(base).forEach(function (key) {
      var fallback = base[key];
      var value = source[key];

      if (Array.isArray(fallback)) {
        out[key] = Array.isArray(value) ? value : [];
      } else if (fallback && typeof fallback === 'object') {
        out[key] = Object.assign({}, fallback, value && typeof value === 'object' ? value : {});
      } else {
        out[key] = value === undefined || value === null ? fallback : value;
      }
    });

    out.settings = cleanSettings(out.settings);
    return out;
  }

  LuxCV.Data = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    CATEGORIES: CATEGORIES,
    TEMPLATES: TEMPLATES,
    DEFAULT_TEMPLATE_ID: DEFAULT_TEMPLATE_ID,
    LIST_TYPES: LIST_TYPES,
    FONT_SIZES: FONT_SIZES,
    ACCENTS: ACCENTS,
    PHOTO_MAX_LENGTH: PHOTO_MAX_LENGTH,
    isValidAccent: isValidAccent,
    isValidFontSize: isValidFontSize,
    getFontScale: getFontScale,
    createSettings: createSettings,
    cleanSettings: cleanSettings,
    resolveTemplateId: resolveTemplateId,
    getTemplate: getTemplate,
    isValidTemplateId: isValidTemplateId,
    getTemplatesByCategory: getTemplatesByCategory,
    isValidCategory: isValidCategory,
    uid: uid,
    newId: newId,
    createEmptyResume: createEmptyResume,
    createExperience: createExperience,
    createEducation: createEducation,
    createSkill: createSkill,
    createProject: createProject,
    createCertification: createCertification,
    createLanguage: createLanguage,
    entryHasContent: entryHasContent,
    isPhotoData: isPhotoData,
    ensureIds: ensureIds,
    migrateResume: migrateResume,
    normalizeResume: normalizeResume
  };
})();
