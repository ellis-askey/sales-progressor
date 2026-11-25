import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import "./proposal.css";

// An editorial display serif for pull-quotes and the manifesto close — echoes
// the printed prospectus. Scoped to the proposal via a CSS variable; the rest of
// the microsite uses the app's Geist sans, so this "belongs to the family".
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

// Belt-and-braces on top of the root layout's default noindex and robots.txt
// disallow: this is confidential and must never be indexed or cached publicly.
export const metadata: Metadata = {
  title: "Beyond Sales Progression",
  description: "A private strategic partnership proposal.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
  referrer: "no-referrer",
};

// No-flash theme boot: stamps data-prop-theme before paint from the reader's
// saved choice, else their system preference. Runs synchronously as the root
// node mounts.
const THEME_BOOT = `(function(){try{var r=document.getElementById('prop-root');if(!r)return;var t=localStorage.getItem('prop-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}r.setAttribute('data-prop-theme',t);}catch(e){}})();`;

export default function ProposalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div id="prop-root" className={`prop-root ${fraunces.variable}`} data-prop-theme="light" suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      {children}
    </div>
  );
}
