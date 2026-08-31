'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Image as ImageIcon, FileCode, Link2, Check, Loader2, Copy, Lock, Globe, Download, Building2 } from 'lucide-react';
import { LayoutData, ProjectConfig, MaterialSelection, FinishGrade } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  layout: LayoutData;
  config: ProjectConfig;
  projectName: string;
  finish: FinishGrade;
  materials: MaterialSelection;
  accentColor: string;
  showToast: (msg: string, kind?: 'ok' | 'err') => void;
}

type ExportType = 'pdf' | 'png' | 'svg' | 'json';

export function ExportModal({ open, onOpenChange, layout, config, projectName, finish, materials, accentColor, showToast }: Props) {
  const [type, setType] = useState<ExportType>('pdf');
  const [building, setBuilding] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareMode, setShareMode] = useState<'private' | 'link'>('private');
  const [linkCopied, setLinkCopied] = useState(false);

  async function doExport() {
    setBuilding(true);
    try {
      if (type === 'json') {
        const data = JSON.stringify({ project: { name: projectName }, plot: layout.plot, floors: layout.floors, rooms: layout.rooms }, null, 2);
        download(new Blob([data], { type: 'application/json' }), `${slug(projectName)}.json`);
        showToast('JSON exported');
      } else if (type === 'svg') {
        const res = await fetch('/api/export/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout, blueprintMode: false, floor: 'all' }) });
        const data = await res.json();
        download(new Blob([data.svg], { type: 'image/svg+xml' }), `${slug(projectName)}.svg`);
        showToast('SVG exported');
      } else if (type === 'png') {
        const res = await fetch('/api/export/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout, blueprintMode: false, floor: 'all' }) });
        const data = await res.json();
        const img = new Image();
        const svgBlob = new Blob([data.svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(svgBlob);
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const vb = data.svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
          const w = vb ? parseFloat(vb[1]) : 1200;
          const h = vb ? parseFloat(vb[2]) : 800;
          canvas.width = w * 2;
          canvas.height = h * 2;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (blob) {
              download(blob, `${slug(projectName)}.png`);
              showToast('PNG exported');
            }
          }, 'image/png');
          URL.revokeObjectURL(url);
        };
        img.src = url;
      } else if (type === 'pdf') {
        const res = await fetch('/api/export/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout, config, projectName, finish, materials, accentColor }) });
        if (!res.ok) throw new Error('PDF generation failed');
        const data = await res.json();
        if (!data.html) throw new Error('No HTML returned');
        // Open the HTML in a new tab via Blob URL (more reliable than document.write)
        const blob = new Blob([data.html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const w = window.open(url, '_blank');
        if (w) {
          // give the new tab time to render, then trigger print
          setTimeout(() => {
            try { w.focus(); w.print(); } catch {}
          }, 1200);
          showToast('PDF opened — use browser print to save as PDF');
        } else {
          // popup blocked — download the HTML file instead
          download(blob, `${slug(projectName)}-blueprint.html`);
          showToast('Popup blocked — HTML downloaded. Open it and print to PDF.');
        }
        // revoke after a delay
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    } catch {
      showToast('Export failed', 'err');
    } finally {
      setBuilding(false);
    }
  }

  function copyLink() {
    const link = `${window.location.origin}/?p=${slug(projectName)}`;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  const types: { id: ExportType; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
    { id: 'pdf', label: 'PDF Blueprint', icon: FileText, desc: 'Full blueprint sheet with dimensions, area, cost & disclaimer' },
    { id: 'png', label: 'PNG Image', icon: ImageIcon, desc: 'High-resolution floor plan image' },
    { id: 'svg', label: 'SVG Vector', icon: FileCode, desc: 'Scalable vector floor plan' },
    { id: 'json', label: 'Project JSON', icon: FileCode, desc: 'Full structured project data' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Download className="size-5 text-cyan" /> Export Your Design</DialogTitle>
          <DialogDescription>Export the current blueprint in multiple formats. PDF includes a professional blueprint sheet with disclaimer.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {types.map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={cn('text-left p-3 rounded-md border transition-all', type === t.id ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'border-border hover:border-cyan/40')}
            >
              <div className="flex items-center gap-2 mb-1">
                <t.icon className={cn('size-4', type === t.id ? 'text-primary' : 'text-muted-foreground')} />
                <span className="text-sm font-medium">{t.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t.desc}</p>
            </button>
          ))}
        </div>

        {/* Building animation */}
        <AnimatePresence>
          {building && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="bp-grid-dark rounded-md p-4 mb-4">
                <div className="flex items-center gap-2 text-white text-sm mb-3">
                  <Building2 className="size-4 text-cyan" /> Building blueprint sheet…
                </div>
                <div className="space-y-1.5 font-mono text-xs text-cyan/90">
                  <BuildLine label="Rendering floor plan" delay={0} />
                  <BuildLine label="Adding dimensions" delay={400} />
                  <BuildLine label="Computing area summary" delay={800} />
                  <BuildLine label="Generating cost estimate" delay={1200} />
                  <BuildLine label="Finalizing sheet" delay={1600} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={() => setShareOpen(!shareOpen)} className="gap-1.5">
            <Link2 className="size-4" /> Share Project
          </Button>
          <Button onClick={doExport} disabled={building} className="gap-1.5">
            {building ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {building ? 'Building…' : `Export ${type.toUpperCase()}`}
          </Button>
        </div>

        <AnimatePresence>
          {shareOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="pt-3 border-t border-border space-y-3">
                <p className="text-sm font-medium">Share Project</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setShareMode('private')} className={cn('p-3 rounded-md border text-left', shareMode === 'private' ? 'border-primary bg-primary/5' : 'border-border')}>
                    <div className="flex items-center gap-2 mb-1">
                      <Lock className="size-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Private</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Only you can access</p>
                  </button>
                  <button onClick={() => setShareMode('link')} className={cn('p-3 rounded-md border text-left', shareMode === 'link' ? 'border-primary bg-primary/5' : 'border-border')}>
                    <div className="flex items-center gap-2 mb-1">
                      <Globe className="size-4 text-cyan" />
                      <span className="text-sm font-medium">Anyone with link</span>
                    </div>
                    <p className="text-xs text-muted-foreground">View-only access</p>
                  </button>
                </div>
                {shareMode === 'link' && (
                  <div className="flex gap-2">
                    <input readOnly value={`${window.location.origin}/?p=${slug(projectName)}`} className="flex-1 text-xs px-3 py-2 rounded-md border border-border bg-muted/30 tech-num" />
                    <Button size="sm" onClick={copyLink} className="gap-1.5">
                      {linkCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {linkCopied ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pt-2 border-t border-border">
          <p className="text-[10px] text-muted-foreground">
            Exports include a disclaimer: OpenBlueprint plans are preliminary conceptual designs, not professional or regulatory drawings.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BuildLine({ label, delay }: { label: string; delay: number }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), delay + 300);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div className="flex items-center gap-2">
      {done ? <Check className="size-3 text-cyan" /> : <Loader2 className="size-3 animate-spin text-cyan/60" />}
      <span className={done ? 'text-white' : 'text-white/60'}>{label}</span>
    </div>
  );
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'openblueprint';
}
