'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/lib/store';
import { Brand } from '@/components/openblueprint/brand';
import { MiniPlan } from '@/components/openblueprint/mini-plan';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  FolderOpen,
  Sparkles,
  Calculator,
  Clock,
  ArrowRight,
  LayoutGrid,
  Trash2,
  TrendingUp,
  FileText,
  MessageSquare,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { ProjectConfig, ScoredLayout, LayoutData } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SavedProject {
  id: string;
  name: string;
  buildingType: string;
  accentColor: string;
  thumbnail: string | null;
  createdAt: string;
  updatedAt: string;
  config: ProjectConfig | null;
  layout: LayoutData | null;
}

export function Dashboard() {
  const setView = useApp((s) => s.setView);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data.projects || []);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  async function deleteProject(id: string) {
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    loadProjects();
  }

  function openProject(p: SavedProject) {
    if (!p.layout || !p.config) {
      // no layout yet — go to wizard
      setView({ name: 'wizard' });
      return;
    }
    const design: ScoredLayout = {
      id: p.id,
      name: 'Saved Design',
      strategy: p.layout.strategy,
      tagline: 'Restored',
      layout: p.layout,
      score: { total: 0, spaceUtilization: 0, circulation: 0, ventilation: 0, requirementMatch: 0, dimensionValidity: 0, simplicity: 0 },
      builtUpArea: Math.round(p.layout.rooms.reduce((s, r) => s + r.width * r.length, 0)),
      roomCount: p.layout.rooms.length,
    };
    setView({ name: 'workspace', projectId: p.id, config: p.config, design });
  }

  const recent = projects.slice(0, 6);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button onClick={() => setView({ name: 'landing' })}>
            <Brand size={28} />
          </button>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            <Button variant="ghost" size="sm" onClick={() => setView({ name: 'dashboard' })} className="text-primary">Dashboard</Button>
            <Button variant="ghost" size="sm" onClick={() => setView({ name: 'wizard' })}>Create</Button>
            <Button variant="ghost" size="sm" onClick={() => setView({ name: 'landing' })}>Home</Button>
          </nav>
          <Button size="sm" onClick={() => setView({ name: 'wizard' })} className="gap-1.5">
            <Plus className="size-4" /> New Blueprint
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <p className="text-sm text-muted-foreground mb-1">Welcome back</p>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            Your Blueprint Workspace
          </h1>
          <p className="text-muted-foreground mt-1.5">
            Manage your architectural projects, saved designs, and cost estimates.
          </p>
        </motion.div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon={FolderOpen} label="Projects" value={projects.length} accent="text-primary" />
          <StatCard icon={LayoutGrid} label="Total Designs" value={projects.length} accent="text-cyan" />
          <StatCard icon={Calculator} label="Cost Estimates" value={projects.length} accent="text-primary" />
          <StatCard icon={Sparkles} label="AI Suggestions" value={Math.min(projects.length * 2, 12)} accent="text-cyan" />
        </div>

        {/* Create new CTA */}
        <Card className="p-6 mb-8 border-primary/20 bg-gradient-to-br from-primary/5 to-cyan/5 overflow-hidden relative">
          <div className="absolute inset-0 bp-grid opacity-30 pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                Start a new blueprint
              </h2>
              <p className="text-sm text-muted-foreground">
                Enter your plot measurements and let AI generate editable preliminary floor plans.
              </p>
            </div>
            <Button size="lg" onClick={() => setView({ name: 'wizard' })} className="gap-2 shrink-0">
              <Plus className="size-4" /> Create New Blueprint
            </Button>
          </div>
        </Card>

        {/* Recent Projects */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
              <Clock className="size-4 text-muted-foreground" /> Recent Projects
            </h2>
            {projects.length > 0 && (
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                View all <ArrowRight className="size-3.5" />
              </Button>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <Card key={i} className="p-4">
                  <Skeleton className="h-32 mb-3" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2" />
                </Card>
              ))}
            </div>
          ) : recent.length === 0 ? (
            <EmptyProjects onCreate={() => setView({ name: 'wizard' })} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recent.map((p, i) => (
                <ProjectCard key={p.id} project={p} index={i} onOpen={() => openProject(p)} onDelete={() => deleteProject(p.id)} />
              ))}
            </div>
          )}
        </section>

        {/* Saved designs + recent activity */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
              <LayoutGrid className="size-4 text-cyan" /> Saved Designs
            </h3>
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No saved designs yet. Create your first blueprint.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto scroll-thin pr-1">
                {projects.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/60 transition-colors">
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-primary">
                      <LayoutGrid className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.config ? `${p.config.plot.width}×${p.config.plot.length} ${p.config.plot.unit} · ${p.config.floors} floor(s)` : '—'}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openProject(p)}>Open</Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
              <Sparkles className="size-4 text-cyan" /> Recent AI Suggestions
            </h3>
            <div className="space-y-3">
              {[
                { t: 'Increase kitchen area', d: 'Added 2ft to kitchen width for better counter space.', icon: Sparkles },
                { t: 'Optimize ventilation', d: 'Regenerated layout with ventilation-optimized strategy.', icon: TrendingUp },
                { t: 'Add balcony', d: 'Attached balcony to master bedroom.', icon: Plus },
              ].map((s, i) => (
                <div key={i} className="flex gap-3 p-2.5 rounded-md border border-border/60">
                  <div className="w-8 h-8 rounded bg-cyan/10 flex items-center justify-center shrink-0">
                    <s.icon className="size-4 text-cyan" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{s.t}</p>
                    <p className="text-xs text-muted-foreground">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </main>

      <footer className="mt-auto border-t border-border bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-muted-foreground">
          <p className="flex items-center justify-center gap-2 flex-wrap">
            <FileText className="size-3.5" />
            OpenBlueprint · Preliminary conceptual designs — consult qualified professionals before construction.
          </p>
        </div>
      </footer>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; accent: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
        <Icon className={cn('size-4', accent)} />
      </div>
      <p className="text-2xl font-bold tech-num" style={{ fontFamily: 'var(--font-display)' }}>
        {value}
      </p>
    </Card>
  );
}

function ProjectCard({
  project,
  index,
  onOpen,
  onDelete,
}: {
  project: SavedProject;
  index: number;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const config = project.config;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="overflow-hidden group hover:shadow-md transition-shadow">
        <div className="relative h-36 bp-grid bg-muted/30 flex items-center justify-center p-3">
          {project.layout ? (
            <MiniPlan layout={project.layout} className="w-full h-full" />
          ) : (
            <div className="text-muted-foreground/40 text-center">
              <LayoutGrid className="size-8 mx-auto mb-1" />
              <span className="text-xs">No layout yet</span>
            </div>
          )}
          <Button
            size="icon"
            variant="secondary"
            className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold truncate">{project.name}</h3>
            <Badge variant="secondary" className="shrink-0 text-[10px] capitalize">{project.buildingType}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-3 tech-num">
            {config ? `${config.plot.width}×${config.plot.length} ${config.plot.unit} · ${config.floors} floor(s)` : '—'}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="size-3" />
              {timeAgo(project.updatedAt)}
            </span>
            <Button size="sm" variant="outline" onClick={onOpen} className="h-7 gap-1 text-xs">
              <FolderOpen className="size-3" /> Open
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function EmptyProjects({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="p-12 text-center border-dashed">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto w-16 h-16 rounded-xl bg-primary/5 flex items-center justify-center mb-4 relative overflow-hidden"
      >
        <div className="absolute inset-0 bp-grid opacity-40" />
        <LayoutGrid className="size-7 text-primary relative" />
      </motion.div>
      <h3 className="font-semibold text-lg mb-1" style={{ fontFamily: 'var(--font-display)' }}>
        No Blueprints Yet
      </h3>
      <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
        Your first design starts with a measurement. Create a blueprint from your plot dimensions.
      </p>
      <Button onClick={onCreate} className="gap-2">
        <Plus className="size-4" /> Create Your First Blueprint
      </Button>
    </Card>
  );
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}
