'use client';

import { ValidationResult } from '@/lib/types';
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ValidationPanel({ validation }: { validation: ValidationResult }) {
  const groups = [
    { key: 'geometry', title: 'Geometry', data: validation.geometry },
    { key: 'accessibility', title: 'Accessibility', data: validation.accessibility },
    { key: 'space', title: 'Space Planning', data: validation.spacePlanning },
    { key: 'requirements', title: 'User Requirements', data: validation.requirements },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2"><ShieldCheck className="size-4 text-cyan" /> Constraint Validation</h3>
        <span className={cn('text-xs font-medium flex items-center gap-1', validation.valid ? 'text-emerald-600' : 'text-destructive')}>
          {validation.valid ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
          {validation.valid ? 'Valid' : `${validation.errors.length} error(s)`}
        </span>
      </div>

      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.key} className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold">{g.title}</span>
              {g.data.ok ? (
                <CheckCircle2 className="size-3.5 text-emerald-600" />
              ) : (
                <AlertTriangle className="size-3.5 text-amber-600" />
              )}
            </div>
            <ul className="space-y-1">
              {g.data.notes.map((n, i) => (
                <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                  <CheckCircle2 className="size-3 text-emerald-500 shrink-0 mt-0.5" /> {n}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {validation.errors.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-destructive flex items-center gap-1.5"><XCircle className="size-3.5" /> Errors</p>
          {validation.errors.map((e, i) => (
            <div key={i} className="text-[11px] p-2 rounded bg-destructive/5 border border-destructive/20 text-destructive">
              {e.message}
            </div>
          ))}
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-amber-600 flex items-center gap-1.5"><AlertTriangle className="size-3.5" /> Warnings</p>
          {validation.warnings.map((w, i) => (
            <div key={i} className="text-[11px] p-2 rounded bg-amber-soft/10 border border-amber-soft/30 text-amber-700">
              {w.message}
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Validation checks geometry, accessibility, space planning, and requirements. Always verify with a qualified professional.
      </p>
    </div>
  );
}
