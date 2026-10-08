import { next } from '@vercel/functions';
import {
  SITE_LOCALES,
  LOCALE_COOKIE,
  decideLocaleRouting,
  localeRedirectTarget,
  localeCookieHeader,
} from './geo-locale.js';

// This middleware does two things, in order:
//   1. THE PRE-LAUNCH GATE (2026-07-12 re-instatement of the
//      sovereignty-review gate): while the site is offline, every request is
//      answered with the coming-soon page unless the browser carries a cookie
//      whose SHA-256 matches REVIEW_KEY_SHA256 — EXCEPT the machine endpoints
//      below, which are served straight through so the published packages
//      (champollion CLI, the mt-eval harness, champollion-mcp-server) work
//      before the human site opens. /robots.txt is one of them: since
//      2026-08-16 (founder call) the gate NO LONGER overrides it with
//      Disallow-all — static/robots.txt, the full launch indexing policy, is
//      served NOW so crawlers discover and schedule the site while the gate
//      is still up. Nothing gets indexed early: every gated page answers with
//      the coming-soon body under `x-robots-tag: noindex, nofollow`.
//      To rotate the key, replace the hash and redeploy.
//      To LAUNCH: delete the four sections marked
//      "PRE-LAUNCH GATE BLOCK (n/4)" below — NOT the whole file (the
//      MACHINE_EXEMPT early-return and the geo-locale defaulting survive
//      launch) — and redeploy. robots.txt does NOT change at launch; what
//      changes is that the pages behind it stop answering noindex.
//      Confirm any time with `curl https://champollion.dev/robots.txt`: it
//      must start with the "launch policy" banner, never "Disallow: /".
//   2. GEO-IP LOCALE DEFAULTING (founder decision 2026-07-18): visitors who
//      pass the gate get the locale of the country their IP is in, not their
//      browser default — see ./geo-locale.js for the full policy.
// NOTE (2026-08-16): the gate page below is the ONLY champollion.dev surface a
// stranger can reach, so it carries the project context and a contact address —
// not just a password box. It went up bare, which read as "members only" for a
// project that intends to be open. If an essay or talk is about to send
// readers here, re-read it first. Two hard rules for this page:
//   1. Language count stays a FLOOR ("7,900+") — this string is hand-maintained
//      HTML inside middleware and cannot do a build-time read, so a floor is
//      the deliberate rot-proofing; never replace it with an exact card count.
//   2. Install lines are allowed NOW and only now because the packages
//      actually shipped (npm champollion + champollion-mcp-server, PyPI
//      mt-eval-harness, 2026-08-27/28). The original rule stands in spirit:
//      never claim anything is published before it is. (2026-08-28: the gate
//      was briefly deleted on a misread of "beta is live"; founder ruling is
//      the gate STAYS through beta — copy updated to "Now in beta" with the
//      install lines, same disclaimer, same key.)
// ── PRE-LAUNCH GATE BLOCK (1/4) — delete at launch ──────────────────────────
const REVIEW_KEY_SHA256 =
  '078d6623fd70ab9000943e0b8d4fc2c92cd3344c24378ed52e1cac809725974c';
const COOKIE_NAME = 'champollion_review_key';
// ── end gate block (1/4) ────────────────────────────────────────────────────

// Machine endpoints exempt from the gate. Each is a generated artifact with
// nothing embargoed in it, fetched by URL from installed tooling. This set
// SURVIVES launch: post-launch it keeps machine fetches out of the geo-locale
// cookie logic entirely (geo-locale would pass them through anyway — this
// makes it structural, not accidental):
//   /queue.json          — the benchmark queue (MCP list_queue, mt-eval queue)
//   /queue-preview.json  — homepage queue teaser (committed fallback)
//   /registry.json       — the dataset registry (mt-eval remote-registry default)
//   /llms.txt, /llms-full.txt — the agent-facing docs index
//   /for-agents.md       — the agent front door as raw markdown (derived from
//                          src/pages/for-agents.md by build-for-agents-md.mjs;
//                          the rendered /for-agents page stays gated)
//   /mesh.json           — the network map artifact (homepage strength arcs)
//   /robots.txt          — the launch indexing policy in static/. Exempt so
//                          the gate cannot answer it with the coming-soon
//                          HTML; survives launch unchanged (founder call
//                          2026-08-16: serve the real policy now)
//   /sitemap.xml         — the URLs crawlers work from; pre-launch they all
//                          resolve to the gate page (noindex), which is the
//                          point: discovery now, indexing at launch. The 12
//                          per-locale sitemaps (/fr/sitemap.xml, …) are
//                          exempt too — robots.txt names all 13, and a gated
//                          one would hand a crawler HTML labelled as XML.
//                          Built from SITE_LOCALES so the list cannot drift.
//   /run_queue           — the one-command queue runner (`curl … | bash`). The
//                          homepage now shows this command verbatim, so gating
//                          it would pipe the coming-soon HTML into a shell.
//                          (/give redirects here — see vercel.json.)
//   /corpus-wishlist.json — the acquisition frontier (ninth principle,
//                          2026-08-27): zero-corpus languages ranked by
//                          cited speaker count, regenerated beside the
//                          queue artifacts (build_corpus_wishlist.py)
const MACHINE_EXEMPT = new Set([
  '/queue.json',
  '/queue-preview.json',
  '/corpus-wishlist.json',
  '/registry.json',
  '/llms.txt',
  '/llms-full.txt',
  '/for-agents.md',
  '/mesh.json',
  '/robots.txt',
  '/sitemap.xml',
  '/run_queue',
  ...SITE_LOCALES.map((l) => `/${l}/sitemap.xml`),
]);

// ── PRE-LAUNCH GATE BLOCK (2/4) — delete at launch (only the gate hashes) ───
async function sha256Hex(text) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
// ── end gate block (2/4) ────────────────────────────────────────────────────

function readCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

export default async function middleware(request) {
  const { pathname } = new URL(request.url);

  if (MACHINE_EXEMPT.has(pathname)) {
    return next();
  }

  // ── PRE-LAUNCH GATE BLOCK (3/4) — delete at launch ────────────────────────
  // No key (or a wrong one) → the coming-soon page. Keyed reviewers fall
  // through to the geo-locale routing below, which is all that runs once
  // this block is deleted at launch.
  const key = readCookie(request, COOKIE_NAME);
  if (!key || (await sha256Hex(key)) !== REVIEW_KEY_SHA256) {
    return new Response(renderGatePage(gateLocale(request, pathname)), {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-robots-tag': 'noindex, nofollow',
      },
    });
  }
  // ── end gate block (3/4) ──────────────────────────────────────────────────

  return geoLocaleRoute(request);
}

/**
 * Geo-IP locale defaulting (see ./geo-locale.js for the decision policy).
 * Runs only for requests that passed the gate above.
 */
function geoLocaleRoute(request) {
  const { pathname, search } = new URL(request.url);

  const decision = decideLocaleRouting({
    pathname,
    method: request.method,
    accept: request.headers.get('accept'),
    cookieLocale: readCookie(request, LOCALE_COOKIE),
    country: request.headers.get('x-vercel-ip-country'),
  });

  if (decision.action === 'redirect') {
    return new Response(null, {
      status: 302,
      headers: {
        location: localeRedirectTarget(decision.locale, pathname, search),
        'set-cookie': localeCookieHeader(decision.locale),
        // Geo- and cookie-dependent: never let a shared cache replay it.
        'cache-control': 'no-store',
      },
    });
  }

  if (decision.action === 'remember') {
    return next({ headers: { 'set-cookie': localeCookieHeader(decision.locale) } });
  }

  return next();
}

// ── PRE-LAUNCH GATE BLOCK (4/4) — delete at the public open (runs to EOF) ───
// The gate page is LOCALIZED (founder, 2026-08-28: "even the gate should be
// localized"): GATE_COPY below was translated by the champollion CLI itself
// (scratch key-value sync, Gemini 3.1 — the same dogfood lane as the site),
// and the locale is chosen exactly like the site would choose it: URL prefix,
// then the locale cookie, then geo-IP. Arabic renders dir="rtl". The 7,900+
// floor rule holds in every language.
const GATE_COPY = {
  "ar": {
    "tagline": "بنية تحتية مفتوحة للترجمة للغات شحيحة الموارد.",
    "heading": "الآن في المرحلة التجريبية",
    "p1": "Champollion هي بنية تحتية رقمية مفتوحة لتحسين الترجمة الآلية في اللغات شحيحة الموارد — صُممت للمطورين، ومناصري اللغات، وكل من يعمل على حل هذه المشكلة.",
    "p2": "يجمع المشروع بين فهرس لغوي موثق يغطي 7,900+ لغة، و CLI للترجمة، وأداة تقييم تسجل أداء طرق الترجمة من أي مطور، وآليات سيادة تهدف إلى ضمان تحكم المجتمعات في البيانات التي تساهم بها.",
    "releases": "الإصدارات متاحة المصدر — والمجانية للاستخدام غير التجاري — متوفرة اليوم على npm و PyPI:",
    "closedBeta": "الموقع نفسه في مرحلة تجريبية مغلقة بينما ننتهي من إعادة التحقق من مصادرنا، وتراخيصنا، وادعاءاتنا.",
    "promise": "سيُفتح للجميع عند الانتهاء من التحقق — وإتمامه على أكمل وجه.",
    "contactLead": "للأسئلة، أو التصحيحات، أو طلب الوصول المبكر:",
    "contactTail": "نرحب بشكل خاص بتصحيح أي أرقام أو بيانات موثقة.",
    "panelLabel": "وصول المراجعين",
    "placeholder": "مفتاح المراجعة",
    "button": "دخول",
    "error": "لم يتم التعرف على هذا المفتاح.",
    "agentBtn": "إعداد وكيلك للعمل مع Champollion",
    "agentHint": "ينسخ أمر الإعداد لأداة البرمجة بالذكاء الاصطناعي الخاصة بك",
    "agentCopied": "تم النسخ — الصقه في وكيلك",
    "orInstall": "أو قم بتثبيت الأدوات بنفسك:",
    "whatCli": "CLI للترجمة",
    "whatMcp": "خادم MCP — لوكلاء الذكاء الاصطناعي",
    "whatHarness": "أداة التقييم",
    "queueLabel": "المساهمة بقدرات الحوسبة في قائمة انتظار المشروع",
    "queueTip": "قائمة الانتظار هي قائمة مرتبة لمعايير الترجمة التي لم يقم أحد بتشغيلها بعد. يقوم البرنامج النصي بتثبيت أداة التقييم، ويسعر العمل ويطلب الإذن قبل الإنفاق، ثم يشغل المهام في أعلى القائمة باستخدام مفتاح API الخاص بك — في حدود الميزانية التي تحددها — وينشر كل نتيجة في اللوحة العامة.",
    "agentPrompt": "قم بإعداد Champollion في هذا المشروع. Champollion هي بنية تحتية مفتوحة للترجمة الآلية للغات شحيحة الموارد: تحتوي على CLI للترجمة، وقائمة انتظار عامة للمعايير، وفهرس موثق يضم 7,900+ لغة.\n\n1. اقرأ https://champollion.dev/for-agents.md — فهو يسرد كل أداة ونقطة نهاية قابلة للقراءة آلياً.\n2. أضف خادم MCP الخاص بـ Champollion باستخدام أي آلية تدعمها هذه البيئة. يتم تشغيله عبر stdio كالتالي: npx -y champollion-mcp-server\n3. قم بالتأكيد عن طريق سرد أدوات خادم MCP، ثم أخبرني بالأدوات المتاحة."
  },
  "de": {
    "tagline": "Offene Übersetzungsinfrastruktur für ressourcenarme Sprachen.",
    "heading": "Jetzt in der Beta-Phase",
    "p1": "Champollion ist eine offene digitale Infrastruktur zur Verbesserung der maschinellen Übersetzung für ressourcenarme Sprachen – entwickelt für Entwickler:innen, Sprachaktivist:innen und alle anderen, die sich dieser Herausforderung widmen.",
    "p2": "Es kombiniert einen referenzierten Sprachindex, der 7,900+ Sprachen umfasst, eine Übersetzungs-CLI, eine Evaluierungsumgebung, die Übersetzungsmethoden beliebiger Entwickler:innen bewertet, sowie Souveränitätsmechanismen, die sicherstellen sollen, dass die Gemeinschaften die Kontrolle über ihre beigesteuerten Daten behalten.",
    "releases": "Die im Quelltext verfügbaren Versionen – kostenlos für die nicht-kommerzielle Nutzung – sind ab heute auf npm und PyPI verfügbar:",
    "closedBeta": "Die Website selbst befindet sich in einer geschlossenen Beta-Phase, während wir die erneute Überprüfung unserer Quellen, Lizenzen und Angaben abschließen.",
    "promise": "Sie wird geöffnet, sobald diese Prüfung abgeschlossen ist – und zwar gründlich.",
    "contactLead": "Fragen, Korrekturen oder Anfragen für einen Vorabzugang:",
    "contactTail": "Korrekturen zu den zitierten Zahlen sind besonders willkommen.",
    "panelLabel": "Zugang für Prüfer:innen",
    "placeholder": "Prüfschlüssel",
    "button": "Zugreifen",
    "error": "Dieser Schlüssel wurde nicht erkannt.",
    "agentBtn": "Integrieren Sie Ihren Agenten in Champollion",
    "agentHint": "Kopiert einen Setup-Prompt für Ihr KI-Programmiertool",
    "agentCopied": "Kopiert — fügen Sie es in Ihren Agenten ein",
    "orInstall": "Oder installieren Sie die Tools selbst:",
    "whatCli": "Übersetzungs-CLI",
    "whatMcp": "MCP-Server — für KI-Agenten",
    "whatHarness": "Evaluierungsumgebung",
    "queueLabel": "Steuern Sie Rechenleistung zur Projekt-Queue bei",
    "queueTip": "Die Queue ist eine priorisierte Liste von Übersetzungs-Benchmarks, die noch niemand ausgeführt hat. Das Skript installiert die Evaluierungsumgebung, berechnet die Kosten und fragt vor der Ausgabe nach. Anschließend führt es die obersten Einträge der Queue mit Ihrem eigenen API-Key aus — bis zu dem von Ihnen festgelegten Budget — und veröffentlicht jedes Ergebnis auf dem öffentlichen Board.",
    "agentPrompt": "Richten Sie Champollion in diesem Projekt ein. Champollion ist eine offene Infrastruktur für maschinelle Übersetzung für ressourcenarme Sprachen: eine Übersetzungs-CLI, eine öffentliche Benchmark-Queue und ein zitierter Index von 7,900+ Sprachen.\n\n1. Lesen Sie https://champollion.dev/for-agents.md — dort ist jedes Tool und jeder maschinenlesbare Endpunkt aufgelistet.\n2. Fügen Sie den Champollion MCP-Server über den Mechanismus hinzu, den diese Umgebung unterstützt. Er läuft über stdio als: npx -y champollion-mcp-server\n3. Bestätigen Sie dies, indem Sie die Tools des MCP-Servers auflisten, und teilen Sie mir dann mit, welche verfügbar sind."
  },
  "en": {
    "tagline": "Open translation infrastructure for low-resource languages.",
    "heading": "Now in beta",
    "p1": "Champollion is open digital infrastructure for improving machine translation in low-resource languages — built for developers, language warriors, and anyone else working on the problem.",
    "p2": "It combines a cited language index covering 7,900+ languages, a translation CLI, an evaluation harness that scores translation methods from any developer, and sovereignty machinery meant to ensure communities govern the data they contribute.",
    "releases": "The source-available releases — free for noncommercial use — are live on npm and PyPI today:",
    "closedBeta": "The site itself is in closed beta while we finish re-verifying our sources, licences, and claims.",
    "promise": "It will open when the checking is done — and done right.",
    "contactLead": "Questions, corrections, or a request for early access:",
    "contactTail": "Corrections to any cited figure are especially welcome.",
    "panelLabel": "Reviewer access",
    "placeholder": "Review key",
    "button": "Enter",
    "error": "That key was not recognized.",
    "agentBtn": "Onboard your agent to Champollion",
    "agentHint": "Copies a setup prompt for your AI coding tool",
    "agentCopied": "Copied — paste it into your agent",
    "orInstall": "Or install the tools yourself:",
    "whatCli": "Translation CLI",
    "whatMcp": "MCP server — for AI agents",
    "whatHarness": "Evaluation harness",
    "queueLabel": "Contribute compute to the project queue",
    "queueTip": "The queue is a ranked list of translation benchmarks nobody has run yet. The script installs the harness, prices the work and asks before spending, then runs the top of the queue with your own API key — up to the budget you set — publishing each result to the public board.",
    "agentPrompt": "Set up Champollion in this project. Champollion is open machine-translation infrastructure for low-resource languages: a translation CLI, a public benchmark queue, and a cited index of 7,900+ languages.\n\n1. Read https://champollion.dev/for-agents.md — it lists every tool and machine-readable endpoint.\n2. Add the Champollion MCP server using whatever mechanism this environment supports. It runs over stdio as: npx -y champollion-mcp-server\n3. Confirm by listing the MCP server's tools, then tell me which ones are available."
  },
  "es": {
    "tagline": "Infraestructura de traducción abierta para lenguas de bajos recursos.",
    "heading": "Ahora en beta",
    "p1": "Champollion es una infraestructura digital abierta para mejorar la traducción automática en lenguas de bajos recursos, creada para profesionales del desarrollo, activistas de lenguas y cualquier otra persona que trabaje en este problema.",
    "p2": "Combina un índice lingüístico citado que abarca 7,900+ lenguas, una CLI de traducción, un entorno de evaluación que califica los métodos de traducción de cualquier profesional del desarrollo, y mecanismos de soberanía diseñados para asegurar que las comunidades gobiernen los datos que aportan.",
    "releases": "Las versiones con código fuente disponible —gratuitas para uso no comercial— ya están publicadas hoy en npm y PyPI:",
    "closedBeta": "El sitio se encuentra en beta cerrada mientras terminamos de volver a verificar nuestras fuentes, licencias y afirmaciones.",
    "promise": "Se abrirá cuando la revisión esté terminada, y bien hecha.",
    "contactLead": "Preguntas, correcciones o solicitudes de acceso anticipado:",
    "contactTail": "Las correcciones a cualquier cifra citada son especialmente bienvenidas.",
    "panelLabel": "Acceso de revisión",
    "placeholder": "Clave de revisión",
    "button": "Ingresar",
    "error": "No se reconoció esa clave.",
    "agentBtn": "Integre su agente a Champollion",
    "agentHint": "Copia un prompt de configuración para su herramienta de programación con IA",
    "agentCopied": "Copiado — péguelo en su agente",
    "orInstall": "O instale las herramientas por su cuenta:",
    "whatCli": "CLI de traducción",
    "whatMcp": "Servidor MCP — para agentes de IA",
    "whatHarness": "Entorno de evaluación",
    "queueLabel": "Aporte capacidad de cómputo a la cola del proyecto",
    "queueTip": "La cola es una lista priorizada de benchmarks de traducción que nadie ha ejecutado aún. El script instala el entorno de evaluación, calcula el costo del trabajo y pide confirmación antes de gastar; luego ejecuta el inicio de la cola con su propia API key —hasta el presupuesto que usted defina— y publica cada resultado en el panel público.",
    "agentPrompt": "Configure Champollion en este proyecto. Champollion es una infraestructura abierta de traducción automática para idiomas de bajos recursos: una CLI de traducción, una cola pública de benchmarks y un índice con referencias de 7,900+ idiomas.\n\n1. Lea https://champollion.dev/for-agents.md — enumera cada herramienta y endpoint legible por máquina.\n2. Agregue el servidor MCP de Champollion usando el mecanismo que soporte este entorno. Se ejecuta a través de stdio como: npx -y champollion-mcp-server\n3. Confirme listando las herramientas del servidor MCP y luego indíqueme cuáles están disponibles."
  },
  "fil": {
    "tagline": "Bukas na translation infrastructure para sa mga low-resource language.",
    "heading": "Nasa beta na ngayon",
    "p1": "Ang Champollion ay isang bukas na digital infrastructure para sa pagpapabuti ng machine translation sa mga low-resource language — binuo para sa mga developer, language warrior, at sinumang tumutugon sa hamong ito.",
    "p2": "Pinagsasama nito ang isang cited language index na sumasaklaw sa 7,900+ wika, isang translation CLI, isang evaluation harness na nagmamarka sa mga translation method mula sa sinumang developer, at sovereignty machinery na naglalayong tiyakin na ang mga komunidad ang namamahala sa datos na kanilang iniambag.",
    "releases": "Ang mga source-available release — libre para sa noncommercial na paggamit — ay live na sa npm at PyPI ngayon:",
    "closedBeta": "Ang mismong site po ay nasa closed beta habang tinatapos namin ang muling pag-verify sa aming mga source, lisensya, at claim.",
    "promise": "Magbubukas po ito kapag tapos na ang pagsusuri — at ginawa nang tama.",
    "contactLead": "Para sa mga tanong, pagwawasto, o request para sa early access:",
    "contactTail": "Lubos po naming tinatanggap ang mga pagwawasto sa anumang cited figure.",
    "panelLabel": "Reviewer access",
    "placeholder": "Review key",
    "button": "Pumasok",
    "error": "Hindi po nakilala ang key na iyon.",
    "agentBtn": "I-onboard ang inyong agent sa Champollion",
    "agentHint": "Kinokopya ang setup prompt para sa inyong AI coding tool",
    "agentCopied": "Nakopya na — i-paste ito sa inyong agent",
    "orInstall": "O i-install ninyo mismo ang mga tool:",
    "whatCli": "Translation CLI",
    "whatMcp": "MCP server — para sa mga AI agent",
    "whatHarness": "Evaluation harness",
    "queueLabel": "Mag-ambag ng compute sa project queue",
    "queueTip": "Ang queue po ay isang naka-rank na listahan ng mga translation benchmark na wala pang nagpapatakbo. Ini-install ng script ang harness, kinakalkula ang presyo ng trabaho at nagtatanong bago gumastos, pagkatapos ay pinapatakbo ang pinakataas ng queue gamit ang inyong sariling API key — hanggang sa budget na inyong itinakda — at pina-publish ang bawat resulta sa public board.",
    "agentPrompt": "I-set up ang Champollion sa proyektong ito. Ang Champollion ay isang open machine-translation infrastructure para sa mga low-resource language: isang translation CLI, isang public benchmark queue, at isang cited index ng 7,900+ na wika.\n\n1. Basahin ang https://champollion.dev/for-agents.md — nakalista rito ang bawat tool at machine-readable endpoint.\n2. Idagdag ang Champollion MCP server gamit ang anumang mekanismo na sinusuportahan ng environment na ito. Tumatakbo ito sa stdio bilang: npx -y champollion-mcp-server\n3. Kumpirmahin sa pamamagitan ng paglista ng mga tool ng MCP server, pagkatapos ay sabihin sa akin kung alin ang mga available."
  },
  "fr": {
    "tagline": "Infrastructure de traduction ouverte pour les langues peu dotées.",
    "heading": "Actuellement en version bêta",
    "p1": "Champollion est une infrastructure numérique ouverte destinée à améliorer la traduction automatique pour les langues peu dotées — conçue pour les développeur·euse·s, les militant·e·s linguistiques et toute autre personne travaillant sur ce problème.",
    "p2": "Elle combine un index linguistique sourcé couvrant 7,900+ langues, une CLI de traduction, un système d'évaluation qui note les méthodes de traduction de tout·e développeur·euse, et un dispositif de souveraineté conçu pour garantir que les communautés gouvernent les données qu'elles fournissent.",
    "releases": "Les versions dont le code source est disponible — gratuites pour un usage non commercial — sont en ligne dès aujourd'hui sur npm et PyPI :",
    "closedBeta": "Le site lui-même est en version bêta fermée pendant que nous terminons de revérifier nos sources, nos licences et nos déclarations.",
    "promise": "Il ouvrira lorsque les vérifications seront terminées — et effectuées correctement.",
    "contactLead": "Questions, corrections ou demande d'accès anticipé :",
    "contactTail": "Les corrections concernant toute donnée chiffrée citée sont particulièrement les bienvenues.",
    "panelLabel": "Accès relecteur·rice",
    "placeholder": "Clé de relecture",
    "button": "Accéder",
    "error": "Cette clé n'a pas été reconnue.",
    "agentBtn": "Intégrez votre agent à Champollion",
    "agentHint": "Copie un prompt de configuration pour votre outil de code IA",
    "agentCopied": "Copié — collez-le dans votre agent",
    "orInstall": "Ou installez les outils vous-même :",
    "whatCli": "CLI de traduction",
    "whatMcp": "Serveur MCP — pour les agents IA",
    "whatHarness": "Harness d'évaluation",
    "queueLabel": "Contribuez de la puissance de calcul à la file d'attente du projet",
    "queueTip": "La file d'attente est une liste classée de benchmarks de traduction que personne n'a encore exécutés. Le script installe le harness, évalue le coût du travail et demande votre accord avant toute dépense, puis exécute les premiers éléments de la file avec votre propre clé API — dans la limite du budget que vous avez défini — en publiant chaque résultat sur le tableau public.",
    "agentPrompt": "Configurez Champollion dans ce projet. Champollion est une infrastructure de traduction automatique ouverte pour les langues peu dotées : une CLI de traduction, une file d'attente publique de benchmarks, et un index sourcé de 7,900+ langues.\n\n1. Lisez https://champollion.dev/for-agents.md — ce document liste chaque outil et point d'accès lisible par machine.\n2. Ajoutez le serveur MCP Champollion en utilisant le mécanisme pris en charge par cet environnement. Il s'exécute via stdio avec la commande : npx -y champollion-mcp-server\n3. Confirmez en listant les outils du serveur MCP, puis indiquez-moi lesquels sont disponibles."
  },
  "ja": {
    "tagline": "低リソース言語のためのオープンな翻訳インフラストラクチャ。",
    "heading": "ベータ版公開中",
    "p1": "Champollionは、低リソース言語における機械翻訳の向上を目的としたオープンなデジタルインフラです。開発者や言語活動家をはじめ、この課題に取り組むすべての人に向けて構築されています。",
    "p2": "7,900+の言語を網羅する出典付き言語インデックス、翻訳CLI、あらゆる開発者の翻訳手法をスコアリングする評価ハーネス、そしてコミュニティが提供したデータを自ら管理できるようにするためのデータ主権メカニズムを備えています。",
    "releases": "ソース公開版（非営利目的での利用は無料）は、現在npmおよびPyPIにて公開されています：",
    "closedBeta": "出典、ライセンス、および記載内容の再検証が完了するまで、サイト自体はクローズドベータ版として運営されています。",
    "promise": "すべての確認作業が適切に完了しだい、一般公開される予定です。",
    "contactLead": "ご質問、内容の訂正、または早期アクセスのリクエストはこちら：",
    "contactTail": "引用データや数値に関する訂正は特に歓迎いたします。",
    "panelLabel": "レビュアーアクセス",
    "placeholder": "レビューキー",
    "button": "送信",
    "error": "キーが認識されませんでした。",
    "agentBtn": "エージェントをChampollionに導入する",
    "agentHint": "AIコーディングツール用のセットアッププロンプトをコピー",
    "agentCopied": "コピーしました — エージェントに貼り付けてください",
    "orInstall": "または、ご自身でツールをインストールする場合：",
    "whatCli": "翻訳CLI",
    "whatMcp": "MCPサーバー — AIエージェント用",
    "whatHarness": "評価ハーネス",
    "queueLabel": "プロジェクトのキューに計算リソースを提供する",
    "queueTip": "キューは、まだ誰も実行していない翻訳ベンチマークの優先順位付きリストです。スクリプトはハーネスをインストールし、コストを計算して実行前に確認を行います。その後、ご自身のAPIキーを使用して（設定した予算を上限として）キューの先頭からタスクを実行し、各結果を公開ボードにパブリッシュします。",
    "agentPrompt": "このプロジェクトにChampollionをセットアップしてください。Champollionは、リソースの少ない言語のためのオープンな機械翻訳インフラストラクチャであり、翻訳CLI、公開ベンチマークキュー、および7,900+の言語の引用付きインデックスを提供します。\n\n1. https://champollion.dev/for-agents.md を読んでください。ここにはすべてのツールと機械可読エンドポイントがリストされています。\n2. この環境がサポートするメカニズムを使用して、Champollion MCPサーバーを追加してください。これはstdio経由で次のように実行されます： npx -y champollion-mcp-server\n3. MCPサーバーのツールをリストして確認し、利用可能なツールを教えてください。"
  },
  "ko": {
    "tagline": "자원이 부족한 언어를 위한 오픈 번역 인프라.",
    "heading": "현재 베타 진행 중이에요",
    "p1": "Champollion은 자원이 부족한 언어의 기계 번역을 개선하기 위한 오픈 디지털 인프라예요. 개발자, 언어 활동가, 그리고 이 문제를 해결하기 위해 노력하는 모든 분을 위해 만들어졌어요.",
    "p2": "7,900+개 언어를 포함하는 인용 언어 인덱스, 번역 CLI, 모든 개발자의 번역 방식을 채점하는 평가 환경, 그리고 커뮤니티가 기여한 데이터를 직접 관리할 수 있도록 보장하는 주권 보호 장치를 하나로 통합했어요.",
    "releases": "비상업적 용도로는 무료인 소스 공개 버전을 오늘부터 npm과 PyPI에서 만나보실 수 있어요:",
    "closedBeta": "출처, 라이선스, 그리고 제공하는 정보에 대한 재검증을 마칠 때까지 웹사이트 자체는 클로즈드 베타로 운영돼요.",
    "promise": "모든 검증을 올바르게 마치고 나면 정식으로 오픈할 예정이에요.",
    "contactLead": "질문, 수정 요청, 또는 얼리 액세스 신청:",
    "contactTail": "인용된 수치에 대한 수정 의견은 특히 더 환영해요.",
    "panelLabel": "리뷰어 접속",
    "placeholder": "리뷰 키",
    "button": "입장",
    "error": "입력하신 키를 확인할 수 없어요.",
    "agentBtn": "Champollion에 에이전트 온보딩하기",
    "agentHint": "AI 코딩 툴용 설정 프롬프트를 복사해요",
    "agentCopied": "복사 완료 — 에이전트에 붙여넣어 주세요",
    "orInstall": "또는 도구를 직접 설치해 보세요:",
    "whatCli": "번역 CLI",
    "whatMcp": "MCP 서버 — AI 에이전트용",
    "whatHarness": "평가 하네스",
    "queueLabel": "프로젝트 대기열에 컴퓨팅 리소스 기여하기",
    "queueTip": "대기열은 아직 아무도 실행하지 않은 번역 벤치마크의 순위 목록이에요. 스크립트가 하네스를 설치하고, 작업 비용을 계산하여 지출 전에 확인을 요청해요. 그런 다음 설정한 예산 내에서 본인의 API 키로 대기열 최상단의 작업을 실행하고, 각 결과를 공개 게시판에 게시해요.",
    "agentPrompt": "이 프로젝트에 Champollion을 설정해 주세요. Champollion은 자원이 부족한 언어를 위한 오픈 기계 번역 인프라로, 번역 CLI, 공개 벤치마크 대기열, 그리고 7,900+개 언어의 인용 색인을 제공해요.\n\n1. https://champollion.dev/for-agents.md 문서를 읽어보세요. 모든 도구와 기계 판독 가능한 엔드포인트가 나열되어 있어요.\n2. 이 환경에서 지원하는 방식을 사용하여 Champollion MCP 서버를 추가해 주세요. stdio를 통해 다음 명령어로 실행돼요: npx -y champollion-mcp-server\n3. MCP 서버의 도구 목록을 확인한 후, 사용 가능한 도구가 무엇인지 알려주세요."
  },
  "nl": {
    "tagline": "Open vertaalinfrastructuur voor talen met beperkte middelen.",
    "heading": "Nu in bèta",
    "p1": "Champollion is een open digitale infrastructuur voor het verbeteren van machinevertaling in talen met beperkte middelen — gebouwd voor ontwikkelaars, taalstrijders en iedereen die aan dit probleem werkt.",
    "p2": "Het combineert een geciteerde taalindex die 7,900+ talen omvat, een vertaal-CLI, een evaluatiesysteem dat vertaalmethoden van elke ontwikkelaar beoordeelt, en soevereiniteitsmechanismen die ervoor moeten zorgen dat gemeenschappen de data beheren die zij bijdragen.",
    "releases": "De source-available releases — gratis voor niet-commercieel gebruik — staan vandaag live op npm en PyPI:",
    "closedBeta": "De website zelf bevindt zich in een gesloten bèta terwijl wij het opnieuw verifiëren van onze bronnen, licenties en claims afronden.",
    "promise": "Deze wordt opengesteld wanneer de controle is voltooid — en goed is uitgevoerd.",
    "contactLead": "Vragen, correcties of een verzoek voor vervroegde toegang:",
    "contactTail": "Correcties op geciteerde cijfers zijn in het bijzonder welkom.",
    "panelLabel": "Toegang voor reviewers",
    "placeholder": "Review-sleutel",
    "button": "Doorgaan",
    "error": "Die sleutel is niet herkend.",
    "agentBtn": "Onboard uw agent bij Champollion",
    "agentHint": "Kopieert een setup-prompt voor uw AI-programmeertool",
    "agentCopied": "Gekopieerd — plak dit in uw agent",
    "orInstall": "Of installeer de tools zelf:",
    "whatCli": "Translation-CLI",
    "whatMcp": "MCP-server — voor AI-agents",
    "whatHarness": "Evaluation harness",
    "queueLabel": "Draag rekenkracht bij aan de project-queue",
    "queueTip": "De queue is een gerangschikte lijst van translation-benchmarks die nog niemand heeft uitgevoerd. Het script installeert de harness, berekent de kosten en vraagt om toestemming voor uitgaven. Vervolgens voert het de top van de queue uit met uw eigen API-key — tot het door u ingestelde budget — en publiceert het elk resultaat op het openbare bord.",
    "agentPrompt": "Stel Champollion in voor dit project. Champollion is een open machine-translation-infrastructuur voor low-resource talen: een translation-CLI, een openbare benchmark-queue en een geciteerde index van 7,900+ talen.\n\n1. Lees https://champollion.dev/for-agents.md — hierin staat elke tool en machine-readable endpoint vermeld.\n2. Voeg de Champollion MCP-server toe via het mechanisme dat deze omgeving ondersteunt. Deze draait via stdio als: npx -y champollion-mcp-server\n3. Bevestig dit door de tools van de MCP-server op te sommen en vertel me vervolgens welke beschikbaar zijn."
  },
  "pt": {
    "tagline": "Infraestrutura de tradução aberta para línguas com poucos recursos.",
    "heading": "Agora em beta",
    "p1": "O Champollion é uma infraestrutura digital aberta para melhorar a tradução automática em línguas com poucos recursos — criada para profissionais de desenvolvimento, ativistas linguísticos e qualquer pessoa que trabalhe no problema.",
    "p2": "Ele combina um índice referenciado cobrindo 7,900+ línguas, uma CLI de tradução, um sistema de avaliação que pontua métodos de tradução de qualquer desenvolvedor/a, e mecanismos de soberania criados para garantir que as comunidades governem os dados com os quais contribuem.",
    "releases": "As versões com código-fonte disponível — gratuitas para uso não comercial — já estão no ar no npm e PyPI:",
    "closedBeta": "O site em si está em beta fechado enquanto terminamos de reverificar nossas fontes, licenças e afirmações.",
    "promise": "Ele será aberto quando a verificação estiver concluída — e bem feita.",
    "contactLead": "Dúvidas, correções ou solicitações de acesso antecipado:",
    "contactTail": "Correções de qualquer dado citado são especialmente bem-vindas.",
    "panelLabel": "Acesso para revisão",
    "placeholder": "Chave de revisão",
    "button": "Entrar",
    "error": "Essa chave não foi reconhecida.",
    "agentBtn": "Integre seu agente ao Champollion",
    "agentHint": "Copia um prompt de configuração para sua ferramenta de IA",
    "agentCopied": "Copiado — cole no seu agente",
    "orInstall": "Ou instale as ferramentas manualmente:",
    "whatCli": "CLI de tradução",
    "whatMcp": "MCP server — para agentes de IA",
    "whatHarness": "Evaluation harness",
    "queueLabel": "Contribua com processamento para a fila do projeto",
    "queueTip": "A fila é uma lista ranqueada de benchmarks de tradução que ninguém executou ainda. O script instala o harness, calcula o custo do trabalho e pede confirmação antes de gastar, depois executa o topo da fila com a sua própria API key — até o orçamento que você definir — publicando cada resultado no painel público.",
    "agentPrompt": "Configure o Champollion neste projeto. O Champollion é uma infraestrutura aberta de tradução automática para idiomas com poucos recursos: uma CLI de tradução, uma fila pública de benchmarks e um índice citado de 7,900+ idiomas.\n\n1. Leia https://champollion.dev/for-agents.md — ele lista todas as ferramentas e endpoints legíveis por máquina.\n2. Adicione o MCP server do Champollion usando qualquer mecanismo que este ambiente suporte. Ele roda via stdio como: npx -y champollion-mcp-server\n3. Confirme listando as ferramentas do MCP server e, em seguida, me diga quais estão disponíveis."
  },
  "th": {
    "tagline": "โครงสร้างพื้นฐานแบบเปิดสำหรับการแปลภาษาที่มีทรัพยากรน้อย",
    "heading": "เปิดทดสอบเบต้าแล้ว",
    "p1": "Champollion คือโครงสร้างพื้นฐานดิจิทัลแบบเปิดเพื่อพัฒนาการแปลภาษาด้วยเครื่องสำหรับภาษาที่มีทรัพยากรน้อย — สร้างขึ้นสำหรับนักพัฒนา ผู้พิทักษ์ภาษา และทุกคนที่กำลังแก้ปัญหานี้",
    "p2": "ระบบนี้รวบรวมดัชนีภาษาที่มีการอ้างอิงครอบคลุม 7,900+ ภาษา, CLI สำหรับการแปล, ชุดเครื่องมือประเมินผลที่ให้คะแนนวิธีการแปลจากนักพัฒนาทุกคน และกลไกอธิปไตยทางข้อมูลที่ออกแบบมาเพื่อให้มั่นใจว่าชุมชนเป็นผู้ควบคุมข้อมูลที่ตนเองร่วมสมทบ",
    "releases": "เวอร์ชันที่เปิดเผยซอร์สโค้ด — ใช้งานได้ฟรีสำหรับวัตถุประสงค์ที่ไม่ใช่เชิงพาณิชย์ — เปิดให้ใช้งานแล้ววันนี้บน npm และ PyPI:",
    "closedBeta": "ตัวเว็บไซต์ยังอยู่ในช่วงปิดทดสอบเบต้า ในระหว่างที่เรากำลังตรวจสอบแหล่งที่มา สิทธิ์การใช้งาน และข้อมูลอ้างอิงของเราอีกครั้ง",
    "promise": "เราจะเปิดให้บริการเมื่อการตรวจสอบเสร็จสิ้น — และถูกต้องสมบูรณ์",
    "contactLead": "หากมีคำถาม ข้อเสนอแนะเพื่อแก้ไข หรือต้องการขอสิทธิ์เข้าใช้งานล่วงหน้า:",
    "contactTail": "เรายินดีรับข้อเสนอแนะเพื่อแก้ไขตัวเลขที่อ้างอิงเป็นพิเศษ",
    "panelLabel": "การเข้าถึงสำหรับผู้ตรวจสอบ",
    "placeholder": "คีย์ตรวจสอบ",
    "button": "เข้าใช้งาน",
    "error": "คีย์ไม่ถูกต้อง",
    "agentBtn": "เชื่อมต่อเอเจนต์ของคุณเข้ากับ Champollion",
    "agentHint": "คัดลอกพรอมต์การตั้งค่าสำหรับเครื่องมือเขียนโค้ด AI ของคุณ",
    "agentCopied": "คัดลอกแล้ว — นำไปวางในเอเจนต์ของคุณ",
    "orInstall": "หรือติดตั้งเครื่องมือด้วยตัวคุณเอง:",
    "whatCli": "CLI สำหรับการแปล",
    "whatMcp": "เซิร์ฟเวอร์ MCP — สำหรับเอเจนต์ AI",
    "whatHarness": "ชุดเครื่องมือประเมินผล",
    "queueLabel": "ร่วมสมทบพลังประมวลผลให้กับคิวของโปรเจกต์",
    "queueTip": "คิวคือรายการจัดอันดับของการทดสอบเกณฑ์มาตรฐานการแปลที่ยังไม่มีใครรัน สคริปต์จะติดตั้งชุดเครื่องมือประเมินผล ประเมินราคา และสอบถามก่อนใช้จ่าย จากนั้นจะรันรายการบนสุดของคิวด้วยคีย์ API ของคุณเอง — ตามงบประมาณที่คุณตั้งไว้ — และเผยแพร่ผลลัพธ์แต่ละรายการลงในกระดานสาธารณะ",
    "agentPrompt": "ตั้งค่า Champollion ในโปรเจกต์นี้ Champollion คือโครงสร้างพื้นฐานแบบเปิดสำหรับการแปลภาษาด้วยเครื่องสำหรับภาษาที่มีทรัพยากรน้อย: ประกอบด้วย CLI สำหรับการแปล, คิวเกณฑ์มาตรฐานสาธารณะ และดัชนีภาษาที่มีการอ้างอิงครอบคลุม 7,900+ ภาษา\n\n1. อ่าน https://champollion.dev/for-agents.md — ซึ่งระบุเครื่องมือและปลายทางที่เครื่องอ่านได้ทั้งหมด\n2. เพิ่มเซิร์ฟเวอร์ MCP ของ Champollion โดยใช้กลไกใดก็ได้ที่สภาพแวดล้อมนี้รองรับ โดยรันผ่าน stdio ด้วยคำสั่ง: npx -y champollion-mcp-server\n3. ยืนยันโดยแสดงรายการเครื่องมือของเซิร์ฟเวอร์ MCP จากนั้นบอกฉันว่ามีเครื่องมือใดบ้างที่พร้อมใช้งาน"
  },
  "vi": {
    "tagline": "Hạ tầng dịch thuật mở cho các ngôn ngữ ít tài nguyên.",
    "heading": "Hiện đang trong giai đoạn beta",
    "p1": "Champollion là hạ tầng kỹ thuật số mở nhằm cải thiện dịch máy cho các ngôn ngữ ít tài nguyên — được xây dựng dành cho các nhà phát triển, những người bảo vệ ngôn ngữ và bất kỳ ai đang nỗ lực giải quyết vấn đề này.",
    "p2": "Dự án kết hợp một danh mục ngôn ngữ có trích dẫn bao gồm 7,900+ ngôn ngữ, một CLI dịch thuật, một bộ công cụ đánh giá để chấm điểm các phương pháp dịch từ bất kỳ nhà phát triển nào, và cơ chế chủ quyền nhằm đảm bảo các cộng đồng có quyền quản trị dữ liệu mà họ đóng góp.",
    "releases": "Các bản phát hành có sẵn mã nguồn — miễn phí cho mục đích phi thương mại — hiện đã có mặt trên npm và PyPI:",
    "closedBeta": "Trang web hiện đang trong giai đoạn closed beta trong khi chúng tôi hoàn tất việc xác minh lại các nguồn dữ liệu, giấy phép và các thông tin đã công bố.",
    "promise": "Trang web sẽ mở cửa khi quá trình kiểm tra hoàn tất — và đảm bảo mọi thứ đều chuẩn xác.",
    "contactLead": "Mọi câu hỏi, đính chính, hoặc yêu cầu truy cập sớm:",
    "contactTail": "Chúng tôi đặc biệt hoan nghênh mọi đính chính đối với các số liệu được trích dẫn.",
    "panelLabel": "Truy cập dành cho người đánh giá",
    "placeholder": "Mã đánh giá",
    "button": "Truy cập",
    "error": "Không nhận diện được mã này.",
    "agentBtn": "Tích hợp agent của bạn vào Champollion",
    "agentHint": "Sao chép prompt cài đặt cho công cụ AI coding của bạn",
    "agentCopied": "Đã sao chép — hãy dán vào agent của bạn",
    "orInstall": "Hoặc tự cài đặt các công cụ:",
    "whatCli": "CLI dịch thuật",
    "whatMcp": "MCP server — dành cho AI agents",
    "whatHarness": "Evaluation harness",
    "queueLabel": "Đóng góp tài nguyên tính toán cho hàng đợi của dự án",
    "queueTip": "Hàng đợi là danh sách xếp hạng các benchmark dịch thuật chưa có ai chạy. Script sẽ cài đặt harness, tính toán chi phí và hỏi ý kiến trước khi chi tiêu, sau đó chạy các mục đầu tiên trong hàng đợi bằng API key của bạn — trong giới hạn ngân sách bạn đã đặt — và công bố từng kết quả lên bảng công khai.",
    "agentPrompt": "Cài đặt Champollion trong dự án này. Champollion là cơ sở hạ tầng dịch máy mở dành cho các ngôn ngữ ít tài nguyên: bao gồm một CLI dịch thuật, một hàng đợi benchmark công khai, và một chỉ mục trích dẫn của 7,900+ ngôn ngữ.\n\n1. Đọc https://champollion.dev/for-agents.md — tài liệu này liệt kê mọi công cụ và endpoint machine-readable.\n2. Thêm Champollion MCP server bằng bất kỳ cơ chế nào mà môi trường này hỗ trợ. Server chạy qua stdio bằng lệnh: npx -y champollion-mcp-server\n3. Xác nhận bằng cách liệt kê các công cụ của MCP server, sau đó cho tôi biết những công cụ nào đang có sẵn."
  },
  "zh": {
    "tagline": "面向低资源语言的开放式翻译基础设施。",
    "heading": "Beta 测试中",
    "p1": "Champollion 是旨在改善低资源语言机器翻译的开放式数字基础设施——专为开发者、语言保护者以及所有致力于解决该问题的人士打造。",
    "p2": "它整合了涵盖 7,900+ 种语言的引证语言索引、翻译 CLI、可对任何开发者提供的翻译方法进行评分的评估框架，以及旨在确保社区能够自主管理其所贡献数据的主权机制。",
    "releases": "源码公开版本（非商业用途免费）现已在 npm 和 PyPI 上线：",
    "closedBeta": "网站本身正处于封闭 Beta 测试阶段，我们正在完成对数据来源、许可和声明的重新验证。",
    "promise": "待所有核查工作妥善完成后，网站将正式开放。",
    "contactLead": "如有疑问、指正或申请早期访问权限：",
    "contactTail": "尤为欢迎对任何引证数据的指正。",
    "panelLabel": "审阅者入口",
    "placeholder": "审阅密钥",
    "button": "进入",
    "error": "无法识别该密钥。",
    "agentBtn": "将你的 Agent 接入 Champollion",
    "agentHint": "复制 AI 编程工具配置提示词",
    "agentCopied": "已复制 —— 请粘贴到你的 Agent 中",
    "orInstall": "或自行安装工具：",
    "whatCli": "翻译 CLI",
    "whatMcp": "MCP 服务器 —— 供 AI Agent 使用",
    "whatHarness": "评测框架",
    "queueLabel": "为项目队列贡献算力",
    "queueTip": "队列是尚未运行的翻译基准测试的排序列表。脚本将安装评测框架，对任务进行估价并在扣费前征求同意，然后使用你自己的 API 密钥运行队列顶部的任务（最高不超过你设定的预算），并将各项结果发布到公开看板。",
    "agentPrompt": "在此项目中配置 Champollion。Champollion 是面向低资源语言的开源机器翻译基础设施：包含一个翻译 CLI、一个公开的基准测试队列，以及一个包含 7,900+ 种语言的引文索引。\n\n1. 阅读 https://champollion.dev/for-agents.md —— 其中列出了所有工具和机器可读的端点。\n2. 使用此环境支持的任何机制添加 Champollion MCP 服务器。它通过 stdio 运行，命令为：npx -y champollion-mcp-server\n3. 通过列出 MCP 服务器的工具进行确认，然后告诉我哪些工具可用。"
  }
};

/** Minimal HTML escape for translated strings interpolated into the page. */
function esc(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function gateLocale(request, pathname) {
  const seg = pathname.split('/')[1];
  if (SITE_LOCALES.includes(seg)) return seg;
  const ck = readCookie(request, LOCALE_COOKIE);
  if (ck && SITE_LOCALES.includes(ck)) return ck;
  const d = decideLocaleRouting({
    pathname,
    method: request.method,
    accept: request.headers.get('accept'),
    cookieLocale: null,
    country: request.headers.get('x-vercel-ip-country'),
  });
  if (d && d.locale && SITE_LOCALES.includes(d.locale)) return d.locale;
  return 'en';
}

function renderGatePage(locale) {
  const c = GATE_COPY[locale] || GATE_COPY.en;
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  return `<!DOCTYPE html>
<html lang="${locale}"${dir === "rtl" ? ' dir="rtl"' : ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Champollion — ${c.heading}</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23101312'/%3E%3Ctext x='16' y='22' text-anchor='middle' font-family='Georgia,serif' font-size='17' fill='%233FC1C0'%3EC%3C/text%3E%3C/svg%3E">
<style>
  :root {
    --bg: #101312;
    --surface: #181C1A;
    --line: #2A302D;
    --text: #E8E6E1;
    --muted: #9BA39E;
    --accent: #3FC1C0;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Inter', 'Noto Sans', system-ui, -apple-system, sans-serif;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    line-height: 1.6;
  }
  main { max-width: 560px; width: 100%; }
  .wordmark {
    font-family: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Noto Serif', serif;
    font-size: 1.9rem;
    letter-spacing: 0.14em;
    color: var(--text);
  }
  .tagline { color: var(--muted); font-size: 0.95rem; margin-top: 6px; }
  .rule { height: 2px; width: 64px; background: var(--accent); margin: 28px 0; border-radius: 1px; }
  h1 {
    font-family: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Noto Serif', serif;
    font-weight: 500;
    font-size: 1.35rem;
    margin-bottom: 14px;
  }
  p { color: var(--muted); font-size: 0.97rem; margin-bottom: 14px; }
  p strong { color: var(--text); font-weight: 600; }
  .panel {
    margin-top: 34px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 18px 20px;
  }
  .panel label {
    display: block;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--muted);
    margin-bottom: 10px;
  }
  .row { display: flex; gap: 10px; }
  input[type=password] {
    flex: 1;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 7px;
    color: var(--text);
    padding: 10px 12px;
    font-size: 0.95rem;
    outline: none;
  }
  input[type=password]:focus { border-color: var(--accent); }
  button {
    background: var(--accent);
    color: #08201F;
    border: none;
    border-radius: 7px;
    padding: 10px 18px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
  }
  button:hover { filter: brightness(1.1); }
  #gate-error { display: none; color: #E8A0A0; font-size: 0.88rem; margin-top: 10px; }
  a { color: var(--accent); text-decoration: none; border-bottom: 1px solid rgba(63,193,192,0.35); }
  a:hover { border-bottom-color: var(--accent); }
  footer { margin-top: 36px; color: #5E665F; font-size: 0.8rem; }
  /* the agent door */
  .agent-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin-top: 4px;
    padding: 11px 18px;
    border-radius: 999px;
    background: var(--accent);
    color: #08201F;
    border: none;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
  }
  .agent-btn:hover { filter: brightness(1.1); }
  .agent-ico {
    width: 15px; height: 15px; flex: none;
    fill: none; stroke: currentColor; stroke-width: 1.4;
    stroke-linecap: round; stroke-linejoin: round;
  }
  .agent-hint { color: var(--muted); font-size: 0.83rem; margin: 8px 0 22px; }
  /* revealed only when the clipboard API is unavailable — copy by hand */
  #agent-prompt {
    background: var(--surface); border: 1px solid var(--line);
    border-radius: 8px; padding: 12px 14px; margin-bottom: 22px;
    font-family: 'SF Mono', 'JetBrains Mono', ui-monospace, monospace;
    font-size: 0.78rem; line-height: 1.55; color: var(--text);
    white-space: pre-wrap; overflow-wrap: anywhere;
  }
  .or-install { font-size: 0.9rem; margin-bottom: 8px; }
  .installs {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0 0 22px;
  }
  .install { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .install code {
    flex: 1 1 260px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 7px;
    padding: 8px 12px;
    font-family: 'SF Mono', 'JetBrains Mono', ui-monospace, monospace;
    font-size: 0.82rem;
    color: var(--accent);
    overflow-wrap: anywhere;
  }
  .install .what { color: #5E665F; font-size: 0.78rem; }
  /* the queue command + its explainer */
  .queue-block { margin-bottom: 22px; }
  .queue-head {
    display: flex; align-items: center; gap: 7px;
    font-size: 0.9rem; margin-bottom: 6px;
  }
  .queue-block code {
    display: block;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 7px;
    padding: 8px 12px;
    font-family: 'SF Mono', 'JetBrains Mono', ui-monospace, monospace;
    font-size: 0.82rem;
    color: var(--accent);
    overflow-wrap: anywhere;
  }
  /* CSS-only tooltip: hover AND keyboard focus, so it is reachable without
     a pointer. No JS — this page must work with scripting disabled. */
  .info {
    position: relative;
    display: inline-flex; align-items: center; justify-content: center;
    width: 16px; height: 16px; flex: none;
    border: 1px solid var(--line); border-radius: 50%;
    color: var(--muted); font-size: 0.7rem; cursor: help;
  }
  .info .tip {
    position: absolute; bottom: calc(100% + 8px); left: 50%;
    transform: translateX(-50%);
    width: max-content; max-width: min(320px, 78vw);
    background: #05201F; color: var(--text);
    border: 1px solid var(--line); border-radius: 8px;
    padding: 10px 12px; font-size: 0.8rem; line-height: 1.5;
    text-align: left;
    opacity: 0; visibility: hidden; transition: opacity 0.15s ease;
    z-index: 5;
  }
  .info:hover .tip, .info:focus .tip, .info:focus-visible .tip {
    opacity: 1; visibility: visible;
  }
</style>
</head>
<body>
<main>
  <div class="wordmark">CHAMPOLLION</div>
  <div class="tagline">${c.tagline}</div>
  <div class="rule"></div>
  <h1>${c.heading}</h1>
  <p>${esc(c.p1)}</p>
  <p>${esc(c.p2)}</p>
  <p>${esc(c.releases)}</p>

  <!-- The agent door. A COPY-A-PROMPT button, never a tool-specific command:
       the MCP server is agent-agnostic (it speaks stdio), and hardcoding one
       vendor's CLI invocation both excludes every other agent and dates the
       page. The prompt tells the agent to use whatever mechanism its own
       environment provides. -->
  <button type="button" class="agent-btn" id="agent-copy">
    <span id="agent-btn-label">${esc(c.agentBtn)}</span>
    <svg class="agent-ico" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect x="5.5" y="1.5" width="9" height="11" rx="1.6"/>
      <path d="M10.5 14.5h-8a1 1 0 0 1-1-1v-9"/>
    </svg>
  </button>
  <div class="agent-hint">${esc(c.agentHint)}</div>
  <pre id="agent-prompt" hidden>${esc(c.agentPrompt)}</pre>

  <p class="or-install">${esc(c.orInstall)}</p>
  <div class="installs">
    <div class="install"><code>npm install champollion</code><span class="what">${esc(c.whatCli)}</span></div>
    <div class="install"><code>npx -y champollion-mcp-server</code><span class="what">${esc(c.whatMcp)}</span></div>
    <div class="install"><code>pipx install mt-eval-harness</code><span class="what">${esc(c.whatHarness)}</span></div>
  </div>

  <div class="queue-block">
    <div class="queue-head">
      ${esc(c.queueLabel)}
      <span class="info" tabindex="0" role="note" aria-label="${esc(c.queueTip)}">?<span class="tip">${esc(c.queueTip)}</span></span>
    </div>
    <code>curl -fsSL https://champollion.dev/run_queue | bash -s -- --budget 2</code>
  </div>
  <p>${esc(c.closedBeta)}</p>
  <p><strong>${esc(c.promise)}</strong></p>
  <p style="margin-top:26px">${esc(c.contactLead)} <a href="mailto:info@champollion.dev?subject=Champollion%20site%20access">info@champollion.dev</a>. ${esc(c.contactTail)}</p>
  <div class="panel">
    <form id="gate">
      <label for="key">${esc(c.panelLabel)}</label>
      <div class="row">
        <input type="password" id="key" placeholder="${esc(c.placeholder)}" autocomplete="off">
        <button type="submit">${esc(c.button)}</button>
      </div>
      <div id="gate-error">${esc(c.error)}</div>
    </form>
  </div>
  <footer>&copy; 2026 Champollion &middot; champollion.dev</footer>
</main>
<script>
(function () {
  // Copy the agent setup prompt. The prompt lives in a hidden <pre> rather
  // than an attribute so its newlines survive verbatim. Progressive
  // enhancement: with no clipboard API the <pre> is revealed to copy by hand.
  var btn = document.getElementById('agent-copy');
  var src = document.getElementById('agent-prompt');
  if (btn && src) {
    var label = document.getElementById('agent-btn-label');
    var original = label.textContent;
    btn.addEventListener('click', function () {
      var text = src.textContent;
      var done = function () {
        label.textContent = ${JSON.stringify(c.agentCopied)};
        setTimeout(function () { label.textContent = original; }, 2400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { src.hidden = false; });
      } else {
        src.hidden = false;
      }
    });
  }

  var form = document.getElementById('gate');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = document.getElementById('key').value.trim();
    if (!v) return;
    document.cookie = 'champollion_review_key=' + encodeURIComponent(v) +
      '; path=/; max-age=2592000; secure; samesite=lax';
    try { sessionStorage.setItem('champGateTry', String(Date.now())); } catch (err) {}
    location.reload();
  });
  try {
    var t = sessionStorage.getItem('champGateTry');
    if (t) {
      sessionStorage.removeItem('champGateTry');
      if (Date.now() - Number(t) < 15000) {
        document.getElementById('gate-error').style.display = 'block';
        document.cookie = 'champollion_review_key=; path=/; max-age=0';
      }
    }
  } catch (err) {}
})();
</script>
</body>
</html>
`;
}
