/* ==========================================================================
   LUXCV - sample-data.js
   Fictional example resumes used for template previews (gallery, modal and
   the builder's template card). One persona per template, written to suit
   that template's strengths. All names, companies and contact details are
   invented. Loaded after data-model.js.
   ========================================================================== */
(function () {
  'use strict';

  var LuxCV = (window.LuxCV = window.LuxCV || {});
  var counter = 0;

  function nextId(prefix) {
    counter += 1;
    return prefix + '-' + counter;
  }

  function person(fullName, jobTitle, email, phone, location, website) {
    return {
      fullName: fullName,
      jobTitle: jobTitle,
      email: email,
      phone: phone,
      location: location,
      website: website
    };
  }

  function job(role, company, location, start, end, highlights) {
    return {
      id: nextId('exp'),
      role: role,
      company: company,
      location: location,
      start: start,
      end: end,
      current: end === 'Present',
      highlights: highlights || []
    };
  }

  function study(degree, school, location, start, end, details, coursework) {
    return {
      id: nextId('edu'),
      degree: degree,
      school: school,
      location: location,
      start: start,
      end: end,
      details: details || '',
      coursework: coursework || []
    };
  }

  function project(name, link, description, technologies) {
    return {
      id: nextId('prj'),
      name: name,
      link: link,
      description: description,
      technologies: technologies || []
    };
  }

  /* skills ---------------------------------------------------------------- */
  function flat(names) {
    return names.map(function (name) {
      return { name: name };
    });
  }

  function grouped(map) {
    var out = [];
    Object.keys(map).forEach(function (group) {
      map[group].forEach(function (name) {
        out.push({ name: name, group: group });
      });
    });
    return out;
  }

  function langs(pairs) {
    return pairs.map(function (pair) {
      return { name: pair[0], level: pair[1] };
    });
  }

  function build(personal, summary, parts) {
    return {
      schemaVersion: LuxCV.Data ? LuxCV.Data.SCHEMA_VERSION : 2,
      templateId: '',
      personal: personal,
      summary: summary,
      experience: parts.experience || [],
      education: parts.education || [],
      skills: parts.skills || [],
      projects: parts.projects || [],
      languages: parts.languages || []
    };
  }

  var SAMPLES = {};

  /* 1 ── Executive Gold ──────────────────────────────────────────────────── */
  SAMPLES['executive-gold'] = build(
    person('Alexander Whitmore', 'Chief Operating Officer', 'alexander.whitmore@example.com', '+1 (415) 555-0142', 'San Francisco, CA', 'linkedin.com/in/awhitmore'),
    'Operations executive with 18 years of experience scaling logistics and technology businesses from $40M to $600M. Known for building disciplined leadership teams, lifting margins without sacrificing service, and guiding companies through complex growth and integration.',
    {
      experience: [
        job('Chief Operating Officer', 'Harbor & Pine Logistics', 'San Francisco, CA', '2019', 'Present', [
          'Lead 1,400 employees across 12 facilities; improved operating margin by 11 points in 24 months.',
          'Directed the integration of three acquisitions while retaining 94% of key talent.',
          'Introduced a quarterly operating review that cut annual planning cycles by 30%.',
          'Established an executive development programme now used across all 12 sites.'
        ]),
        job('Vice President, Operations', 'Meridian Freight Group', 'Chicago, IL', '2014', '2019', [
          'Redesigned the national network, reducing delivery costs by $18M a year.',
          'Built a regional leadership bench and promoted nine directors from within.'
        ]),
        job('Director of Strategy', 'Alder & Co.', 'Chicago, IL', '2008', '2014', [
          'Advised the executive team on market entry, pricing and capital allocation.',
          'Led the strategic review that shaped a three-year, $120M investment plan.'
        ])
      ],
      education: [
        study('MBA, General Management', 'Northbridge School of Business', 'Boston, MA', '2006', '2008'),
        study('BSc, Industrial Engineering', 'Lakeview University', 'Madison, WI', '2000', '2004')
      ],
      skills: flat(['P&L Management', 'Strategic Planning', 'M&A Integration', 'Operational Excellence', 'Board Reporting', 'Talent Development']),
      languages: langs([['English', 'Native'], ['Spanish', 'Professional']])
    }
  );

  /* 2 ── Modern Professional ─────────────────────────────────────────────── */
  SAMPLES['modern-professional'] = build(
    person('Priya Nair', 'Senior Product Manager', 'priya.nair@example.com', '+44 20 7946 0958', 'London, UK', 'priyanair.example.com'),
    'Product manager with nine years of experience turning customer insight into products people use every day. Equally comfortable shaping strategy and unblocking delivery, with a passion for clear writing, measurable outcomes and inclusive design.',
    {
      experience: [
        job('Senior Product Manager', 'Brightwater Payments', 'London, UK', '2020', 'Present', [
          'Own the merchant onboarding roadmap, growing activation from 41% to 63%.',
          'Led a cross-functional team of 14 to launch instant payouts in six markets.',
          'Introduced opportunity-solution trees, shortening discovery cycles by a third.'
        ]),
        job('Product Manager', 'Lumen Health', 'London, UK', '2016', '2020', [
          'Shipped a patient booking flow used by 2.3 million people a year.',
          'Partnered with research to cut appointment no-shows by 18%.',
          'Introduced a quarterly advisory panel of 20 patients and clinicians.'
        ]),
        job('Associate Product Manager', 'Fieldnote Software', 'Manchester, UK', '2014', '2016', [
          'Managed the backlog for a note-taking app with 400,000 monthly users.',
          'Ran weekly usability sessions that informed a complete onboarding redesign.'
        ])
      ],
      education: [
        study('MSc, Management', 'Riverside University', 'London, UK', '2012', '2014'),
        study('BA, Economics', 'Kingsbridge University', 'Leeds, UK', '2009', '2012')
      ],
      skills: flat(['Roadmapping', 'User research', 'A/B testing', 'SQL', 'Stakeholder management', 'Agile delivery', 'Figma']),
      languages: langs([['English', 'Native'], ['Hindi', 'Fluent'], ['French', 'Conversational']])
    }
  );

  /* 3 ── Minimalist White ────────────────────────────────────────────────── */
  SAMPLES['minimalist-white'] = build(
    person('Daniel Ortega', 'UX Researcher', 'daniel.ortega@example.com', '+34 600 123 456', 'Madrid, Spain', 'danielortega.example.com'),
    'UX researcher who helps teams understand people before they build for them. I favour small, fast studies, plain-language findings and recommendations that product teams can act on the same week.',
    {
      experience: [
        job('Senior UX Researcher', 'Calle Mayor Labs', 'Madrid, Spain', '2021', 'Present', [
          'Run generative and evaluative research for a banking app used by 1.8 million customers.',
          'Built a research repository that cut duplicate studies by 40%.'
        ]),
        job('UX Researcher', 'Tinta Digital', 'Barcelona, Spain', '2017', '2021', [
          'Conducted over 200 usability sessions across retail, travel and media clients.',
          'Taught a monthly interviewing workshop to designers and product managers.'
        ]),
        job('Research Assistant', 'University of Valencia', 'Valencia, Spain', '2015', '2017', [
          'Supported human-computer interaction studies on accessibility in public services.'
        ])
      ],
      education: [
        study('MSc, Human-Computer Interaction', 'University of Valencia', 'Valencia, Spain', '2013', '2015'),
        study('BA, Psychology', 'Complutense Institute', 'Madrid, Spain', '2009', '2013')
      ],
      skills: flat(['User interviews', 'Usability testing', 'Survey design', 'Synthesis', 'Journey mapping', 'Dovetail', 'Figma']),
      languages: langs([['Spanish', 'Native'], ['English', 'Fluent'], ['Catalan', 'Intermediate']])
    }
  );

  /* 4 ── Creative Portfolio ──────────────────────────────────────────────── */
  SAMPLES['creative-portfolio'] = build(
    person('Maya Lindqvist', 'Art Director', 'maya@example.com', '+46 70 123 45 67', 'Stockholm, Sweden', 'mayalindqvist.example.com'),
    'Art director who builds brands with a strong point of view, from the first sketch to the last shelf. I like warm colour, honest typography and ideas simple enough to explain in a sentence.',
    {
      projects: [
        project('Nordlys Tea Rebrand', 'nordlys.example.com', 'Identity and packaging for a Nordic tea house; shelf visibility doubled in the launch quarter.', ['Identity', 'Packaging']),
        project('Tidvatten Festival', 'tidvatten.example.com', 'Campaign, wayfinding and merchandise for a 12,000-person coastal music festival.', ['Campaign', 'Wayfinding']),
        project('Kvist Magazine', 'kvist.example.com', 'Editorial redesign that lifted subscriptions by 22% in the first year.', ['Editorial', 'Typography']),
        project('Sol & Salt', 'solsalt.example.com', 'Brand and e-commerce site for a small-batch seasoning company.', ['Web', 'Brand'])
      ],
      experience: [
        job('Art Director', 'Studio Fjord', 'Stockholm, Sweden', '2020', 'Present', [
          'Lead a team of five designers and two motion artists on brand and campaign work.',
          'Won two regional design awards for packaging and identity.',
          'Present creative direction to clients and run weekly design critiques.'
        ]),
        job('Senior Designer', 'Halo & Birch', 'Gothenburg, Sweden', '2016', '2020', [
          'Designed identity systems for 30+ start-ups and cultural organisations.',
          'Mentored four junior designers, two of whom were promoted within a year.'
        ])
      ],
      education: [
        study('BFA, Graphic Design', 'Nordic Academy of Design', 'Stockholm, Sweden', '2012', '2016')
      ],
      skills: flat(['Art direction', 'Brand identity', 'Typography', 'Packaging', 'Motion', 'Photography', 'Figma', 'After Effects']),
      languages: langs([['Swedish', 'Native'], ['English', 'Fluent']])
    }
  );

  /* 5 ── Corporate Classic ───────────────────────────────────────────────── */
  SAMPLES['corporate-classic'] = build(
    person('Robert Hale', 'Senior Financial Analyst', 'robert.hale@example.com', '(312) 555-0176', 'Chicago, IL', 'linkedin.com/in/roberthale-fp'),
    'Chartered financial analyst with ten years of experience in corporate finance, forecasting and variance analysis. Trusted by senior leadership for accurate, timely reporting and for turning complex numbers into clear recommendations.',
    {
      experience: [
        job('Senior Financial Analyst', 'Crestline Industries', 'Chicago, IL', '2018', 'Present', [
          'Prepare monthly forecasts and board reporting for a $900M manufacturing division.',
          'Rebuilt the budgeting model, reducing the annual planning cycle from 10 weeks to 6.',
          'Identified $4.2M of recurring cost savings through supplier variance analysis.',
          'Present quarterly results and risk scenarios to the divisional leadership team.'
        ]),
        job('Financial Analyst', 'Union Standard Bank', 'Chicago, IL', '2014', '2018', [
          'Supported commercial lending with credit analysis and portfolio reviews.',
          'Automated quarterly reporting in Excel and VBA, saving 60 analyst hours a quarter.'
        ]),
        job('Audit Associate', 'Hartwell & Moore LLP', 'Chicago, IL', '2012', '2014', [
          'Performed audit fieldwork for mid-market clients in manufacturing and retail.',
          'Drafted management letters recommending control improvements.'
        ])
      ],
      education: [
        study('MBA, Finance', 'Great Lakes University', 'Chicago, IL', '2012', '2014'),
        study('BS, Accounting', 'Midwest State University', 'Columbus, OH', '2008', '2012')
      ],
      skills: flat(['Financial modelling', 'Variance analysis', 'Forecasting', 'Excel and VBA', 'SAP', 'Hyperion', 'Board reporting']),
      languages: langs([['English', 'Native']])
    }
  );

  /* 6 ── Tech Specialist ─────────────────────────────────────────────────── */
  SAMPLES['tech-specialist'] = build(
    person('Kenji Sato', 'Senior Software Engineer', 'kenji.sato@example.com', '+81 90 5555 0123', 'Osaka, Japan', 'github.com/kenji-sato-dev'),
    'Backend-leaning engineer with eight years of experience building reliable, observable distributed systems. Enjoy API design, performance work and mentoring, and contribute to open-source tooling in my spare time.',
    {
      skills: grouped({
        Languages: ['Go', 'TypeScript', 'Python', 'SQL'],
        Infrastructure: ['Kubernetes', 'Terraform', 'AWS', 'Docker'],
        'Data and messaging': ['PostgreSQL', 'Redis', 'Kafka'],
        Practices: ['gRPC', 'CI/CD', 'Observability']
      }),
      projects: [
        project('stream-ledger', 'github.com/kenji-sato-dev/stream-ledger', 'Open-source event store with exactly-once delivery; 2.1k GitHub stars and 40 contributors.', ['Go', 'PostgreSQL', 'gRPC']),
        project('pipewatch', 'github.com/kenji-sato-dev/pipewatch', 'Command-line tool that traces CI pipeline bottlenecks and posts weekly summaries.', ['Python', 'GitHub API'])
      ],
      experience: [
        job('Senior Software Engineer', 'Nimbus Cloud', 'Osaka, Japan', '2020', 'Present', [
          'Designed an event-driven billing pipeline processing 90M events a day at p99 under 200 ms.',
          'Cut infrastructure spend by 28% by right-sizing Kubernetes workloads.',
          'Mentor six engineers; run the team’s on-call and incident review process.'
        ]),
        job('Software Engineer', 'Pixelforge Games', 'Kyoto, Japan', '2016', '2020', [
          'Built matchmaking and leaderboard services for a title with 3M monthly players.'
        ])
      ],
      education: [
        study('BEng, Information Science', 'Kansai Institute of Technology', 'Osaka, Japan', '2012', '2016')
      ],
      languages: langs([['Japanese', 'Native'], ['English', 'Fluent']])
    }
  );

  /* 7 ── Student & Graduate ──────────────────────────────────────────────── */
  SAMPLES['student-graduate'] = build(
    person('Sofia Martins', 'Computer Science Graduate', 'sofia.martins@example.com', '+351 912 345 678', 'Lisbon, Portugal', 'github.com/sofia-martins-cs'),
    'Recently graduated computer science student seeking a junior software role. Strong foundations in algorithms and databases, hands-on experience from team projects and an internship, and a keen interest in accessible, well-tested software.',
    {
      education: [
        study('BSc, Computer Science', 'Atlantic University', 'Lisbon, Portugal', '2022', '2026', 'GPA 3.8 / 4.0 · Dean’s List for four semesters. Thesis on energy-aware task scheduling.', [
          'Data Structures', 'Algorithms', 'Databases', 'Operating Systems', 'Machine Learning', 'Human-Computer Interaction'
        ])
      ],
      projects: [
        project('Campus Carpool', '', 'Team of four built a web app matching 600 students to shared rides; won the university innovation prize.', ['Python', 'Django', 'PostgreSQL']),
        project('Library Seat Tracker', '', 'Course project: live seat availability using sensor data and a React dashboard.', ['JavaScript', 'React']),
        project('Thesis: Energy-aware scheduling', '', 'Simulated scheduling policies that cut server energy use by 12% on benchmark workloads.', ['Java', 'Research'])
      ],
      experience: [
        job('Software Engineering Intern', 'Brightside Software', 'Lisbon, Portugal', 'Jun 2025', 'Sep 2025', [
          'Built reporting endpoints and wrote 80+ unit tests for an internal analytics service.'
        ]),
        job('Teaching Assistant, Programming I', 'Atlantic University', 'Lisbon, Portugal', '2024', '2025', [
          'Ran weekly labs for 35 first-year students and graded assignments.'
        ])
      ],
      skills: flat(['Python', 'Java', 'JavaScript', 'SQL', 'Git', 'HTML and CSS']),
      languages: langs([['Portuguese', 'Native'], ['English', 'C1'], ['Spanish', 'B1']])
    }
  );

  /* 8 ── Elegant Serif ───────────────────────────────────────────────────── */
  SAMPLES['elegant-serif'] = build(
    person('Eleanor Vance', 'Editorial Director', 'eleanor.vance@example.com', '+44 117 496 0123', 'Bristol, UK', 'evance.example.com'),
    'Editor and writer with fifteen years in literary publishing, committed to sharpening ideas and giving new voices room to be heard. I have shaped award-winning essays, built editorial teams and steered a quarterly review from print into a thriving digital readership.',
    {
      experience: [
        job('Editorial Director', 'The Larkspur Review', 'Bristol, UK', '2018', 'Present', [
          'Commission and edit long-form essays, fiction and criticism for a quarterly of 38,000 readers.',
          'Grew digital subscribers from 4,000 to 15,000 through a redesigned editorial calendar.'
        ]),
        job('Senior Editor', 'Fenwick & Gray Publishing', 'London, UK', '2012', '2018', [
          'Acquired and edited twenty-two non-fiction titles, three of them prize-listed.',
          'Mentored junior editors and led the house style guide revision.'
        ]),
        job('Editorial Assistant', 'Marlowe Books', 'London, UK', '2009', '2012', [
          'Read submissions, prepared manuscripts and coordinated production schedules.'
        ])
      ],
      education: [
        study('MA, English Literature', 'Wexford College', 'Oxford, UK', '2008', '2009'),
        study('BA, English and History', 'Cotswold University', 'Gloucester, UK', '2005', '2008')
      ],
      skills: flat(['Developmental editing', 'Content strategy', 'Long-form writing', 'Team leadership', 'Rights and permissions', 'Style guides', 'Publishing workflows', 'Public speaking', 'Budgeting']),
      languages: langs([['English', 'Native'], ['French', 'Fluent']])
    }
  );

  /* 9 ── Compact ATS-Friendly ────────────────────────────────────────────── */
  SAMPLES['compact-ats'] = build(
    person('Marcus Reed', 'Operations Project Manager', 'marcus.reed@example.com', '(512) 555-0189', 'Austin, TX', 'linkedin.com/in/marcusreed-pm'),
    'PMP-certified project manager with eight years of experience delivering operations and process-improvement programs in manufacturing and logistics. Skilled at aligning stakeholders, controlling budgets and delivering on schedule.',
    {
      experience: [
        job('Operations Project Manager', 'Lone Star Distribution', 'Austin, TX', '2019', 'Present', [
          'Manage a portfolio of 12 concurrent projects with a combined budget of $7.5M.',
          'Implemented warehouse slotting improvements that raised throughput by 19%.',
          'Reduced vendor onboarding time from 45 days to 20 through process redesign.',
          'Present monthly status, risk and budget reports to the VP of Operations.'
        ]),
        job('Project Coordinator', 'Capitol Manufacturing', 'Austin, TX', '2016', '2019', [
          'Coordinated plant expansion projects across engineering, safety and procurement.',
          'Tracked schedules and costs in MS Project, reporting weekly to the plant director.',
          'Facilitated Lean workshops that eliminated $650K in annual waste.'
        ]),
        job('Logistics Analyst', 'Gulf Coast Freight', 'Houston, TX', '2014', '2016', [
          'Analysed carrier performance data and negotiated rate improvements worth $310K a year.',
          'Built weekly dashboards in SQL and Excel tracking on-time delivery across 40 lanes.',
          'Resolved carrier billing disputes, recovering $85K in overcharges.'
        ])
      ],
      education: [
        study('BS, Industrial Management', 'Texas Valley University', 'San Antonio, TX', '2010', '2014'),
        study('Project Management Professional (PMP)', 'Project Management Institute', '', '2018', '2018')
      ],
      skills: flat(['Project management', 'Budgeting', 'Lean Six Sigma', 'Risk management', 'MS Project', 'Smartsheet', 'SQL', 'Vendor management']),
      projects: [
        project('ERP rollout', '', 'Led warehouse module deployment for four sites with zero unplanned downtime.', ['SAP', 'Change management']),
        project('Warehouse automation pilot', '', 'Managed vendor selection and a 90-day pilot that cut picking errors by 35%.', ['Process design', 'Vendor management'])
      ],
      languages: langs([['English', 'Native'], ['Spanish', 'Professional']])
    }
  );

  /* 10 ── Midnight Premium ───────────────────────────────────────────────── */
  SAMPLES['midnight-premium'] = build(
    person('Isabelle Laurent', 'Brand Strategy Director', 'isabelle.laurent@example.com', '+33 1 42 68 53 00', 'Paris, France', 'isabellelaurent.example.com'),
    'Brand strategist with twelve years of experience in luxury and lifestyle, translating heritage into modern desire. I lead small, senior teams that connect consumer insight, creative direction and commercial results.',
    {
      experience: [
        job('Brand Strategy Director', 'Maison Éclat', 'Paris, France', '2019', 'Present', [
          'Repositioned a heritage jewellery house, lifting brand consideration by 27% among under-40 buyers.',
          'Lead a team of six strategists across Paris, Milan and New York.',
          'Launched a client-advisory programme that raised repeat purchase by 18%.'
        ]),
        job('Senior Strategist', 'Lumière & Co.', 'Paris, France', '2014', '2019', [
          'Shaped global campaigns for fashion and fragrance clients across 14 markets.',
          'Developed a proprietary desirability index now used across the agency.',
          'Mentored eight strategists, three of whom now lead their own accounts.'
        ]),
        job('Brand Manager', 'Atelier Rivoli', 'Lyon, France', '2011', '2014', [
          'Managed launch of two accessory lines from concept to boutique rollout.',
          'Negotiated artisan partnerships that secured exclusive materials for three seasons.'
        ])
      ],
      education: [
        study('MA, Marketing and Luxury Management', 'Institut Montclair', 'Paris, France', '2009', '2011'),
        study('BA, Business Administration', 'Université de Lyon', 'Lyon, France', '2006', '2009')
      ],
      skills: flat(['Brand architecture', 'Market positioning', 'Consumer insight', 'Luxury retail', 'Creative direction', 'Workshop facilitation']),
      languages: langs([['French', 'Native'], ['English', 'Fluent'], ['Italian', 'Intermediate']])
    }
  );

  /* Returns a fresh deep copy of the sample for a template, with templateId
     set, so callers can mutate it freely. */
  function get(templateId) {
    var Data = LuxCV.Data;
    var id = (Data && Data.resolveTemplateId(templateId)) || (Data && Data.DEFAULT_TEMPLATE_ID);
    var copy = JSON.parse(JSON.stringify(SAMPLES[id] || SAMPLES['executive-gold']));
    copy.templateId = id;
    return copy;
  }

  LuxCV.Samples = {
    get: get
  };
})();
