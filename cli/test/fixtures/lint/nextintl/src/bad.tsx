import { useTranslations } from 'next-intl';

export default function AboutPage() {
  const t = useTranslations('nav');

  return (
    <div className="about-page">
      <h1>Welcome to my portfolio</h1>
      <p>I build things for the web and love doing it</p>
      <nav>
        <a href="/about">{t('about')}</a>
        <a href="/contact">{t('contact')}</a>
      </nav>
      <button>Get in Touch</button>
      <input placeholder="Search the site..." />
      <img alt="My profile photo" src="/photo.jpg" />
      <footer>
        <p>© 2026 Curtis Forbes. All rights reserved.</p>
      </footer>
    </div>
  );
}
