import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Headphones,
  MapPin,
  QrCode,
  Ticket,
} from "lucide-react";

import stadiumImage from "../assets/mogadishu_stadium.jpg";
import stadiumLogo from "../assets/stadium_logo.png";

const capabilities = [
  { icon: CalendarDays, title: "Events", text: "Approved fixtures and stadium activities in one schedule." },
  { icon: Ticket, title: "Digital passes", text: "Secure purchases and QR tickets ready at the gate." },
  { icon: QrCode, title: "Matchday entry", text: "Fast staff validation with a permanent scan history." },
  { icon: BarChart3, title: "Operations", text: "Live revenue, attendance, and stadium activity reporting." },
];

const ticketSteps = [
  { number: "01", title: "Choose an event", text: "Browse approved upcoming fixtures and select the match you want to attend." },
  { number: "02", title: "Select your pass", text: "Choose a Normal or VIP seat and complete secure checkout." },
  { number: "03", title: "Receive your QR", text: "Your paid digital pass appears in your customer dashboard." },
  { number: "04", title: "Enter the stadium", text: "Show the QR pass to authorized staff for one-time gate validation." },
];

const faqs = [
  { question: "Where will I find my ticket?", answer: "After successful payment, your QR ticket appears in Passes inside the customer dashboard." },
  { question: "What happens if payment succeeds but my ticket is missing?", answer: "Open Support in your dashboard. The chatbot checks your latest payment record and automatically creates a staff case when investigation is needed." },
  { question: "Can I request a refund?", answer: "Paid, unused tickets may be reviewed for refund. Used tickets and manual tickets cannot be refunded." },
  { question: "Can customers scan their own tickets?", answer: "No. Ticket scanning is restricted to authorized staff with an active scanning duty." },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <main className="min-h-screen bg-stadium-50 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Brand />

          <nav className="hidden items-center gap-1 md:flex">
            <a href="#events" className="landing-nav-link">Events</a>
            <a href="#platform" className="landing-nav-link">Platform</a>
            <a href="#faq" className="landing-nav-link">FAQ</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/login" className="btn-secondary hidden px-4 py-2 sm:inline-flex">Sign in</Link>
            <Link to="/register" className="btn-primary w-auto px-4 py-2">Create account</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-3 pt-3 sm:px-6 sm:pt-5 lg:px-8">
        <div className="relative min-h-[520px] overflow-hidden rounded-lg border border-slate-200 bg-slate-900 shadow-sm sm:min-h-[590px]">
          <img
            src={stadiumImage}
            alt="Mogadishu Stadium football field"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/62 to-slate-950/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-transparent to-transparent" />

          <div className="relative z-10 flex min-h-[520px] max-w-2xl flex-col justify-center px-6 py-16 text-white sm:min-h-[590px] sm:px-12 lg:px-16">
            <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase text-sky-200">
              <MapPin className="h-4 w-4" />
              Mogadishu, Somalia
            </div>
            <h1 className="text-4xl font-bold leading-tight sm:text-6xl">Mogadishu Stadium</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-200 sm:text-lg">
              One connected platform for stadium events, digital tickets, secure gate entry, and matchday operations.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/login" className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400">
                Browse events
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="/login" className="inline-flex items-center rounded-lg border border-white/35 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20">
                Open your portal
              </a>
            </div>
          </div>

          
        </div>
      </section>

      

      <section id="platform" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Stadium platform"
          title="Built around the way matchday actually works."
          text="The same clear interface connects visitors, gate staff, and stadium administrators."
        />
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {capabilities.map(({ icon: Icon, title, text }) => (
            <article key={title} className="dashboard-panel p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-bold text-slate-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
            </article>
          ))}
        </div>
      </section>

    

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Ticket journey"
            title="From fixture to gate in four clear steps."
            text="The customer flow stays simple while the system handles payment confirmation and secure entry."
          />
          <div className="mt-7 grid gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 md:grid-cols-4">
            {ticketSteps.map((step) => (
              <article key={step.number} className="bg-white p-5">
                <span className="text-xs font-bold text-sky-600">{step.number}</span>
                <h3 className="mt-5 font-bold text-slate-950">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:px-8">
        <div className="dashboard-panel bg-slate-950 p-6 text-white">
          <p className="text-sm font-semibold text-sky-300">Ticket pricing</p>
          <h2 className="mt-2 text-2xl font-bold">Simple passes, no hidden tiers.</h2>
          <div className="mt-7 grid grid-cols-2 gap-3">
            <Price label="Normal" value="$1.00" />
            <Price label="VIP" value="$3.00" />
          </div>
          <p className="mt-5 text-xs leading-5 text-slate-300">
            Refund requests are reviewed by support. Paid unused tickets may qualify; used and manual tickets do not.
          </p>
        </div>

        <div id="faq" className="dashboard-panel p-6">
          <p className="text-sm font-semibold text-sky-600">Frequently asked questions</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">Useful answers before matchday.</h2>
          <div className="mt-5 divide-y divide-slate-200">
            {faqs.map((item, index) => {
              const isOpen = openFaq === index;
              return (
              <div key={item.question} className="py-4">
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 text-left text-sm font-semibold text-slate-900"
                >
                  {item.question}
                  <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{item.answer}</p>}
              </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="stadium" className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1fr] lg:items-center lg:px-8">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
          <img src={stadiumImage} alt="Mogadishu Stadium pitch" className="aspect-[16/10] w-full rounded-md object-cover" />
        </div>
        <div>
          <p className="text-sm font-semibold text-sky-600">Mogadishu Stadium operations</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-950">Ready from event approval to final gate scan.</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Customers find approved events and buy passes. Staff receive clear duties and validate entry. Administrators see the complete operational picture.
          </p>
          <div className="mt-6 space-y-3">
            {["Real event and ticket information", "Permission-controlled staff scanning", "Support escalation from chatbot to admin"].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm font-medium text-slate-700">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-sky-600" />
                {item}
              </div>
            ))}
          </div>
          
        </div>
      </section>

      <section className="border-t border-slate-200 bg-sky-50">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-4 py-10 sm:px-6 md:flex-row md:items-center lg:px-8">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white">
              <Headphones className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-950">Need help with a ticket or payment?</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">The support chatbot answers first, then creates a staff case when human action is needed.</p>
            </div>
          </div>
          <Link to="/login" className="btn-primary w-auto shrink-0 px-5 py-2.5">
            Open support
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex min-h-40 max-w-7xl flex-col justify-between gap-6 px-4 py-9 sm:px-6 md:flex-row md:items-center lg:px-8">
          <Brand large />
          <div className="max-w-md md:text-right">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 md:justify-end">
              <Headphones className="h-5 w-5 text-sky-600" />
              Stadium support
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Get chatbot answers and human support inside the customer portal.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Brand({ large = false }) {
  return (
    <Link to="/" className="flex items-center gap-3">
      <img
        src={stadiumLogo}
        alt="Somali Football Federation logo"
        className={`${large ? "h-[80px] w-[80px]" : "h-[70px] w-[70px]"} shrink-0 object-contain`}
      />
      <span>
        <span className={`block font-bold text-slate-950 ${large ? "text-lg" : "text-sm"}`}>Mogadishu Stadium</span>
        <span className={`block font-medium text-slate-500 ${large ? "mt-1 text-xs" : "text-[11px]"}`}>Ticketing and operations</span>
      </span>
    </Link>
  );
}

function Price({ label, value }) {
  return (
    <div className="rounded-lg border border-white/15 bg-white/10 p-4">
      <p className="text-xs font-semibold text-slate-300">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function SectionHeading({ eyebrow, title, text }) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold text-sky-600">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-500">{text}</p>
    </div>
  );
}
