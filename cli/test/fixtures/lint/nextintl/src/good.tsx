import { useTranslations } from 'next-intl';

export default function HeroSection() {
  const t = useTranslations('hero');

  return (
    <section className="hero-section">
      <h1>{t('title')}</h1>
      <p>{t('subtitle')}</p>
    </section>
  );
}
