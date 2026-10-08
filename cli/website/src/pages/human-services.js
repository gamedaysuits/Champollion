import React from "react";
import Translate, {translate} from "@docusaurus/Translate";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";
import Link from "@docusaurus/Link";

import styles from "./spoke.module.css";

/* ====================================================================
   /human-services — the "human method" hub.
   The honest floor for low-resource pairs where no machine translation is
   reliable: connect users to human translators, on their terms. This page
   explains the opt-in, consent-gated provider registry and how to be listed.
   v0 is DISCOVERY (read-only) — dispatch, tickets, and payments come later.
   ==================================================================== */

// Functional day one: a plain email. v0 is opt-in + admin-reviewed (no
// anonymous self-registration into a live registry), so a listing request is
// just an email to the project — no form to break, no backend to fail. The
// link opens the visitor's mail client pre-addressed with a short template.
const CONTACT_EMAIL = "info@champollion.dev";
const REGISTER_SUBJECT = "Human translation service — listing request";
const REGISTER_BODY = [
  "Languages & variety (e.g. English <-> Plains Cree, Y-dialect — varieties are never conflated):",
  "",
  "Provider type (community language office / agency / individual certified translator):",
  "",
  "Turnaround & rate (your terms):",
  "",
  "Usage terms (any non-commercial or community-set conditions):",
  "",
  "I confirm this listing is shared with the provider's / community's explicit consent: (yes/no)",
].join("\n");
const REGISTER_URL =
  `mailto:${CONTACT_EMAIL}` +
  `?subject=${encodeURIComponent(REGISTER_SUBJECT)}` +
  `&body=${encodeURIComponent(REGISTER_BODY)}`;

export default function HumanServicesPage() {
  return (
    <Layout
      title={translate({id: 'page.human.seoTitle', message: 'Human translation services', description: '/human-services SEO title'})}
      description={translate({id: 'page.human.seoDesc', message: 'When no machine method scores well enough, connect to human translators — on their terms. An opt-in, consent-gated registry.', description: '/human-services SEO description'})}
    >
      <main className="container margin-vert--lg">
        <Heading as="h1"><Translate id="page.human.title" description="h1">Human translation services</Translate></Heading>

        <p>
          <Translate id="page.human.p1" description="intro; {claim} is bold" values={{claim: <strong><Translate id="page.human.p1Bold" description="bold claim">no machine method we measure scores well enough</Translate></strong>}}>{'Every machine method we map — Google, Microsoft, DeepL, Amazon, Apertium, LibreTranslate, and the LLMs — is exactly that: a machine. For many low-resource languages, the honest answer to “translate this into my language” is that {claim} on the benchmarks we run — which is a reason not to ship a machine translation for that pair, not a verdict on any single sentence. The missing move is to say so plainly and then point to the people who can do the work.'}</Translate>
        </p>
        <p>
          <Translate id="page.human.p2" description="leaderboard note; {quote} is the emphasized quote" values={{quote: <em><Translate id="page.human.p2Quote" description="quoted string">“These human services cover this pair.”</Translate></em>}}>{'On any pair’s leaderboard view, when human services are listed they appear beside the pair’s measured rows as: {quote}'}</Translate>
        </p>

        <Heading as="h2"><Translate id="page.human.h2Registry" description="section heading">An opt-in registry, on community terms</Translate></Heading>
        <p>
          <Translate id="page.human.p3" description="registry body; {consent} bold, {custodians} emphasized" values={{
            consent: <strong><Translate id="page.human.p3Bold" description="bold">explicit consent</Translate></strong>,
            custodians: <em><Translate id="page.human.p3Em" description="emphasized">no community key custodians have been appointed yet</Translate></em>,
          }}>{'Providers — community language offices, low-resource-language agencies, and individual certified translators — are listed only with their {consent}. Champollion never names a community or its custodians as a translation provider before they have confirmed, and {custodians}. Each listing carries the provider’s own terms: the pair and variety offered (so Plains Cree is never conflated with Moose Cree), turnaround, rate, and any non-commercial or community-set usage terms.'}</Translate>
        </p>
        <p>
          <Translate id="page.human.p4" description="privacy note">A provider’s contact details are never published and are never tracked in the open registry — the public listing carries only what a provider consents to show.</Translate>
        </p>

        <Heading as="h2"><Translate id="page.human.h2Listed" description="section heading">How to be listed</Translate></Heading>
        <p>
          <Translate id="page.human.p5" description="how-to-be-listed body">v0 is a discovery registry: read-only, with listings reviewed and approved out of band before they appear. To be listed, just email us — the button opens your mail app pre-filled with the few things we need (the pair and variety you offer, your terms, and a consent confirmation). It takes about two minutes.</Translate>
        </p>
        <p>
          <Link className="button button--primary" href={REGISTER_URL}>
            <Translate id="page.human.emailBtn" description="email button">Email us to list a service →</Translate>
          </Link>
        </p>
        <p>
          <Translate id="page.human.p6" description="closing; {email} is the address link" values={{email: <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>}}>{'Or write to us directly at {email}. A listing goes public only once it is both consent-attested and approved — until then it stays out of every public view, and your contact details are never published.'}</Translate>
        </p>
      </main>
    </Layout>
  );
}
