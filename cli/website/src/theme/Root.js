import React from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';

// Root wraps the entire app (all docs + pages). We mount the site docent here
// so it floats on every page. BrowserOnly keeps it out of SSR/hydration — it's
// a purely client-side, interaction-driven widget (no SSR value, and it calls
// browser fetch), so this avoids any hydration mismatch.
export default function Root({children}) {
  return (
    <>
      {children}
      <BrowserOnly>
        {() => {
          const Docent = require('@site/src/components/Docent').default;
          return <Docent />;
        }}
      </BrowserOnly>
    </>
  );
}
