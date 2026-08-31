'use client';

import { useApp } from '@/lib/store';
import { Landing } from '@/components/openblueprint/landing/landing';
import { Dashboard } from '@/components/openblueprint/dashboard/dashboard';
import { Wizard } from '@/components/openblueprint/wizard/wizard';
import { DesignOptions } from '@/components/openblueprint/design-options/design-options';
import { Workspace } from '@/components/openblueprint/workspace/workspace';
import { useEffect } from 'react';

export default function Home() {
  const view = useApp((s) => s.view);

  // scroll to top on view change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [view.name]);

  if (view.name === 'landing') return <Landing />;
  if (view.name === 'dashboard') return <Dashboard />;
  if (view.name === 'wizard') return <Wizard />;
  if (view.name === 'design-options') return <DesignOptions config={view.config} designs={view.designs} />;
  if (view.name === 'workspace') return <Workspace config={view.config} design={view.design} projectId={view.projectId} />;
  return <Landing />;
}
