'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Ruler,
  LayoutGrid,
  Sparkles,
  PencilRuler,
  BrainCircuit,
  Layers,
  MousePointerSquareDashed,
  Box,
  Calculator,
  MessageSquareCode,
  BookOpen,
  Share2,
  Check,
  ArrowRight,
  Menu,
  Compass,
  ShieldAlert,
  Twitter,
  Github,
  Linkedin,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { useApp } from '@/lib/store';
import { TEMPLATES } from '@/lib/templates';
import type { ProjectTemplate } from '@/lib/types';
import { Brand } from '@/components/openblueprint/brand';
import { MiniPlan } from '@/components/openblueprint/mini-plan';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';
import { VisuallyHidden } from './a11y';

import { demoLayout } from './demo-layout';
import { IsometricHouse } from './isometric-house';

/* ============================================================
 * Landing — OpenBlueprint landing page
 * ============================================================ */

export function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <Features />
        <Templates />
        <Pricing />
        <About />
        <Disclaimer />
      </main>
      <Footer />
    </div>
  );
}

export default Landing;

/* ============================================================
 * Reusable animation wrapper
 * ============================================================ */

function FadeIn({
  children,
  className,
  delay = 0,
  y = 20,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

/* ============================================================
 * Header
 * ============================================================ */

const NAV_LINKS = [
  { label: 'Home', href: '#top' },
  { label: 'How It Works', href: '#how' },
  { label: 'Features', href: '#features' },
  { label: 'Templates', href: '#templates' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'About', href: '#about' },
];

function Header() {
  const setView = useApp((s) => s.setView);
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Brand */}
          <a href="#top" className="flex items-center" aria-label="OpenBlueprint home">
            <Brand size={30} />
          </a>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md"
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* Desktop actions */}
          <div className="hidden lg:flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setView({ name: 'dashboard' })}>
              Sign In
            </Button>
            <Button size="sm" onClick={() => setView({ name: 'wizard' })}>
              Create Blueprint
              <ArrowRight className="size-3.5" />
            </Button>
          </div>

          {/* Mobile nav trigger */}
          <div className="lg:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Open menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <VisuallyHidden>
                  <SheetTitle>Navigation</SheetTitle>
                </VisuallyHidden>
                <div className="flex flex-col gap-6 p-6 pt-8">
                  <Brand size={28} />
                  <nav className="flex flex-col gap-1">
                    {NAV_LINKS.map((l) => (
                      <SheetClose asChild key={l.href}>
                        <a
                          href={l.href}
                          className="px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                        >
                          {l.label}
                        </a>
                      </SheetClose>
                    ))}
                  </nav>
                  <div className="flex flex-col gap-2 mt-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setOpen(false);
                        setView({ name: 'dashboard' });
                      }}
                    >
                      Sign In
                    </Button>
                    <Button
                      onClick={() => {
                        setOpen(false);
                        setView({ name: 'wizard' });
                      }}
                    >
                      Create Blueprint
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ============================================================
 * Hero
 * ============================================================ */

function Hero() {
  const setView = useApp((s) => s.setView);
  const [tab, setTab] = useState<'2d' | '3d'>('2d');

  return (
    <section id="top" className="relative scroll-mt-20 overflow-hidden">
      {/* Subtle blueprint grid backdrop behind hero */}
      <div className="absolute inset-0 -z-10 bp-grid opacity-40" aria-hidden />
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-background/80 to-background"
        aria-hidden
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex justify-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-70" />
              <span className="relative inline-flex size-2 rounded-full bg-cyan" />
            </span>
            AI-Powered Architectural Planning
          </div>
        </motion.div>

        {/* H1 */}
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
          className="mt-6 text-center mx-auto max-w-4xl text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          From Measurements to
          <br className="hidden sm:block" />{' '}
          <span className="text-primary">Intelligent</span>{' '}
          <span className="text-cyan">Blueprints</span>.
        </motion.h1>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.12 }}
          className="mt-6 text-center mx-auto max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed"
        >
          Design smarter spaces with AI-assisted planning. Enter your plot dimensions, define your
          requirements, and generate editable preliminary floor plans in minutes.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.18 }}
          className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Button size="lg" className="w-full sm:w-auto" onClick={() => setView({ name: 'wizard' })}>
            Create Your Blueprint
            <ArrowRight className="size-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setView({ name: 'dashboard' })}
          >
            Explore Demo
          </Button>
        </motion.div>

        {/* Split-screen workspace card */}
        <FadeIn delay={0.1} className="mt-14 lg:mt-16">
          <Card className="overflow-hidden p-0 gap-0 shadow-xl border-border/80">
            {/* Tab bar */}
            <div className="flex items-center justify-between border-b border-border bg-card/50 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-destructive/60" />
                <span className="size-2 rounded-full bg-amber-soft/80" />
                <span className="size-2 rounded-full bg-cyan/80" />
                <span className="ml-2 text-xs text-muted-foreground tech-num">
                  project.obp · 2BHK · 30×40
                </span>
              </div>
              <div className="inline-flex items-center rounded-md border border-border bg-background p-0.5 text-xs font-medium">
                <button
                  onClick={() => setTab('2d')}
                  className={cn(
                    'px-3 py-1 rounded-sm transition-colors',
                    tab === '2d'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  2D Plan
                </button>
                <button
                  onClick={() => setTab('3d')}
                  className={cn(
                    'px-3 py-1 rounded-sm transition-colors',
                    tab === '3d'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  3D View
                </button>
              </div>
            </div>

            {/* Split view */}
            <div className="flex flex-col lg:flex-row min-h-[320px] sm:min-h-[420px]">
              {/* 2D side */}
              <div
                className={cn(
                  'relative overflow-hidden border-b lg:border-b-0 lg:border-r border-border bp-grid transition-all duration-500 ease-in-out',
                  'w-full',
                  tab === '2d'
                    ? 'lg:w-[65%] lg:opacity-100'
                    : 'lg:w-[35%] opacity-60 lg:opacity-45',
                )}
              >
                <div className="p-4 sm:p-6 flex items-center justify-center h-full min-h-[280px]">
                  <MiniPlan layout={demoLayout} className="w-full max-w-md h-auto" />
                </div>

                {/* Floating measurement labels (2D) */}
                <FloatLabel className="top-3 left-3" tone="navy">
                  30 × 40 ft
                </FloatLabel>
                <FloatLabel className="bottom-3 right-3" tone="navy">
                  1,200 sq.ft
                </FloatLabel>
                <FloatLabel className="top-1/2 -translate-y-1/2 left-3" tone="cyan">
                  12′ × 14′
                </FloatLabel>

                {/* North arrow (2D) */}
                <NorthArrow className="absolute top-3 right-3" />
              </div>

              {/* 3D side */}
              <div
                className={cn(
                  'relative overflow-hidden bg-card transition-all duration-500 ease-in-out',
                  'w-full',
                  tab === '3d'
                    ? 'lg:w-[65%] lg:opacity-100'
                    : 'lg:w-[35%] opacity-60 lg:opacity-45',
                )}
              >
                <div className="p-4 sm:p-6 flex items-center justify-center h-full min-h-[280px]">
                  <IsometricHouse className="w-full max-w-md h-auto" />
                </div>

                {/* Floating measurement labels (3D) */}
                <FloatLabel className="top-3 left-3" tone="navy">
                  G+1 Storey
                </FloatLabel>
                <FloatLabel className="bottom-3 left-3" tone="cyan">
                  Modern · Vastu-aware
                </FloatLabel>
              </div>
            </div>

            {/* Status bar */}
            <div className="flex items-center justify-between border-t border-border bg-card/50 px-4 py-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="tech-num">STRATEGY: modern-open</span>
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline tech-num">SCORE: 86 / 100</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-cyan">
                  <span className="size-1.5 rounded-full bg-cyan bp-pulse" />
                  Live validation
                </span>
              </div>
            </div>
          </Card>
        </FadeIn>

        {/* Trust stats */}
        <FadeIn delay={0.15} className="mt-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border/70 rounded-xl overflow-hidden border border-border/70">
            {[
              { num: '4', label: 'Design strategies' },
              { num: '13', label: 'Templates' },
              { num: 'Live', label: 'Validation' },
              { num: '₹', label: 'Preliminary cost estimate' },
            ].map((s) => (
              <div key={s.label} className="bg-card px-4 py-5 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-primary tech-num">{s.num}</div>
                <div className="mt-1 text-xs sm:text-sm text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>

      {/* Animated blueprint line draw — full-width separator */}
      <div className="relative h-px w-full bg-border/60" aria-hidden>
        <svg
          className="absolute left-1/2 -translate-x-1/2 -top-1"
          width="120"
          height="3"
          viewBox="0 0 120 3"
          fill="none"
        >
          <line
            x1="0"
            y1="1.5"
            x2="120"
            y2="1.5"
            stroke="oklch(0.62 0.19 220)"
            strokeWidth="2"
            className="bp-draw"
          />
        </svg>
      </div>
    </section>
  );
}

function FloatLabel({
  children,
  className,
  tone = 'navy',
}: {
  children: React.ReactNode;
  className?: string;
  tone?: 'navy' | 'cyan';
}) {
  return (
    <div
      className={cn(
        'absolute z-10 inline-flex items-center rounded-md border bg-card/95 px-2 py-0.5 text-[10px] sm:text-xs font-semibold shadow-sm tech-num backdrop-blur-sm pointer-events-none',
        tone === 'navy'
          ? 'border-primary/30 text-primary'
          : 'border-cyan/40 text-cyan',
        className,
      )}
    >
      {children}
    </div>
  );
}

function NorthArrow({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'absolute z-10 flex items-center justify-center size-10 rounded-full border border-primary/30 bg-card/95 shadow-sm',
        className,
      )}
      aria-label="North"
    >
      <Compass className="size-5 text-primary" />
    </div>
  );
}

/* ============================================================
 * How It Works
 * ============================================================ */

const STEPS = [
  {
    num: '01',
    icon: Ruler,
    title: 'Enter Measurements',
    desc: 'Plot width, length, unit, road position, setbacks.',
  },
  {
    num: '02',
    icon: LayoutGrid,
    title: 'Define Requirements',
    desc: 'Bedrooms, bathrooms, kitchen, living, dining, parking, balcony, pooja, office, utility, staircase.',
  },
  {
    num: '03',
    icon: Sparkles,
    title: 'Generate Blueprint',
    desc: 'AI understands requirements; the layout engine generates multiple preliminary designs.',
  },
  {
    num: '04',
    icon: PencilRuler,
    title: 'Customize & Visualize',
    desc: 'Edit the blueprint, switch to 3D, estimate cost, save, export.',
  },
];

function HowItWorks() {
  return (
    <Section id="how" eyebrow="Process" title="How It Works" subtitle="From raw dimensions to a customizable preliminary floor plan — in four steps.">
      <div className="relative">
        {/* Horizontal connector line (desktop) */}
        <div className="hidden md:block absolute top-[42px] left-[12%] right-[12%] h-px bg-border" aria-hidden />
        <svg
          className="hidden md:block absolute top-[40px] left-[12%] w-[76%] h-2"
          viewBox="0 0 1000 4"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden
        >
          <line x1="0" y1="2" x2="1000" y2="2" stroke="oklch(0.62 0.19 220)" strokeWidth="2" className="bp-draw" />
        </svg>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-4 relative">
          {STEPS.map((s, i) => (
            <FadeIn key={s.num} delay={i * 0.08}>
              <div className="flex flex-col items-center text-center px-2">
                {/* Number circle */}
                <div className="relative z-10 flex size-20 items-center justify-center rounded-full border-2 border-primary bg-card text-primary tech-num text-xl font-bold shadow-sm">
                  {s.num}
                  <span className="absolute -bottom-2 -right-2 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <s.icon className="size-4" />
                  </span>
                </div>
                <h3
                  className="mt-5 text-base font-semibold"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {s.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-[220px]">
                  {s.desc}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ============================================================
 * Features
 * ============================================================ */

const FEATURES = [
  {
    icon: BrainCircuit,
    title: 'AI-Assisted Planning',
    desc: 'Turn natural-language requirements into structured design constraints.',
  },
  {
    icon: Layers,
    title: 'Smart Blueprint Generation',
    desc: 'Generate multiple dimension-aware preliminary layouts.',
  },
  {
    icon: MousePointerSquareDashed,
    title: 'Interactive Editor',
    desc: 'Drag, resize, and customize rooms to refine your plan.',
  },
  {
    icon: Box,
    title: '3D Visualization',
    desc: 'Explore your design in an interactive 3D environment.',
  },
  {
    icon: Calculator,
    title: 'Cost Estimation',
    desc: 'Get a preliminary construction-cost estimate in INR.',
  },
  {
    icon: MessageSquareCode,
    title: 'AI Design Assistant',
    desc: 'Ask the system to modify and improve your design.',
  },
  {
    icon: BookOpen,
    title: 'RAG Knowledge Assistant',
    desc: 'Get contextual architectural and construction information.',
  },
  {
    icon: Share2,
    title: 'Export & Share',
    desc: 'Save, export, and share project designs with your team.',
  },
];

function Features() {
  return (
    <Section
      id="features"
      eyebrow="Capabilities"
      title="Everything you need to plan smarter"
      subtitle="A complete toolkit for preliminary architectural design — from measurements to visualization."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {FEATURES.map((f, i) => (
          <FadeIn key={f.title} delay={(i % 4) * 0.05}>
            <Card className="group h-full p-5 gap-3 transition-all hover:-translate-y-1 hover:border-cyan/50 hover:shadow-md">
              <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary border border-primary/15 transition-colors group-hover:bg-cyan/10 group-hover:text-cyan group-hover:border-cyan/30">
                <f.icon className="size-5" />
              </div>
              <h3
                className="text-base font-semibold mt-1"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {f.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </Card>
          </FadeIn>
        ))}
      </div>
    </Section>
  );
}

/* ============================================================
 * Templates
 * ============================================================ */

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'residential', label: 'Residential' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'other', label: 'Other' },
] as const;

type FilterId = (typeof FILTERS)[number]['id'];

function Templates() {
  const setView = useApp((s) => s.setView);
  const [filter, setFilter] = useState<FilterId>('all');

  const list = TEMPLATES.filter((t) => filter === 'all' || t.category === filter);

  const applyTemplate = (t: ProjectTemplate) => {
    useApp.getState().loadTemplate(t.id);
    setView({ name: 'wizard' });
  };

  return (
    <Section
      id="templates"
      eyebrow="Library"
      title="Start from a template"
      subtitle="Curated starting points for homes, offices, retail and more — each fully editable."
    >
      {/* Filter tabs */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-full border transition-colors',
              filter === f.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/30',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((t, i) => (
          <FadeIn key={t.id} delay={(i % 3) * 0.05}>
            <Card className="group h-full p-0 gap-0 overflow-hidden transition-all hover:-translate-y-1 hover:shadow-md hover:border-cyan/50">
              {/* Preview */}
              <div className="relative bp-grid border-b border-border">
                <MiniPlan rooms={t.preview} className="w-full h-32" />
                <Badge
                  variant="secondary"
                  className="absolute top-2 right-2 bg-card/90 backdrop-blur-sm capitalize text-[10px]"
                >
                  {t.category}
                </Badge>
              </div>
              {/* Body */}
              <div className="p-4 flex flex-col gap-2 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3
                    className="text-base font-semibold"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {t.name}
                  </h3>
                  <span className="text-xs text-muted-foreground tech-num whitespace-nowrap mt-0.5">
                    {t.plot.width}×{t.plot.length} {t.plot.unit}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                  {t.description}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full group-hover:bg-primary group-hover:text-primary-foreground"
                  onClick={() => applyTemplate(t)}
                >
                  Use template
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </Card>
          </FadeIn>
        ))}
      </div>
    </Section>
  );
}

/* ============================================================
 * Pricing
 * ============================================================ */

const PRICING = [
  {
    name: 'Starter',
    price: 'Free',
    suffix: '',
    highlight: false,
    cta: 'Start free',
    features: [
      '3 projects max',
      '2D blueprint editor + basic 3D',
      '5 design strategies',
      'AI assistant (10 requests/day)',
      'PDF & PNG export',
      'Furniture library (47 items)',
      'Community support',
    ],
  },
  {
    name: 'Pro',
    price: '₹1,499',
    suffix: '/mo',
    highlight: true,
    cta: 'Choose Pro',
    features: [
      'Unlimited projects',
      'Everything in Starter',
      'Full 3D walkthrough mode',
      'Sunlight & shadow analysis',
      'Unlimited AI requests',
      'Vastu compliance report',
      'Material cost calculator',
      'Version history (unlimited)',
      'All export formats (SVG, JSON, HD)',
      'Email support',
    ],
  },
  {
    name: 'Studio',
    price: '₹4,999',
    suffix: '/mo',
    highlight: false,
    cta: 'Choose Studio',
    features: [
      'Everything in Pro',
      'Team collaboration (real-time)',
      'Multi-user roles (Admin/Editor/Viewer)',
      'Custom branding & white-label PDFs',
      'Bill of Quantities (BOQ)',
      'Structural analysis (columns, load walls)',
      'City building code checker',
      'Client sharing portal with comments',
      'API access',
      'Priority support + dedicated manager',
    ],
  },
];

function Pricing() {
  const setView = useApp((s) => s.setView);
  return (
    <Section
      id="pricing"
      eyebrow="Pricing"
      title="Plans for every stage"
      subtitle="Start free, upgrade when you need more power. Prices in INR."
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 items-start">
        {PRICING.map((p, i) => (
          <FadeIn key={p.name} delay={i * 0.08}>
            <Card
              className={cn(
                'h-full p-6 gap-5 relative',
                p.highlight
                  ? 'border-primary shadow-lg ring-1 ring-primary/20'
                  : 'border-border',
              )}
            >
              {p.highlight && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground shadow-sm">
                  Most Popular
                </Badge>
              )}
              <div>
                <h3
                  className="text-lg font-semibold"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {p.name}
                </h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-bold text-foreground tech-num">
                    {p.price}
                  </span>
                  {p.suffix && (
                    <span className="text-sm text-muted-foreground">{p.suffix}</span>
                  )}
                </div>
              </div>

              <ul className="flex flex-col gap-2.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check
                      className={cn(
                        'size-4 mt-0.5 shrink-0',
                        p.highlight ? 'text-cyan' : 'text-primary',
                      )}
                    />
                    <span className="text-foreground/90">{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                variant={p.highlight ? 'default' : 'outline'}
                onClick={() => setView({ name: 'wizard' })}
              >
                {p.cta}
                <ArrowRight className="size-4" />
              </Button>
            </Card>
          </FadeIn>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Preliminary pricing — features may change.
      </p>
    </Section>
  );
}

/* ============================================================
 * About
 * ============================================================ */

const PROCESS = [
  { num: '01', label: 'Understanding', desc: 'Parse natural-language requirements.' },
  { num: '02', label: 'Planning', desc: 'Layout engine proposes multiple strategies.' },
  { num: '03', label: 'Validating', desc: 'Boundary, overlap, dimension, accessibility checks.' },
  { num: '04', label: 'Visualizing', desc: '2D blueprint + 3D isometric preview.' },
  { num: '05', label: 'Optimizing', desc: 'Score, refine, cost-estimate, export.' },
];

function About() {
  return (
    <Section
      id="about"
      eyebrow="About"
      title="About OpenBlueprint"
      subtitle="Democratising preliminary architectural planning — combining precision, intelligence, creativity and practicality."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
        {/* Mission */}
        <FadeIn>
          <div className="space-y-4 text-base text-muted-foreground leading-relaxed">
            <p>
              OpenBlueprint was built to make architectural planning accessible. Whether you are a
              homeowner sketching a dream home or a design professional iterating on a brief, the
              platform turns raw plot measurements into structured, editable preliminary floor plans.
            </p>
            <p>
              We combine a deterministic layout engine with an AI assistant that interprets
              intent — so you spend less time drawing walls and more time evaluating design trade-offs.
            </p>
            <p>
              Our north star: be simple enough for a homeowner, powerful enough for a design
              professional, intelligent enough for AI assistance, and precise enough for preliminary
              spatial planning.
            </p>
          </div>

          {/* Design philosophy pills */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              'Simple enough for a homeowner',
              'Powerful enough for a professional',
              'Intelligent enough for AI assistance',
              'Precise enough for spatial planning',
            ].map((p) => (
              <div
                key={p}
                className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
              >
                <Check className="size-4 text-cyan shrink-0" />
                <span>{p}</span>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* Stats / process panel */}
        <FadeIn delay={0.1}>
          <Card className="p-6 sm:p-8 gap-0 bg-card">
            <div className="flex items-center justify-between mb-6">
              <h3
                className="text-base font-semibold"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Design pipeline
              </h3>
              <Badge variant="outline" className="tech-num">
                5 stages
              </Badge>
            </div>

            <ol className="relative space-y-6">
              {/* vertical connecting line */}
              <span
                className="absolute left-[14px] top-2 bottom-2 w-px bg-border"
                aria-hidden
              />
              {PROCESS.map((p) => (
                <li key={p.num} className="relative flex items-start gap-4">
                  <span className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border border-primary bg-card text-primary tech-num text-xs font-bold">
                    {p.num}
                  </span>
                  <div className="pt-0.5">
                    <div
                      className="text-sm font-semibold"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {p.label}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">{p.desc}</div>
                  </div>
                </li>
              ))}
            </ol>

            {/* Compact stat strip */}
            <div className="mt-8 pt-6 border-t border-border grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xl font-bold text-primary tech-num">13</div>
                <div className="text-[11px] text-muted-foreground">Templates</div>
              </div>
              <div>
                <div className="text-xl font-bold text-primary tech-num">4</div>
                <div className="text-[11px] text-muted-foreground">Strategies</div>
              </div>
              <div>
                <div className="text-xl font-bold text-primary tech-num">6</div>
                <div className="text-[11px] text-muted-foreground">Score axes</div>
              </div>
            </div>
          </Card>
        </FadeIn>
      </div>
    </Section>
  );
}

/* ============================================================
 * Disclaimer
 * ============================================================ */

function Disclaimer() {
  return (
    <section className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="rounded-lg border border-amber-soft/40 bg-amber-soft/10 px-4 sm:px-6 py-4 sm:py-5 flex gap-3">
            <ShieldAlert className="size-5 text-amber-soft shrink-0 mt-0.5" />
            <p className="text-sm text-foreground/85 leading-relaxed">
              <span className="font-semibold text-foreground">Important disclaimer.</span>{' '}
              OpenBlueprint provides AI-assisted conceptual planning and preliminary design
              visualization. Generated layouts are not a substitute for professional architectural,
              structural, electrical, plumbing, or regulatory drawings. Consult qualified
              professionals and verify applicable local regulations before construction.
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ============================================================
 * Footer
 * ============================================================ */

const FOOTER_COLS = [
  {
    title: 'Product',
    links: ['Features', 'Templates', 'Pricing', 'How It Works'],
  },
  {
    title: 'Company',
    links: ['About', 'Blog', 'Careers', 'Contact'],
  },
  {
    title: 'Resources',
    links: ['Documentation', 'Knowledge Base', 'API', 'Status'],
  },
  {
    title: 'Legal',
    links: ['Privacy', 'Terms', 'Disclaimer'],
  },
];

function Footer() {
  const setView = useApp((s) => s.setView);

  return (
    <footer className="mt-auto border-t border-border bg-card/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
          {/* Brand + tagline */}
          <div className="col-span-2">
            <Brand size={28} />
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-xs">
              From Measurements to Intelligent Blueprints. AI-assisted preliminary architectural
              planning for everyone.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setView({ name: 'wizard' })}
              >
                Create Blueprint
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <h4
                className="text-xs font-semibold uppercase tracking-wider text-foreground/70"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {col.title}
              </h4>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l}>
                    <a
                      href="#top"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground text-center sm:text-left">
            <span className="tech-num">© 2024 OpenBlueprint.</span>{' '}
            From Measurements to Intelligent Blueprints.
          </div>
          <div className="flex items-center gap-3">
            <SocialLink icon={Twitter} label="Twitter" />
            <SocialLink icon={Github} label="GitHub" />
            <SocialLink icon={Linkedin} label="LinkedIn" />
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <a
      href="#top"
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
    >
      <Icon className="size-4" />
    </a>
  );
}

/* ============================================================
 * Shared Section wrapper
 * ============================================================ */

function Section({
  id,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 py-16 sm:py-20 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn className="max-w-2xl mx-auto text-center">
          {eyebrow && (
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan">
              <span className="h-px w-6 bg-cyan/60" />
              {eyebrow}
              <span className="h-px w-6 bg-cyan/60" />
            </div>
          )}
          <h2
            className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {title}
          </h2>
          {subtitle && (
            <p className="mt-3 text-base sm:text-lg text-muted-foreground leading-relaxed">
              {subtitle}
            </p>
          )}
        </FadeIn>
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}

