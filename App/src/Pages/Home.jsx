import { useEffect, useRef, useState } from "react";
import { AiFillGithub, AiFillLinkedin, AiOutlineMail, AiOutlineArrowRight, AiOutlineArrowDown } from "react-icons/ai";
import {
  SiPython, SiPhp, SiJavascript, SiReact, SiLaravel, SiDocker, SiTerraform,
  SiAmazonaws, SiPostgresql, SiFlutter, SiAwslambda, SiMysql,
} from "react-icons/si";
import pic from "../assets/Me.jpg";
import { Link } from "../Utils/Link";
import { useDocumentTitle } from "../Utils/router";
import Footer from "./components/Footer";
import {
  PROFILE, DOING, WORK, LAB, SIDE_PROJECTS, STACK, SOLVING, ACHIEVEMENTS,
} from "./home/data.js";
import "./home/home.css";

const INNER_ORBIT = [
  { Icon: SiPython, name: "Python" },
  { Icon: SiPhp, name: "PHP" },
  { Icon: SiJavascript, name: "JavaScript" },
  { Icon: SiReact, name: "React" },
];
const OUTER_ORBIT = [
  { Icon: SiAmazonaws, name: "AWS" },
  { Icon: SiLaravel, name: "Laravel" },
  { Icon: SiDocker, name: "Docker" },
  { Icon: SiTerraform, name: "Terraform" },
  { Icon: SiAwslambda, name: "Lambda" },
  { Icon: SiPostgresql, name: "PostgreSQL" },
  { Icon: SiFlutter, name: "Flutter" },
  { Icon: SiMysql, name: "MySQL" },
];

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// ---------- hooks ----------

// Types each phrase out, holds, deletes, moves on. With reduced motion it
// just swaps whole phrases.
function useTypewriter(phrases) {
  const [state, setState] = useState({ i: 0, len: 0, deleting: false });

  useEffect(() => {
    const phrase = phrases[state.i];
    if (prefersReducedMotion()) {
      // Show whole phrases, swapping every few seconds.
      if (state.len < phrase.length) {
        const t = setTimeout(() => setState((s) => ({ ...s, len: phrases[s.i].length })), 0);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setState((s) => {
        const i = (s.i + 1) % phrases.length;
        return { i, len: phrases[i].length, deleting: false };
      }), 3000);
      return () => clearTimeout(t);
    }
    let delay = state.deleting ? 28 : 55;
    if (!state.deleting && state.len === phrase.length) delay = 1800;
    const t = setTimeout(() => {
      setState((s) => {
        const p = phrases[s.i];
        if (!s.deleting && s.len < p.length) return { ...s, len: s.len + 1 };
        if (!s.deleting) return { ...s, deleting: true };
        if (s.len > 0) return { ...s, len: s.len - 1 };
        return { i: (s.i + 1) % phrases.length, len: 0, deleting: false };
      });
    }, delay);
    return () => clearTimeout(t);
  }, [state, phrases]);

  return phrases[state.i].slice(0, state.len);
}

// Adds .is-visible to every .reveal under `ref` as it scrolls into view.
function useReveal(ref) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = root.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ref]);
}

function scrollToId(e, id) {
  const el = document.getElementById(id);
  if (!el) return;
  e.preventDefault();
  el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}

// ---------- pieces ----------

function SectionLabel({ index, children }) {
  return (
    <p className="text-xs tracking-[0.2em] uppercase text-tk-text-dim mb-3">
      <span className="text-tk-accent">{index}</span> / {children}
    </p>
  );
}

function TopBar() {
  const anchors = [
    ["work", "Work"],
    ["lab", "Lab"],
    ["stack", "Stack"],
    ["contact", "Contact"],
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-tk-border/60 bg-tk-bg/75 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 py-3 text-sm">
        <a href="#top" onClick={(e) => scrollToId(e, "top")} className="text-tk-text hover:text-tk-accent">
          <span className="text-tk-accent">anik</span>@orbit<span className="text-tk-text-dim">:~$</span>
        </a>
        <div className="flex items-center gap-4 sm:gap-6">
          {anchors.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => scrollToId(e, id)}
              className="hidden md:inline text-tk-text-dim hover:text-tk-accent transition-colors"
            >
              {label}
            </a>
          ))}
          <span className="hidden md:inline h-4 w-px bg-tk-border" />
          <Link to="/toolz" className="text-tk-text-dim hover:text-tk-accent transition-colors">Toolz</Link>
          <Link to="/games" className="text-tk-text-dim hover:text-tk-accent transition-colors">Games</Link>
        </div>
      </nav>
    </header>
  );
}

function Orbit() {
  const ring = (items, rFactor) =>
    items.map(({ Icon, name }, i) => (
      <div
        key={name}
        className="orbit-item"
        style={{ "--a": `${(360 / items.length) * i}deg`, "--r": `calc(var(--size) * ${rFactor})` }}
      >
        <span title={name} aria-label={name}>
          <Icon />
        </span>
      </div>
    ));

  return (
    <div className="orbit" aria-hidden="true">
      <div className="home-glow absolute inset-[-15%] rounded-full" />
      <div className="orbit-ring inset-0" style={{ "--speed": "80s" }}>
        {ring(OUTER_ORBIT, 0.5)}
      </div>
      <div className="orbit-ring reverse inset-[19%]" style={{ "--speed": "50s" }}>
        {ring(INNER_ORBIT, 0.31)}
      </div>
      <div className="absolute inset-[33%] rounded-full p-1 bg-gradient-to-br from-tk-accent via-tk-border to-tk-info">
        <img src={pic} alt="" className="h-full w-full rounded-full object-cover bg-tk-surface" />
      </div>
    </div>
  );
}

function Hero() {
  const typed = useTypewriter(DOING);
  return (
    <section id="top" className="relative overflow-hidden scroll-mt-20">
      <div className="home-grid pointer-events-none absolute inset-0" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 pt-14 pb-20 md:pt-24 md:pb-28 lg:grid-cols-[1.25fr_1fr]">
        <div>
          <p className="mb-6 text-xs sm:text-sm text-tk-text-dim">
            <span className="text-tk-accent">{"//"}</span> {PROFILE.role.toLowerCase()} @{" "}
            <a href={PROFILE.company.url} className="text-tk-text hover:text-tk-accent underline decoration-tk-border underline-offset-4">
              {PROFILE.company.name}
            </a>
          </p>
          <h1 className="font-tk-display text-6xl leading-[0.95] sm:text-7xl md:text-8xl text-tk-text">
            {PROFILE.name.split(" ")[0]}
            <br />
            <span className="italic text-tk-accent">{PROFILE.name.split(" ")[1]}.</span>
          </h1>
          <p className="mt-8 min-h-[3.5em] sm:min-h-[2em] text-lg sm:text-xl text-tk-text" aria-live="off">
            <span className="text-tk-text-dim">I build </span>
            {typed}
            <span className="caret" aria-hidden="true" />
          </p>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-tk-text-dim">{PROFILE.summary}</p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <a
              href="#work"
              onClick={(e) => scrollToId(e, "work")}
              className="group inline-flex items-center gap-2 rounded-tk bg-tk-accent px-5 py-3 text-sm font-bold text-black hover:shadow-[0_0_24px_rgba(0,255,136,0.45)] transition-shadow"
            >
              See the work
              <AiOutlineArrowDown className="transition-transform group-hover:translate-y-0.5" />
            </a>
            <IconLink href={PROFILE.github} label="GitHub"><AiFillGithub /></IconLink>
            <IconLink href={PROFILE.linkedin} label="LinkedIn"><AiFillLinkedin /></IconLink>
            <IconLink href={`mailto:${PROFILE.email}`} label="Email"><AiOutlineMail /></IconLink>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <Orbit />
        </div>
      </div>
    </section>
  );
}

function IconLink({ href, label, children }) {
  return (
    <a
      href={href}
      title={label}
      aria-label={label}
      className="inline-flex h-11 w-11 items-center justify-center rounded-tk border border-tk-border text-xl text-tk-text hover:border-tk-accent hover:text-tk-accent transition-colors"
    >
      {children}
    </a>
  );
}

function Stats() {
  const stats = [
    { value: String(WORK.length).padStart(2, "0"), label: `systems built or maintained at ${PROFILE.company.name}` },
    { value: PROFILE.since, label: "writing production code since" },
    { value: "1528", label: "peak CodeChef rating" },
    { value: "Finalist", label: "CodeSamurai Hackathon 2024" },
  ];
  return (
    <section className="border-y border-tk-border bg-tk-surface/60">
      <dl className="mx-auto grid max-w-6xl grid-cols-2 md:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`reveal px-4 sm:px-6 py-6 border-tk-border ${i % 2 ? "border-l" : ""} ${i > 1 ? "border-t md:border-t-0" : ""} ${i === 2 ? "md:border-l" : ""}`}
            style={{ transitionDelay: `${i * 80}ms` }}
          >
            <dt className="sr-only">{s.label}</dt>
            <dd className="font-tk-display text-3xl sm:text-4xl text-tk-text">{s.value}</dd>
            <dd className="mt-1 text-xs text-tk-text-dim">{s.label}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Pipeline({ flow }) {
  return (
    <div className="flex flex-col md:flex-row md:items-stretch">
      {flow.map((node, i) => (
        <div key={node.label} className="contents">
          {i > 0 && <span className="flow-link" style={{ "--d": `${i * 0.35}s` }} />}
          <div
            className="flow-node relative rounded-tk border border-tk-border bg-tk-surface2 px-4 py-3 md:w-0 md:flex-[2_1_0]"
            style={{ "--d": `${i * 0.08}s` }}
          >
            <span className="absolute right-2 top-1.5 text-[10px] text-tk-text-dim">0{i + 1}</span>
            <p className="text-sm font-bold text-tk-accent">{node.label}</p>
            <p className="mt-1 text-xs leading-snug text-tk-text-dim">{node.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Work() {
  const [active, setActive] = useState(0);
  const tabs = useRef([]);
  const item = WORK[active];

  const onKey = (e) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = (active + step + WORK.length) % WORK.length;
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <section id="work" className="mx-auto max-w-6xl px-4 sm:px-6 py-20 md:py-28 scroll-mt-16">
      <div className="reveal mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionLabel index="01">Work</SectionLabel>
          <h2 className="font-tk-display text-4xl sm:text-5xl text-tk-text">
            Systems I&apos;ve <span className="italic text-tk-accent">shipped</span>
          </h2>
        </div>
        <p className="max-w-sm text-sm text-tk-text-dim">
          At {PROFILE.company.name}, {PROFILE.since} to now. Pick one to see how data moves through it.
        </p>
      </div>

      <div className="reveal grid gap-6 lg:grid-cols-[minmax(0,20rem)_1fr]">
        <div
          role="tablist"
          aria-label="Projects"
          aria-orientation="vertical"
          onKeyDown={onKey}
          className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0"
        >
          {WORK.map((w, i) => {
            const on = i === active;
            return (
              <button
                key={w.id}
                ref={(el) => (tabs.current[i] = el)}
                role="tab"
                id={`work-tab-${w.id}`}
                aria-selected={on}
                aria-controls="work-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => setActive(i)}
                className={`group flex shrink-0 items-baseline gap-3 rounded-tk border px-3 py-2 text-left text-sm transition-colors lg:border-0 lg:border-l-2 lg:rounded-none lg:px-4 lg:py-3 ${
                  on
                    ? "border-tk-accent text-tk-text lg:bg-tk-accent/5"
                    : "border-tk-border text-tk-text-dim hover:text-tk-text lg:border-tk-border"
                }`}
              >
                <span className={`text-xs ${on ? "text-tk-accent" : ""}`}>{String(i + 1).padStart(2, "0")}</span>
                <span className="whitespace-nowrap lg:whitespace-normal">{w.title}</span>
              </button>
            );
          })}
        </div>

        <article
          id="work-panel"
          style={{ minWidth: 0 }}
          role="tabpanel"
          aria-labelledby={`work-tab-${item.id}`}
          className="relative rounded-tk border border-tk-border bg-tk-surface p-5 sm:p-8"
        >
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-tk-display text-2xl sm:text-3xl text-tk-text">{item.title}</h3>
            <span className="text-xs uppercase tracking-widest text-tk-accent">{item.kind}</span>
          </div>

          <Pipeline key={item.id} flow={item.flow} />

          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-tk-text">{item.blurb}</p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {item.tech.map((t) => (
              <li key={t} className="rounded-tk border border-tk-border px-2 py-1 text-xs text-tk-text-dim">
                {t}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}

function Lab() {
  return (
    <section id="lab" className="border-t border-tk-border bg-tk-surface/40 scroll-mt-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 md:py-28">
        <div className="reveal mb-10 grid gap-4 md:grid-cols-2 md:items-end">
          <div>
            <SectionLabel index="02">Lab</SectionLabel>
            <h2 className="font-tk-display text-4xl sm:text-5xl text-tk-text">
              This site is my <span className="italic text-tk-accent">playground</span>
            </h2>
          </div>
          <p className="text-sm text-tk-text-dim md:text-right">
            I built every tool and game here myself: WebRTC peer-to-peer rooms, sandboxed code execution,
            IndexedDB sync and a WebGL shooter. No game server behind any of it.
          </p>
        </div>

        <div className="grid gap-px overflow-hidden rounded-tk border border-tk-border bg-tk-border sm:grid-cols-2 lg:grid-cols-3">
          {LAB.map((l, i) => (
            <Link
              key={l.to}
              to={l.to}
              className="reveal group relative bg-tk-bg p-6 transition-colors hover:bg-tk-surface2"
              style={{ transitionDelay: `${(i % 3) * 70}ms` }}
            >
              <div className="flex items-start justify-between">
                <span className="text-2xl" aria-hidden="true">{l.icon}</span>
                <AiOutlineArrowRight className="text-tk-text-dim transition-all group-hover:translate-x-1 group-hover:text-tk-accent" />
              </div>
              <p className="mt-4 font-bold text-tk-text group-hover:text-tk-accent">{l.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-tk-text-dim">{l.desc}</p>
            </Link>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link to="/toolz" className="text-tk-text-dim hover:text-tk-accent">All tools →</Link>
          <Link to="/games" className="text-tk-text-dim hover:text-tk-accent">All games →</Link>
          <Link to="/white-board" className="text-tk-text-dim hover:text-tk-accent">White board →</Link>
        </div>

        <div className="reveal mt-16">
          <p className="mb-4 text-xs uppercase tracking-[0.2em] text-tk-text-dim">Earlier projects</p>
          <div className="grid gap-4 md:grid-cols-3">
            {SIDE_PROJECTS.map((p) => {
              const Tag = p.href ? "a" : "div";
              return (
                <Tag
                  key={p.title}
                  {...(p.href ? { href: p.href } : {})}
                  className={`rounded-tk border border-tk-border p-5 ${p.href ? "group hover:border-tk-accent transition-colors" : ""}`}
                >
                  <p className="font-bold text-tk-text group-hover:text-tk-accent">
                    {p.title} {p.href && <span className="text-tk-text-dim">↗</span>}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-tk-text-dim">{p.desc}</p>
                  <p className="mt-3 text-[11px] text-tk-accent/80">{p.tech.join(" · ")}</p>
                </Tag>
              );
            })}
          </div>
          <Link
            to="/projects"
            className="mt-6 inline-flex items-center gap-2 rounded-tk border border-tk-accent px-4 py-2 text-sm text-tk-accent hover:bg-tk-accent hover:text-black transition-colors"
          >
            All projects <AiOutlineArrowRight />
          </Link>
        </div>
      </div>
    </section>
  );
}

// The stack rendered as a YAML file.
function Stack() {
  const key = (s) => s.toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "");
  return (
    <section id="stack" className="mx-auto max-w-6xl px-4 sm:px-6 py-20 md:py-28 scroll-mt-16">
      <div className="grid gap-12 lg:grid-cols-2">
        <div className="reveal min-w-0">
          <SectionLabel index="03">Stack</SectionLabel>
          <h2 className="mb-8 font-tk-display text-4xl sm:text-5xl text-tk-text">
            What I <span className="italic text-tk-accent">reach for</span>
          </h2>
          <div className="overflow-hidden rounded-tk border border-tk-border bg-tk-surface">
            <div className="flex items-center gap-2 border-b border-tk-border px-4 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-tk-accent2/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-tk-accent3/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-tk-accent/70" />
              <span className="ml-2 text-xs text-tk-text-dim">stack.yml</span>
            </div>
            <div className="overflow-x-auto">
              <pre className="whitespace-pre-wrap p-4 text-[13px] leading-7">
                {STACK.map((s, i) => (
                  <div key={s.group} className="flex">
                    <span className="mr-4 w-5 shrink-0 select-none text-right text-tk-text-dim/60">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="text-tk-info">{key(s.group)}</span>
                      <span className="text-tk-text-dim">: [</span>
                      {s.items.map((it, j) => (
                        <span key={it}>
                          <span className="text-tk-accent">{it}</span>
                          {j < s.items.length - 1 && <span className="text-tk-text-dim">, </span>}
                        </span>
                      ))}
                      <span className="text-tk-text-dim">]</span>
                    </span>
                  </div>
                ))}
              </pre>
            </div>
          </div>
        </div>

        <div className="reveal min-w-0" style={{ transitionDelay: "120ms" }}>
          <SectionLabel index="04">Off the clock</SectionLabel>
          <h2 className="mb-8 font-tk-display text-4xl sm:text-5xl text-tk-text">
            Problem <span className="italic text-tk-accent">solving</span>
          </h2>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-tk border border-tk-border bg-tk-border">
            {SOLVING.map((s) => {
              const Tag = s.href ? "a" : "div";
              return (
                <Tag
                  key={s.site}
                  {...(s.href ? { href: s.href } : {})}
                  className="group min-w-0 bg-tk-surface p-3 sm:p-4 transition-colors hover:bg-tk-surface2"
                >
                  <p className="text-xs text-tk-text-dim group-hover:text-tk-accent">{s.site}</p>
                  <p className="mt-2 font-tk-display text-2xl sm:text-3xl text-tk-text">{s.value}</p>
                  <p className="text-[11px] text-tk-text-dim">{s.note}</p>
                </Tag>
              );
            })}
          </div>

          <ol className="mt-8 border-l border-tk-border">
            {ACHIEVEMENTS.map((a) => (
              <li key={a.text} className="relative pb-6 pl-6 last:pb-0">
                <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border border-tk-accent bg-tk-bg" />
                <p className="text-xs text-tk-accent">{a.year}</p>
                <p className="mt-1 text-sm text-tk-text">{a.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Contact() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(PROFILE.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.location.href = `mailto:${PROFILE.email}`;
    }
  };
  return (
    <section id="contact" className="relative overflow-hidden border-t border-tk-border scroll-mt-16">
      <div className="home-glow pointer-events-none absolute left-1/2 top-full h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/2" />
      <div className="reveal relative mx-auto max-w-4xl px-4 sm:px-6 py-24 md:py-32 text-center">
        <SectionLabel index="05">Contact</SectionLabel>
        <h2 className="font-tk-display text-4xl sm:text-6xl leading-tight text-tk-text">
          Got a process that should <span className="italic text-tk-accent">run itself?</span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-sm text-tk-text-dim">
          I&apos;m happy to talk about automation, backend systems, AI integrations, or anything you saw on this site.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <a
            href={`mailto:${PROFILE.email}`}
            className="rounded-tk bg-tk-accent px-5 py-3 text-sm font-bold text-black hover:shadow-[0_0_24px_rgba(0,255,136,0.45)] transition-shadow"
          >
            {PROFILE.email}
          </a>
          <button
            type="button"
            onClick={copy}
            className="rounded-tk border border-tk-border px-4 py-3 text-sm text-tk-text-dim hover:border-tk-accent hover:text-tk-accent transition-colors"
          >
            {copied ? "copied ✓" : "copy"}
          </button>
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <IconLink href={PROFILE.github} label="GitHub"><AiFillGithub /></IconLink>
          <IconLink href={PROFILE.linkedin} label="LinkedIn"><AiFillLinkedin /></IconLink>
        </div>
      </div>
    </section>
  );
}

// ---------- page ----------

const Home = () => {
  useDocumentTitle("About Anik");
  const root = useRef(null);
  useReveal(root);

  return (
    <div ref={root} className="home min-h-screen bg-tk-bg font-tk-mono text-tk-text">
      <TopBar />
      <main>
        <Hero />
        <Stats />
        <Work />
        <Lab />
        <Stack />
        <Contact />
      </main>
      <Footer />
    </div>
  );
};

export default Home;
