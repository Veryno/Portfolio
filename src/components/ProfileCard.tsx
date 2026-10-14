import { Github, Linkedin } from 'lucide-react';
import React from 'react';
import { PixelSky } from './PixelSky';

const PORTFOLIO_ACCENT = 'var(--portfolio-accent)';
const TEXT_COLOR = '#000';
const RULE_COLOR = 'rgba(0, 0, 0, 0.25)';
// On phones the header and footer sit on the dark page, outside the sky box.
const MOBILE_TEXT_COLOR = '#fff';

const EXPERIENCE = [
  { label: 'Vex Technologies', href: 'https://builtbyvex.com/' },
  { label: 'Truebird Technologies', href: 'https://www.truebird.com/' },
  { label: 'Reem Construction', href: 'https://www.reemconstruction.com/' },
  { label: 'Open Avenues', href: 'https://openavenuesfoundation.org/' },
];

const PROJECTS = [
  { label: 'FirstAidAI', href: 'https://github.com/Veryno/FirstAidAI' },
  { label: 'Cuny Tech Prep', href: 'https://cunytechprep.org/' },
  { label: 'Ethereum smart contract', href: 'https://github.com/Veryno/QuickNodeOAF' },
  { label: 'Read Me a Story', href: 'https://github.com/Veryno/Bedtime-Story-Generator' },
];

type SectionProps = { className?: string; color: string };

function hoverHandlers(color: string) {
  return {
    onMouseEnter: (e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.color = PORTFOLIO_ACCENT),
    onMouseLeave: (e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.color = color),
  };
}

function ProfileHeader({ className = '', color }: SectionProps) {
  return (
    <div className={`profile-header flex flex-col gap-1 md:gap-2 ${className}`}>
      <h1 className="profile-name text-4xl md:text-7xl" style={{ color }}>Yaacob Abdullah</h1>
      <p className="profile-role text-lg md:text-3xl" style={{ color }}>Software Engineer and Developer</p>
    </div>
  );
}

function ProfileFooter({ className = '', color }: SectionProps) {
  return (
    <div className={`portfolio-footer flex items-center justify-between ${className}`}>
      <div className="portfolio-socials flex items-center gap-4 md:gap-6">
        <a
          href="https://github.com/Veryno"
          target="_blank"
          rel="noopener noreferrer"
          className="portfolio-social-link transition-colors"
          style={{ color }}
          {...hoverHandlers(color)}
          aria-label="GitHub"
        >
          <Github className="w-5 h-5 md:w-6 md:h-6" />
        </a>
        <a
          href="https://www.linkedin.com/in/yaacobabdullah/"
          target="_blank"
          rel="noopener noreferrer"
          className="portfolio-social-link transition-colors"
          style={{ color }}
          {...hoverHandlers(color)}
          aria-label="LinkedIn"
        >
          <Linkedin className="w-5 h-5 md:w-6 md:h-6" />
        </a>
      </div>
      <a
        href="mailto:yaacobabdullahh@gmail.com"
        className="portfolio-email hover:opacity-80 transition-opacity text-base md:text-xl underline"
        style={{ color }}
        {...hoverHandlers(color)}
      >
        yaacobabdullahh@gmail.com
      </a>
    </div>
  );
}

function LinkSection({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div className="portfolio-section flex-1 flex flex-col gap-2 md:gap-4">
      <h3 className="portfolio-section-title text-base md:text-xl tracking-wider" style={{ color: TEXT_COLOR }}>{title}</h3>
      <div className="portfolio-link-list flex flex-col gap-2 md:gap-3">
        {links.map(({ label, href }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="portfolio-link hover:opacity-80 transition-opacity text-base md:text-xl underline"
            style={{ color: TEXT_COLOR }}
            {...hoverHandlers(TEXT_COLOR)}
          >
            {label}
          </a>
        ))}
      </div>
    </div>
  );
}

export function ProfileCard() {
  return (
    <>
      {/* Phone-only copy; hidden on desktop where the header lives in the box. */}
      <ProfileHeader className="profile-mobile-only" color={MOBILE_TEXT_COLOR} />

      <div className="profile-card glass-card w-screen md:w-[650px] pt-[70px] px-6 pb-6 md:p-10 relative z-10">
        <PixelSky className="profile-sky" />
        <div className="profile-content flex flex-col gap-3 md:gap-6">
          <ProfileHeader className="profile-box-only flex-shrink-0" color={TEXT_COLOR} />

          <div className="profile-divider h-px flex-shrink-0" style={{ backgroundColor: RULE_COLOR }}></div>

          <p className="profile-bio leading-relaxed text-base md:text-xl flex-shrink-0" style={{ color: TEXT_COLOR }}>
            Software Engineer with hands-on experience building full-stack apps and applications I find interesting. I care about clean architecture, fast execution, and solving real problems.
          </p>

          <a
            href="/resume/Yaacob_Abdullah_Resume.pdf"
            download="Yaacob_Abdullah_Resume.pdf"
            className="profile-resume hover:opacity-80 transition-opacity inline-flex items-center gap-2 w-fit text-base md:text-xl tracking-wide flex-shrink-0"
            style={{ color: TEXT_COLOR }}
          >
            DOWNLOAD RESUME
          </a>

          <div className="portfolio-details flex gap-6 md:gap-10 md:flex-1 min-h-0">
            <LinkSection title="TECHNICAL EXPERIENCE" links={EXPERIENCE} />
            <LinkSection title="PROJECTS/FELLOWSHIPS" links={PROJECTS} />
          </div>

          <ProfileFooter className="profile-box-only pt-2 md:pt-3 flex-shrink-0" color={TEXT_COLOR} />
        </div>
      </div>

      {/* Phone-only copy; hidden on desktop where the footer lives in the box. */}
      <ProfileFooter className="profile-mobile-only" color={MOBILE_TEXT_COLOR} />
    </>
  );
}
