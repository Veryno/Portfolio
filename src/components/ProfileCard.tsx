import { Github, Linkedin } from 'lucide-react';
import React from 'react';

export function ProfileCard() {
  return (
    <div className="glass-card w-screen md:w-[650px] md:h-[650px] pt-[70px] px-6 pb-6 md:p-10 relative z-10">
      <div className="flex flex-col gap-3 md:gap-6 md:h-full md:overflow-y-auto">
        {/* Header Section */}
        <div className="flex flex-col gap-1 md:gap-2 flex-shrink-0">
          <h1 className="text-4xl md:text-7xl" style={{ color: '#d6d6d6' }}>Yaacob Abdullah</h1>
          <p className="text-lg md:text-3xl" style={{ color: '#d6d6d6' }}>Software Engineer and Developer</p>
        </div>

        <div className="h-px flex-shrink-0" style={{ backgroundColor: 'rgba(214, 214, 214, 0.2)' }}></div>

        {/* Bio Section */}
        <p className="leading-relaxed text-base md:text-xl flex-shrink-0" style={{ color: '#d6d6d6' }}>
          Software Engineer with hands-on experience building full-stack apps and cool stuff. I care about clean architecture, fast execution, and solving real problems.
        </p>

        {/* Download Resume Button */}
        <a
          href="/resume/Yaacob_Abdullah_Resume.pdf"
          download="Yaacob_Abdullah_Resume.pdf"
          className="hover:opacity-80 transition-opacity inline-flex items-center gap-2 w-fit text-base md:text-xl tracking-wide flex-shrink-0"
          style={{ color: '#39FF14' }}
        >
          DOWNLOAD RESUME
        </a>

        {/* Two Column Section */}
        <div className="flex gap-6 md:gap-10 md:flex-1 min-h-0">
          {/* Technical Experience */}
          <div className="flex-1 flex flex-col gap-2 md:gap-4">
            <h3 className="text-base md:text-xl tracking-wider" style={{ color: '#d6d6d6' }}>TECHNICAL EXPERIENCE</h3>
            <div className="flex flex-col gap-2 md:gap-3">
              <a
                href="https://www.truebird.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-80 transition-opacity text-base md:text-xl underline"
                style={{ color: '#d6d6d6', textDecorationColor: 'rgba(214, 214, 214, 0.2)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#39FF14'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#d6d6d6'}
              >
                Truebird Technologies
              </a>
              <a
                href="https://www.reemconstruction.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-80 transition-opacity text-base md:text-xl underline"
                style={{ color: '#d6d6d6', textDecorationColor: 'rgba(214, 214, 214, 0.2)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#39FF14'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#d6d6d6'}
              >
                Reem Construction
              </a>
              <a
                href="https://openavenuesfoundation.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-80 transition-opacity text-base md:text-xl underline"
                style={{ color: '#d6d6d6', textDecorationColor: 'rgba(214, 214, 214, 0.2)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#39FF14'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#d6d6d6'}
              >
                Open Avenues
              </a>
            </div>
          </div>

          {/* Projects/Fellowships */}
          <div className="flex-1 flex flex-col gap-2 md:gap-4">
            <h3 className="text-base md:text-xl tracking-wider" style={{ color: '#d6d6d6' }}>PROJECTS/FELLOWSHIPS</h3>
            <div className="flex flex-col gap-2 md:gap-3">
              <a
                href="https://github.com/Veryno/FirstAidAI"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-80 transition-opacity text-base md:text-xl underline"
                style={{ color: '#d6d6d6', textDecorationColor: 'rgba(214, 214, 214, 0.2)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#39FF14'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#d6d6d6'}
              >
                FirstAidAI
              </a>
              <a
                href="https://cunytechprep.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-80 transition-opacity text-base md:text-xl underline"
                style={{ color: '#d6d6d6', textDecorationColor: 'rgba(214, 214, 214, 0.2)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#39FF14'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#d6d6d6'}
              >
                Cuny Tech Prep
              </a>
              <a
                href="https://github.com/Veryno/QuickNodeOAF"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-80 transition-opacity text-base md:text-xl underline"
                style={{ color: '#d6d6d6', textDecorationColor: 'rgba(214, 214, 214, 0.2)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#39FF14'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#d6d6d6'}
              >
                Ethereum smart contract
              </a>
              <a
                href="https://github.com/Veryno/Bedtime-Story-Generator"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-80 transition-opacity text-base md:text-xl underline"
                style={{ color: '#d6d6d6', textDecorationColor: 'rgba(214, 214, 214, 0.2)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#39FF14'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#d6d6d6'}
              >
                Read Me a Story
              </a>
            </div>
          </div>
        </div>

        {/* Footer Section */}
        <div className="flex items-center justify-between pt-2 md:pt-3 flex-shrink-0">
          <div className="flex items-center gap-4 md:gap-6">
            <a
              href="https://github.com/Veryno"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors"
              style={{ color: '#d6d6d6' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#39FF14'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#d6d6d6'}
              aria-label="GitHub"
            >
              <Github className="w-5 h-5 md:w-6 md:h-6" />
            </a>
            <a
              href="https://www.linkedin.com/in/yaacobabdullah/"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors"
              style={{ color: '#d6d6d6' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#39FF14'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#d6d6d6'}
              aria-label="LinkedIn"
            >
              <Linkedin className="w-5 h-5 md:w-6 md:h-6" />
            </a>
          </div>
          <a
            href="mailto:yaacobabdullahh@gmail.com"
            className="hover:opacity-80 transition-opacity text-base md:text-xl underline"
            style={{ color: '#d6d6d6', textDecorationColor: 'rgba(214, 214, 214, 0.2)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#39FF14'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#d6d6d6'}
          >
            yaacobabdullahh@gmail.com
          </a>
        </div>
      </div>
    </div>
  );
}