/**
 * DocsPage.jsx — In-app help & guide for CGM Pulse.
 * Rewritten for a non-technical LinkedIn Ads specialist audience.
 *
 * Layout:
 *   Desktop — Sticky left sidebar (220px) with scroll-spy + scrollable content (max-w-3xl)
 *   Mobile  — Sticky dropdown navigator + full-width content
 */
import { useState, useEffect } from "react";
import PageHeader from "../components/Shared/PageHeader";

/* ─── Section metadata ─────────────────────────────────────────────── */

const SECTIONS = [
  { id: "getting-started", label: "Getting Started",  icon: "rocket_launch" },
  { id: "your-kpis",       label: "Your KPIs",        icon: "speed" },
  { id: "dashboard",       label: "Dashboard",        icon: "dashboard" },
  { id: "campaigns",       label: "Campaigns",        icon: "campaign" },
  { id: "analytics",       label: "Analytics",        icon: "analytics" },
  { id: "ai-report",       label: "AI Report",        icon: "auto_awesome" },
  { id: "ask-ai",          label: "Ask AI",           icon: "chat" },
  { id: "alerts",          label: "Alerts",           icon: "notifications" },
  { id: "settings",        label: "Settings",         icon: "settings" },
  { id: "faq",             label: "FAQ",              icon: "help" },
];

/* ─── Reusable components ──────────────────────────────────────────── */

function DocTable({ headers, rows }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-outline-variant/10">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-primary/20">
            {headers.map((h, i) => (
              <th key={i} className="text-left text-xs font-semibold text-primary px-4 py-3 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? "bg-surface-container" : "bg-surface-container-high"}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-4 py-2.5 text-sm text-on-surface-variant border-t border-outline-variant/10">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tip({ children }) {
  return (
    <div className="bg-surface-container-high border-l-2 border-primary/40 rounded-r-lg px-4 py-3 my-4">
      <p className="text-sm text-on-surface-variant leading-relaxed">{children}</p>
    </div>
  );
}

function SectionTitle({ icon, title }) {
  return (
    <div className="flex items-center gap-2.5 mb-5 pt-4 pb-3 border-b border-outline-variant/15">
      <span className="material-symbols-outlined text-primary text-xl">{icon}</span>
      <h2 className="font-headline text-lg font-bold text-on-surface">{title}</h2>
    </div>
  );
}

function SubHeading({ children }) {
  return <h3 className="font-headline text-base font-bold text-on-surface mt-8 mb-3">{children}</h3>;
}

/* ─── FAQ data ─────────────────────────────────────────────────────── */

const FAQ_ITEMS = [
  {
    q: 'Why are all my campaigns showing as "Paused"?',
    a: "The dashboard is loaded with historical data from January 1 to March 3, 2026. Since no campaigns are actively running past that date, they all show as Paused. This is normal for this version. In a live setup connected to your active LinkedIn account, campaigns running today would show as Active.",
  },
  {
    q: "Is the data I'm seeing live or historical?",
    a: "Historical. This version uses a fixed dataset covering January 1 – March 3, 2026. The dashboard refreshes automatically on a timer, but since no new data is being added to the source, the numbers stay the same. In a live deployment, new data would flow in automatically every day and the dashboard would reflect it.",
  },
  {
    q: 'Why does "This Month" show almost no data?',
    a: "The dataset ends on March 3, 2026. So \"This Month\" only covers the first 3 days of March. Use Last 30 Days or All Time for a fuller picture.",
  },
  {
    q: "Can I change my KPI targets?",
    a: "Yes. Settings → KPI Targets → update any value → Save Targets. All colour coding across the entire app updates immediately.",
  },
  {
    q: "The AI chat said it can't find data for a date I know exists. What do I do?",
    a: "Try using the date in YYYY-MM-DD format — for example, 2026-02-16 instead of \"February 16th\" or \"Feb 16\". The AI finds specific dates most reliably in that format.",
  },
  {
    q: "How accurate is the AI Report?",
    a: "Very. The report is generated from your actual campaign data — real campaign names, real spend figures, real KPI values from the dataset. It won't make things up. If a number looks wrong, check the same campaign in the Campaigns table.",
  },
  {
    q: "Can I share the AI Report with my team or a client?",
    a: "Yes — copy the report text from the panel and paste it anywhere: Slack, email, a Google Doc, a client presentation. There's no export button needed; it's plain text.",
  },
  {
    q: 'Why does Budget Pacing show "Underpacing" for almost everything?',
    a: "Budget estimates are based on each campaign's highest historical monthly spend. With the dataset ending on March 3, any March campaigns only have 3 days of spend — which looks like underpacing against a full-month estimate. This corrects itself with a full month of live data.",
  },
  {
    q: "My custom KPI targets reset when I came back. Is that a bug?",
    a: "It's a known limitation of this version. Custom targets are stored in the app's memory and may reset if the server restarts. Re-entering them takes under a minute. A future version would save them permanently.",
  },
  {
    q: "Can I edit campaign data directly in CGM Pulse?",
    a: "No — CGM Pulse is a read and analyse tool. All data lives in the Google Sheet. Any changes you make in LinkedIn Campaign Manager flow into the Sheet, which then updates CGM Pulse automatically.",
  },
];

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
  const [faqOpen, setFaqOpen] = useState(null);

  /* ── Scroll spy ──────────────────────────────────────────────────── */
  useEffect(() => {
    const sections = document.querySelectorAll("section[id]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  function scrollTo(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const isMobile = window.innerWidth < 1024;
    const offset = isMobile ? 110 : 80;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  }

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <div>
      <PageHeader title="Help & Guide" subtitle="Your complete guide to monitoring LinkedIn Ads without the manual work." />

      {/* ── Mobile dropdown ── */}
      <div className="lg:hidden sticky top-[52px] z-20 -mx-4 px-4 py-2 bg-background/95 backdrop-blur-sm border-b border-outline-variant/10 mb-4">
        <select
          value={activeSection}
          onChange={(e) => scrollTo(e.target.value)}
          className="w-full bg-surface-container border border-outline-variant/20 rounded-xl py-2.5 px-3 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none"
        >
          {SECTIONS.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="lg:flex lg:gap-8">
        {/* ── Desktop sidebar ── */}
        <nav className="hidden lg:block w-[220px] shrink-0 sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
          <ul className="space-y-0.5">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => scrollTo(s.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                    activeSection === s.id
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50"
                  }`}
                >
                  <span className="material-symbols-outlined text-base">{s.icon}</span>
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* ── Content ── */}
        <div className="flex-1 min-w-0 max-w-3xl space-y-0 pb-20">

          {/* Data context banner */}
          <div className="bg-surface-container border-l-4 border-primary rounded-xl p-5 mb-10">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-xl mt-0.5 shrink-0">info</span>
              <div>
                <p className="font-semibold text-on-surface mb-1">About the data you're seeing</p>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  This version of CGM Pulse is loaded with real historical campaign data from{" "}
                  <strong className="text-on-surface">January 1 – March 3, 2026</strong>.
                  That's why all campaigns show as "Paused" — they ran during that period and
                  have since ended. Everything you see — KPI numbers, charts, AI analysis —
                  is based on this real data. In a live setup, new data would flow in
                  automatically every day.
                </p>
              </div>
            </div>
          </div>

          {/* ═══ Section 1: Getting Started ═══ */}
          <section id="getting-started" className="mb-20">
            <SectionTitle icon="rocket_launch" title="What is CGM Pulse?" />
            <p className="text-sm text-on-surface-variant leading-relaxed mb-5">
              CGM Pulse is your LinkedIn Ads command centre. Instead of opening LinkedIn Campaign
              Manager every morning and checking 73 campaigns one by one — which takes around
              45 minutes — CGM Pulse shows everything on one screen. It takes about 8 minutes.
            </p>

            <SubHeading>The difference in practice</SubHeading>
            <DocTable
              headers={["What you used to do", "What you do now"]}
              rows={[
                ["Open LinkedIn Campaign Manager", <span className="text-tertiary font-semibold">Open cgm-pulse.vercel.app</span>],
                ["Check each campaign manually", <span className="text-tertiary font-semibold">See all 73 at once</span>],
                ["Export to a spreadsheet to compare", <span className="text-tertiary font-semibold">Sort and filter in the table</span>],
                ["Calculate KPIs yourself", <span className="text-tertiary font-semibold">They're calculated automatically</span>],
                ["Notice problems days later", <span className="text-tertiary font-semibold">Get an alert the same day</span>],
                ["Write your own performance summary", <span className="text-tertiary font-semibold">Click "Generate AI Report"</span>],
                ["Dig through exports to answer a question", <span className="text-tertiary font-semibold">Ask the AI in plain English</span>],
              ]}
            />

            <SubHeading>How to access it</SubHeading>
            <p className="text-sm text-on-surface-variant leading-relaxed mb-2">
              Open any web browser — Chrome, Safari, Firefox — and go to:
            </p>
            <div className="bg-surface-container rounded-xl px-5 py-3 inline-block mb-4">
              <code className="text-primary font-semibold text-sm">https://cgm-pulse.vercel.app/</code>
            </div>
            <p className="text-sm text-on-surface-variant">No account. No password. No app to download. Works on your phone too.</p>

            <SubHeading>Your 8-minute morning routine</SubHeading>
            <p className="text-sm text-on-surface-variant leading-relaxed mb-4">
              This is the workflow the tool is built around:
            </p>
            <ol className="space-y-2.5 text-sm text-on-surface-variant">
              {[
                [<strong className="text-on-surface">Open CGM Pulse</strong>, " — cgm-pulse.vercel.app"],
                [<strong className="text-on-surface">Scan the 4 KPI cards</strong>, " at the top of the Dashboard — any red?"],
                [<strong className="text-on-surface">Check the Budget Pacing card</strong>, " — any campaigns overspending?"],
                [<strong className="text-on-surface">Click "✨ Generate AI Report"</strong>, " in the header — takes 10 seconds"],
                [<strong className="text-on-surface">Read the report</strong>, " — it will name the specific campaigns to act on"],
                [<strong className="text-on-surface">Go to Campaigns</strong>, " and find those campaigns"],
                [<strong className="text-on-surface">Click a campaign row</strong>, " to see its 7-day trend"],
                [<strong className="text-on-surface">Act in LinkedIn Campaign Manager</strong>, " based on what you found"],
              ].map(([bold, rest], i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-tertiary font-bold shrink-0 w-6 text-right">{i + 1}.</span>
                  <span>{bold}{rest}</span>
                </li>
              ))}
            </ol>
            <p className="text-sm text-on-surface-variant mt-4">That's it. The rest of this guide explains each step in detail.</p>
          </section>

          {/* ═══ Section 2: Your KPIs ═══ */}
          <section id="your-kpis" className="mb-20">
            <SectionTitle icon="speed" title="The 4 KPIs CGM Pulse Tracks" />
            <p className="text-sm text-on-surface-variant leading-relaxed mb-5">
              CGM Pulse watches four numbers across all 73 campaigns. When any of them goes
              outside the target range, you'll see it immediately —{" "}
              <span className="text-error font-semibold">red means attention needed</span>,{" "}
              <span className="text-tertiary font-semibold">gold means on track</span>.
            </p>

            <DocTable
              headers={["KPI", "What it measures", "Your target", "Which direction is good"]}
              rows={[
                [<strong className="text-on-surface">CPC</strong>, "How much you pay each time someone clicks your ad", <span className="text-tertiary font-semibold">Below $5.00</span>, "Lower is better"],
                [<strong className="text-on-surface">CTR</strong>, "What % of people who see your ad actually click it", <span className="text-tertiary font-semibold">Above 0.65%</span>, "Higher is better"],
                [<strong className="text-on-surface">CPL</strong>, "How much you spend to get one lead", <span className="text-tertiary font-semibold">Below $120</span>, "Lower is better"],
                [<strong className="text-on-surface">Conv. Rate</strong>, "What % of clicks turn into conversions", <span className="text-tertiary font-semibold">Above 1%</span>, "Higher is better"],
              ]}
            />

            <SubHeading>How these numbers are calculated</SubHeading>
            <p className="text-sm text-on-surface-variant leading-relaxed mb-4">
              You don't need to calculate anything — CGM Pulse does it automatically. But if you want to understand the maths:
            </p>
            <DocTable
              headers={["KPI", "How it's calculated", "Example"]}
              rows={[
                ["CPC", "Total spend ÷ number of clicks", "$850 spent, 45 clicks → $18.89 per click"],
                ["CTR", "Clicks ÷ impressions × 100", "45 clicks, 5,000 views → 0.90%"],
                ["CPL", "Total spend ÷ number of leads", "$850 spent, 3 leads → $283.33 per lead"],
                ["Conv. Rate", "Conversions ÷ clicks × 100", "3 conversions, 45 clicks → 6.67%"],
              ]}
            />

            <SubHeading>Changing your targets</SubHeading>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              If your target numbers are different from the defaults, you can change them any time
              in <strong className="text-on-surface">Settings → KPI Targets</strong>. Once you save, every colour on every page updates
              instantly to reflect your new targets.
            </p>

            <SubHeading>What to do when a KPI is red</SubHeading>
            <ol className="space-y-2 text-sm text-on-surface-variant">
              {[
                "Look at the Dashboard — note which KPI card is red (e.g. CPC is too high)",
                <>Go to <strong className="text-on-surface">Campaigns</strong> in the sidebar</>,
                <>Click the <strong className="text-on-surface">CPC column header</strong> to sort from worst to best</>,
                "The most expensive campaigns rise to the top",
                "Click any campaign row to expand it and see its 7-day trend",
                "Is it getting worse or improving? A downward trend needs faster action",
                <>Click <strong className="text-on-surface">"Ask Claude about this campaign"</strong> for an instant AI explanation</>,
                "Take action in LinkedIn Campaign Manager",
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-tertiary font-bold shrink-0 w-6 text-right">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* ═══ Section 3: Dashboard ═══ */}
          <section id="dashboard" className="mb-20">
            <SectionTitle icon="dashboard" title="The Dashboard" />
            <p className="text-sm text-on-surface-variant leading-relaxed mb-5">
              The Dashboard gives you the full picture before you've had your second coffee.
              Scroll from top to bottom and you've seen everything.
            </p>

            <SubHeading>KPI Summary Cards</SubHeading>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Four large cards across the top. Each shows one KPI calculated across all campaigns combined.{" "}
              <span className="text-tertiary font-semibold">Gold</span> = on target.{" "}
              <span className="text-error font-semibold">Red</span> = something needs attention.
            </p>
            <Tip>
              <strong>Important:</strong> These cards show account-wide averages. A card can be slightly red
              even if only 2–3 campaigns are causing the problem. Go to the Campaigns page to find the specific offenders.
            </Tip>

            <SubHeading>Budget Pacing</SubHeading>
            <p className="text-sm text-on-surface-variant leading-relaxed mb-4">
              Shows how each campaign's spending compares to its estimated monthly budget.
              Use the <strong className="text-on-surface">dropdown in the top right</strong> to switch between months.
            </p>
            <DocTable
              headers={["Status", "What it means", "What to consider"]}
              rows={[
                [<span className="text-tertiary font-bold">ON TRACK</span>, "Spending at the right pace", "No action needed"],
                [<span className="text-error font-bold">OVERPACING</span>, "Spending too fast — may run out before month end", "Consider reducing daily spend"],
                [<span className="text-primary font-bold">UNDERPACING</span>, "Spending too slowly — may not use full budget", "Consider increasing spend or broadening targeting"],
              ]}
            />
            <Tip>
              LinkedIn's data export doesn't include your actual budget figures. CGM Pulse estimates budgets based
              on each campaign's highest historical monthly spend. Always cross-reference with LinkedIn Campaign Manager.
            </Tip>

            <SubHeading>Performance Over Time chart</SubHeading>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              The chart shows your account's total spend (purple line) and clicks (gold dashed line) day by day.
              Hover over any point to see the exact numbers for that date. Use this to spot patterns —
              did something change on a specific date? Did performance drop after a creative refresh?
            </p>

            <SubHeading>Campaign table</SubHeading>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              All 73 campaigns listed below the charts. <strong className="text-on-surface">Search</strong> by typing any part of a campaign name.{" "}
              <strong className="text-on-surface">Sort</strong> by clicking any column header. <strong className="text-on-surface">Expand a row</strong> by clicking anywhere on a campaign.
            </p>

            <SubHeading>Expanded campaign view</SubHeading>
            <DocTable
              headers={["What you see", "What it tells you"]}
              rows={[
                [<strong className="text-on-surface">7-Day Trend charts</strong>, "Is each KPI improving (↑) or getting worse (↓) over the last 7 days? The percentage shows by how much."],
                [<strong className="text-on-surface">KPI Breakdown</strong>, "Which specific KPIs are on or off target for this one campaign"],
                [<strong className="text-on-surface">Budget Pacing</strong>, "Is this individual campaign over or underspending its budget estimate?"],
                [<strong className="text-on-surface">"Ask Claude about this campaign"</strong>, "Opens the AI chat with a question about this campaign pre-typed for you"],
              ]}
            />
          </section>

          {/* ═══ Section 4: Campaigns ═══ */}
          <section id="campaigns" className="mb-20">
            <SectionTitle icon="campaign" title="Find Any Campaign Instantly" />
            <p className="text-sm text-on-surface-variant leading-relaxed mb-5">
              The Campaigns page is the most powerful view for investigating problems. It shows all 73 campaigns
              with every KPI, and you can slice and filter however you need.
            </p>

            <SubHeading>Search, filter and sort</SubHeading>
            <ul className="space-y-1.5 text-sm text-on-surface-variant mb-5">
              <li className="flex gap-2"><span className="text-primary">•</span><strong className="text-on-surface">Search bar</strong> — start typing any part of a campaign name, results filter as you type</li>
              <li className="flex gap-2"><span className="text-primary">•</span><strong className="text-on-surface">Status filter</strong> — show All campaigns, Active only, or Paused only</li>
              <li className="flex gap-2"><span className="text-primary">•</span><strong className="text-on-surface">Sort</strong> — click any column header to sort, click again to flip the order</li>
            </ul>

            <SubHeading>Sortable columns</SubHeading>
            <DocTable
              headers={["Column", "What it shows", "Best sort for..."]}
              rows={[
                ["Campaign", "Full campaign name", "— Use search instead"],
                ["Period", "Date range this campaign ran", "Newest campaigns first"],
                ["CPC", "Cost per click", "Ascending = cheapest clicks first"],
                ["CTR", "Click-through rate", "Descending = best engagement first"],
                ["CPL", "Cost per lead", "Ascending = cheapest leads first"],
                ["Conv. Rate", "Conversion rate", "Descending = best converters first"],
                ["Spend", "Total spend", "Descending = biggest spenders first"],
                ["Leads", "Total leads generated", "Descending = most leads first"],
              ]}
            />

            <SubHeading>Understanding campaign names</SubHeading>
            <p className="text-sm text-on-surface-variant leading-relaxed mb-3">
              Campaign names follow a structured format that tells you a lot at a glance:
            </p>
            <div className="bg-surface-container rounded-xl p-4 overflow-x-auto mb-3">
              <pre className="text-xs text-on-surface-variant font-mono leading-relaxed whitespace-pre">{`Q1'26 | prod_05 | AMS + EMEA | Consented | GDQA | Lead Gen | Document
  │        │          │            │          │        │          │
Quarter  Product    Region      Audience   Goals   Objective  Format`}</pre>
            </div>
            <p className="text-sm text-on-surface-variant">
              Once you know this pattern, every campaign name becomes readable — you can see
              immediately which product, region, and audience type a campaign targets.
            </p>
          </section>

          {/* ═══ Section 5: Analytics ═══ */}
          <section id="analytics" className="mb-20">
            <SectionTitle icon="analytics" title="Dig Into Trends Over Time" />
            <p className="text-sm text-on-surface-variant leading-relaxed mb-5">
              The Analytics page lets you filter all data by date range and compare campaigns side by side.
              Good for answering questions like "Was February better than January?" or "Which campaign has the best CPC?"
            </p>

            <SubHeading>Date range filter</SubHeading>
            <DocTable
              headers={["Period", "What it covers", "Best for"]}
              rows={[
                [<strong className="text-on-surface">Last 7 Days</strong>, "Feb 25 – Mar 3, 2026", "Spotting very recent changes"],
                [<strong className="text-on-surface">Last 30 Days</strong>, "Feb 1 – Mar 3, 2026", "Monthly trend analysis"],
                [<strong className="text-on-surface">This Month</strong>, "Mar 1–3, 2026", "Current month (only 3 days of data)"],
                [<strong className="text-on-surface">All Time</strong>, "Jan 1 – Mar 3, 2026", "Full picture across the dataset"],
              ]}
            />
            <Tip>
              <strong>Why does "This Month" show so little?</strong> The data covers up to March 3, 2026,
              so "This Month" only has 3 days. Use Last 30 Days or All Time for a fuller view.
            </Tip>

            <SubHeading>Campaign Comparison chart</SubHeading>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Compare up to <strong className="text-on-surface">5 campaigns</strong> side by side on the same chart.
              Type a name in the search box to add a campaign, click its coloured pill to toggle it off,
              and use the KPI buttons in the top right (CPC, CTR, CPL, Conv Rate) to change the metric.
              Hover over any point to see exact values.
            </p>

            <SubHeading>Top & Bottom Performers</SubHeading>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              <strong className="text-on-surface">Top 5</strong> — your best performers. Worth studying and potentially scaling.{" "}
              <strong className="text-on-surface">Bottom 5</strong> — your worst performers. Good candidates for pausing, reducing spend, or optimising.
            </p>
          </section>

          {/* ═══ Section 6: AI Report ═══ */}
          <section id="ai-report" className="mb-20">
            <SectionTitle icon="auto_awesome" title="Your Account Summary in 10 Seconds" />
            <p className="text-sm text-on-surface-variant leading-relaxed mb-5">
              Click <strong className="text-on-surface">✨ Generate AI Report</strong> in the header at any time.
              The AI reads all 73 campaigns, calculates what's happening, and writes a structured summary in plain English.
              It takes 5–10 seconds. This is not a generic summary — it uses your actual numbers.
              It will say things like "CPC at $16.93 is 238% above the $5.00 target" and name specific campaigns.
            </p>

            <SubHeading>What the report covers</SubHeading>
            <DocTable
              headers={["Section", "What you'll read"]}
              rows={[
                [<strong className="text-on-surface">Health Summary</strong>, "2–3 sentences on overall account performance with specific numbers"],
                [<strong className="text-on-surface">Top Performers</strong>, "The 2–3 campaigns doing best, with their metrics and why they stand out"],
                [<strong className="text-on-surface">Underperforming</strong>, "The 2–3 campaigns with the biggest problems, named explicitly with numbers"],
                [<strong className="text-on-surface">Recommendations</strong>, "3 specific actions you can take today, with reasoning"],
              ]}
            />

            <SubHeading>Tips for using the AI Report</SubHeading>
            <ul className="space-y-1.5 text-sm text-on-surface-variant">
              <li className="flex gap-2"><span className="text-primary">•</span><strong className="text-on-surface">Regenerate any time</strong> — click "Regenerate Report" for a fresh analysis</li>
              <li className="flex gap-2"><span className="text-primary">•</span><strong className="text-on-surface">Copy and share</strong> — the report is plain text, paste it into Slack, email, or a client doc</li>
              <li className="flex gap-2"><span className="text-primary">•</span><strong className="text-on-surface">Closing and reopening</strong> the panel keeps the last report — click Regenerate only when you want a new one</li>
            </ul>
          </section>

          {/* ═══ Section 7: Ask AI ═══ */}
          <section id="ask-ai" className="mb-20">
            <SectionTitle icon="chat" title="Ask Questions in Plain English" />
            <p className="text-sm text-on-surface-variant leading-relaxed mb-5">
              Click <strong className="text-on-surface">Ask AI</strong> in the sidebar to open the chat panel.
              Type any question about your campaigns and get an answer in 5–10 seconds.
              The AI has access to all 73 campaigns and all daily data from January 1 to March 3, 2026 —
              that's over 2,700 data points it can search through instantly.
            </p>

            <SubHeading>What you can ask</SubHeading>
            <p className="text-sm text-on-surface-variant leading-relaxed mb-4">
              You don't need special phrasing. Ask the way you'd ask a colleague:
            </p>
            <DocTable
              headers={["Question type", "Example you can type"]}
              rows={[
                ["Performance summary", <code className="bg-surface-container-high px-1.5 py-0.5 rounded text-xs">Give me a full analysis of the prod_17a AMS+EMEA campaign</code>],
                ["Comparison", <code className="bg-surface-container-high px-1.5 py-0.5 rounded text-xs">Compare prod_05 in AMS vs APJ — which region performs better?</code>],
                ["Ranking", <code className="bg-surface-container-high px-1.5 py-0.5 rounded text-xs">Which 5 campaigns have the lowest CPL?</code>],
                ["Region focus", <code className="bg-surface-container-high px-1.5 py-0.5 rounded text-xs">How are APJ campaigns performing overall?</code>],
                ["Audience question", <code className="bg-surface-container-high px-1.5 py-0.5 rounded text-xs">Are consented audience campaigns outperforming non-consented ones?</code>],
                ["Date lookup", <code className="bg-surface-container-high px-1.5 py-0.5 rounded text-xs">What happened on February 16th across all campaigns?</code>],
                ["Budget question", <code className="bg-surface-container-high px-1.5 py-0.5 rounded text-xs">Which campaigns are overpacing their budget?</code>],
                ["Quick action", <code className="bg-surface-container-high px-1.5 py-0.5 rounded text-xs">Which campaigns should I pause right now and why?</code>],
              ]}
            />

            <SubHeading>Tips for better answers</SubHeading>
            <ul className="space-y-2.5 text-sm text-on-surface-variant">
              <li className="flex gap-2"><span className="text-primary">•</span><span><strong className="text-on-surface">Use dates in this format:</strong>{" "}<code className="bg-surface-container-high px-1.5 py-0.5 rounded text-xs">2026-02-16</code> instead of "February 16th"</span></li>
              <li className="flex gap-2"><span className="text-primary">•</span><span><strong className="text-on-surface">Use region codes:</strong>{" "}<code className="bg-surface-container-high px-1 py-0.5 rounded text-xs">APJ</code>, <code className="bg-surface-container-high px-1 py-0.5 rounded text-xs">AMS</code>, <code className="bg-surface-container-high px-1 py-0.5 rounded text-xs">EMEA</code>, <code className="bg-surface-container-high px-1 py-0.5 rounded text-xs">WW</code></span></li>
              <li className="flex gap-2"><span className="text-primary">•</span><span><strong className="text-on-surface">Use product codes:</strong>{" "}<code className="bg-surface-container-high px-1 py-0.5 rounded text-xs">prod_05</code>, <code className="bg-surface-container-high px-1 py-0.5 rounded text-xs">prod_17a</code>, etc.</span></li>
              <li className="flex gap-2"><span className="text-primary">•</span><span><strong className="text-on-surface">Expand a campaign first</strong> — on the Dashboard or Campaigns page, click any campaign row and then "Ask Claude about this campaign" to get a pre-filled question</span></li>
            </ul>
          </section>

          {/* ═══ Section 8: Alerts ═══ */}
          <section id="alerts" className="mb-20">
            <SectionTitle icon="notifications" title="Get Notified When Something Needs Attention" />
            <p className="text-sm text-on-surface-variant leading-relaxed mb-5">
              CGM Pulse can send you an automatic notification when a campaign breaks through one of your KPI targets.
              Each campaign can only trigger one alert per day maximum, so you won't get flooded.
            </p>

            <SubHeading>Email alerts</SubHeading>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              A branded email showing which campaign triggered the alert, which KPI breached the target,
              the full KPI snapshot for that campaign, and a direct link to open CGM Pulse.
            </p>

            <SubHeading>Slack alerts</SubHeading>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              A formatted message in your chosen Slack channel showing the campaign name, how far off target it is
              (e.g. "611% above the $5.00 target"), all 4 KPIs with status indicators, and buttons to open the dashboard.
            </p>

            <SubHeading>Setting up alerts</SubHeading>
            <ol className="space-y-2 text-sm text-on-surface-variant">
              {[
                <>Go to <strong className="text-on-surface">Settings → Alert Configuration</strong></>,
                "Toggle Email Alerts on and enter your email address",
                "Toggle Slack Alerts on and paste your Slack webhook URL",
                "Check the boxes next to the KPI conditions you want to watch",
                <>Click <strong className="text-on-surface">Save Config</strong></>,
                <>Click <strong className="text-on-surface">Send Test Alert</strong> to verify — you'll get a real alert using your worst campaign's data</>,
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-tertiary font-bold shrink-0 w-6 text-right">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <Tip>
              Alerts are turned off by default in this version because the data is historical and not changing.
              Turn them on when the dashboard is connected to a live, daily-updating data source.
            </Tip>
            <Tip>
              <strong>Current limitation:</strong> Email alerts can only be delivered to the account owner's
              email address. Changing the recipient to a different email will not work until a custom sending
              domain is verified in Resend. Similarly, the Slack webhook URL is pre-configured and cannot be
              changed to a different channel yet. Both will become fully configurable once the domain setup is finalised.
              You can see examples of what the alerts look like in <strong>Settings → Alert Configuration → "What alerts look like"</strong>.
            </Tip>
          </section>

          {/* ═══ Section 9: Settings ═══ */}
          <section id="settings" className="mb-20">
            <SectionTitle icon="settings" title="Customise How CGM Pulse Works for You" />

            <SubHeading>KPI Targets</SubHeading>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Go to <strong className="text-on-surface">Settings → KPI Targets</strong>, update any value, and click{" "}
              <strong className="text-on-surface">Save Targets</strong>. Every colour on every page updates instantly.
              Click <strong className="text-on-surface">Reset to Defaults</strong> to go back to the original targets.
            </p>
            <Tip>
              If you close the browser and the app restarts, your custom targets may reset to defaults.
              Re-entering them takes about 30 seconds. This is a known limitation of this version.
            </Tip>

            <SubHeading>Data Settings</SubHeading>
            <p className="text-sm text-on-surface-variant leading-relaxed mb-4">
              Three pieces of information are shown: your Google Sheet ID, when data was last refreshed, and how many records the AI can search.
            </p>
            <DocTable
              headers={["Button", "What it does", "When to use it"]}
              rows={[
                [<strong className="text-on-surface">Refresh AI Data</strong>, "Updates the AI's campaign knowledge from the Google Sheet (~60 seconds)", "If the Ask AI chat seems to give outdated answers"],
                [<strong className="text-on-surface">Refresh Dashboard</strong>, "Clears the cached data and pulls fresh figures immediately", "If the numbers on the dashboard look stale"],
              ]}
            />
            <p className="text-sm text-on-surface-variant mt-4">
              <strong className="text-on-surface">Auto-refresh interval</strong> — choose how often the dashboard checks for new data:
              Off, every 30 minutes, every hour, or every 4 hours.
            </p>
          </section>

          {/* ═══ Section 10: FAQ ═══ */}
          <section id="faq" className="mb-20">
            <SectionTitle icon="help" title="Frequently Asked Questions" />
            <div className="space-y-2">
              {FAQ_ITEMS.map((item, i) => {
                const isOpen = faqOpen === i;
                return (
                  <div key={i} className="bg-surface-container rounded-xl border border-outline-variant/10 overflow-hidden">
                    <button
                      onClick={() => setFaqOpen(isOpen ? null : i)}
                      className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
                      aria-expanded={isOpen}
                    >
                      <span className="text-sm font-semibold text-on-surface">{item.q}</span>
                      <span className="material-symbols-outlined text-on-surface-variant shrink-0 text-lg transition-transform duration-200" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                        expand_more
                      </span>
                    </button>
                    <div className={`grid transition-[grid-template-rows] duration-200 ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                      <div className="overflow-hidden">
                        <p className="px-5 pb-4 text-sm text-on-surface-variant leading-relaxed">{item.a}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
