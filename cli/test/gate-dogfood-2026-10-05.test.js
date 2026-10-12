/**
 * The quality-gate false positives the 2026-10-05 Spanish docs sync found,
 * and where the honest fallback prefix goes. Each refusal here published a
 * page with '[EN] ' in front of a table or heading, or held back text that
 * was correct as written.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { contentGateFault, validateTranslations, tableProse, isBibliographicEntry, nameCore } from '../lib/validate.js';

const es = { target: 'es', locale: 'es' };
const ja = { target: 'ja', locale: 'ja' };

describe('kept as written is not an echo', () => {
  it('a heading whose words are a name, with code or a citation beside it', () => {
    for (const h of ['### METEOR (Banerjee & Lavie, 2005)', '## Hugo (TOML / YAML / Markdown)',
      '## `microsoft-translator` — Azure Cognitive Services', '### "OPENROUTER_API_KEY not found"']) {
      assert.equal(contentGateFault(h, h, es), null, h);
    }
  });
  it('a reference-list entry', () => {
    const ref = '4. Snover, M., Dorr, B. (2006). "A Study of Translation Edit Rate with Targeted Human Annotation." *Proceedings of AMTA*.';
    assert.ok(isBibliographicEntry(ref));
    assert.equal(contentGateFault(ref, ref, es), null);
    assert.equal(contentGateFault(ref, ref, ja), null, 'citations stay Latin in any script');
    const link = '18. Global Indigenous Data Alliance. "CARE Principles for Indigenous Data Governance." [https://www.gida-global.org/care](https://www.gida-global.org/care).';
    assert.equal(contentGateFault(link, link, es), null);
  });
  it('a reference list in one block, numbered or bulleted', () => {
    const list = '1. Popović, M. (2017). "chrF++: words helping character n-grams." *Proceedings of WMT*.\n'
      + '2. Rei, R., Stewart, C., & Lavie, A. (2020). "COMET: A Neural Framework for MT Evaluation." *Proceedings of EMNLP*.';
    assert.equal(contentGateFault(list, list, es), null);
    const bullets = '- Fishman, J. A. (1991). *Reversing Language Shift: Theoretical Foundations.* Multilingual Matters.';
    assert.ok(isBibliographicEntry(bullets));
    assert.ok(!isBibliographicEntry('The fair is on Friday.\nEvery class will present (2020) "a project".'), 'one prose line is enough to say no');
  });
  it('a prose sentence handed back is still refused', () => {
    const p = 'The science fair is on Friday, and every class will present a project to the families.';
    assert.match(contentGateFault(p, p, es), /source echo/);
    assert.ok(!isBibliographicEntry(p));
  });
  it('a long heading handed back is still refused', () => {
    const h = '## How the translation memory decides what to send again';
    assert.match(contentGateFault(h, h, es), /source echo/);
    assert.equal(nameCore(h), 'How the translation memory decides what to send again');
  });
});

describe('tables are measured by their cells', () => {
  const src = '| Domain | Code | Target % | Rationale |\n|---|---|---|---|\n| Health | HLT | 20 | Clinics |';
  it('a re-padded delimiter row is not repetition', () => {
    const out = '| Dominio | Código | % objetivo | Justificación |\n| ------------ | ------------ | ------------ | ------------ |\n| Salud | HLT | 20 | Clínicas |';
    assert.equal(contentGateFault(src, out, es), null);
  });
  it('drops delimiter rows and pipes, leaves other text alone', () => {
    assert.equal(tableProse(src), 'Domain Code Target % Rationale\nHealth HLT 20 Clinics');
    assert.equal(tableProse('a | b'), 'a | b');
  });
  it('a table handed back untranslated is still refused', () => {
    const big = '| Condition | Meaning |\n|---|---|\n| The model returned the same paragraph it was sent | the block is refused and remembered |';
    assert.match(contentGateFault(big, big, es), /source echo/);
  });
});

describe('length and script, measured against the source', () => {
  it('a short title may grow into its ordinary translation', () => {
    assert.equal(contentGateFault('FAQ', 'Preguntas frecuentes', es), null);
    const { failures } = validateTranslations({ k: 'Häufig gestellte Fragen' }, { k: 'FAQ' }, { target: 'de', locale: 'de' });
    assert.equal(failures.length, 0);
  });
  it('a short heading turned into a sentence is still refused', () => {
    assert.match(contentGateFault('## Feast', 'Le festin annuel de l école aura lieu vendredi soir avec toutes les familles', es), /length inflation/);
  });
  it('fullwidth letters the source itself shows are kept', () => {
    assert.equal(contentGateFault('Fullwidth: Ｂｏｏｋ is refused.', 'Ancho completo: Ｂｏｏｋ se rechaza.', es), null);
  });
  it('fullwidth letters the source does not have are still refused', () => {
    assert.match(contentGateFault('Hello there', 'Ｈｅｌｌｏ ｔｈｅｒｅ', es), /fullwidth/);
  });
});

describe('verify does not re-judge what sync accepted', () => {
  it('a block kept as written after the second ask, cached by sync, is not a verify warning', async () => {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const { startFakeModel, runCli } = await import('./fixtures/fake-openai-model.mjs');
    // A model that keeps a long English line as written, and translates the rest.
    const KEEP = 'Our standing order of business is always read aloud first at every single meeting.';
    const model = await startFakeModel((k, s) => (s.includes(KEEP) ? s : `FR ${s}`));
    try {
      const d = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-kept-'));
      const w = (f, t) => { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), t); };
      w('messages/en.json', JSON.stringify({ hi: 'Hello there, families' }));
      w('news/a.md', `---\ntitle: October news\n---\n\n${KEEP}\n\nThe science fair is on Friday, and every class will present a project.\n`);
      w('champollion.config.json', JSON.stringify({ inputLocale: 'en', localesDir: 'messages', defaultMethod: 'local', model: 'forge-1', contentDir: 'news', languages: ['fr'] }));
      const env = { LOCAL_API_BASE: model.url };
      const r = await runCli(['sync'], d, env);
      assert.equal(r.code, 0, `asked twice, kept twice: accepted\n${r.out}`);
      const page = fs.readFileSync(path.join(d, 'news/a.fr.md'), 'utf8');
      assert.ok(page.includes(KEEP) && !page.includes('[EN]'));
      const v = await runCli(['verify'], d, env);
      assert.doesNotMatch(v.out, /quality gate refuses/, v.out);
    } finally {
      await model.close();
    }
  });
});
