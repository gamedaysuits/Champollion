import React from 'react';
import Footer from '@theme-original/DocItem/Footer';
import RelatedRail from '@site/src/components/RelatedRail';

/* Wrap (not eject) the DocItem footer: the original tags/edit-meta row
   renders untouched, then the RelatedRail ("If this interested you →")
   appears between the doc content and the prev/next paginator on every
   doc page. See src/components/RelatedRail.js for the data contract. */
export default function FooterWrapper(props) {
  return (
    <>
      <Footer {...props} />
      <RelatedRail />
    </>
  );
}
