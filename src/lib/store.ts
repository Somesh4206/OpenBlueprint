'use client';

import { create } from 'zustand';
import {
  AppView,
  ProjectConfig,
  ScoredLayout,
  LayoutData,
  MaterialSelection,
  DesignStyle,
  FinishGrade,
} from './types';
import { TEMPLATES, templateToConfig } from './templates';

interface AppState {
  view: AppView;
  setView: (v: AppView) => void;

  // wizard state
  wizardConfig: ProjectConfig;
  setWizardConfig: (c: Partial<ProjectConfig>) => void;
  resetWizard: (c?: ProjectConfig) => void;
  loadTemplate: (templateId: string) => void;

  // generation result
  designs: ScoredLayout[];

  // workspace state
  currentDesign: ScoredLayout | null;
  currentLayout: LayoutData | null;
  selectedRoomId: string | null;
  view2d: boolean;
  currentFloor: number;
  showAllFloors: boolean;
  accentColor: string;
  materials: MaterialSelection;
  finish: FinishGrade;
  style: DesignStyle;
  aiPanelOpen: boolean;
  rightPanel: 'validation' | 'space' | 'cost' | 'materials' | 'style' | 'versions' | 'insights' | 'knowledge';
  exportOpen: boolean;
  compareOpen: boolean;

  setCurrentDesign: (d: ScoredLayout) => void;
  setCurrentLayout: (l: LayoutData) => void;
  setSelectedRoom: (id: string | null) => void;
  setView2d: (b: boolean) => void;
  setCurrentFloor: (f: number) => void;
  setShowAllFloors: (b: boolean) => void;
  setAccentColor: (c: string) => void;
  setMaterials: (m: Partial<MaterialSelection>) => void;
  setFinish: (f: FinishGrade) => void;
  setStyle: (s: DesignStyle) => void;
  setAiPanelOpen: (b: boolean) => void;
  setRightPanel: (p: AppState['rightPanel']) => void;
  setExportOpen: (b: boolean) => void;
  setCompareOpen: (b: boolean) => void;
  setDesigns: (d: ScoredLayout[]) => void;
  enterWorkspace: (d: ScoredLayout) => void;
}

const defaultConfig: ProjectConfig = {
  plot: {
    width: 30,
    length: 40,
    unit: 'ft',
    roadSide: 'south',
    northDirection: 0,
    setbackFront: 0,
    setbackRear: 0,
    setbackSides: 0,
  },
  floors: 2,
  rooms: [
    {
      type: 'bedroom',
      name: 'Master Bedroom',
      count: 1,
      minWidth: 11,
      minLength: 13,
      preferredWidth: 12,
      preferredLength: 14,
      priority: 'high',
      attachedTo: 'bathroom',
      preferredLocation: 'rear',
    },
    {
      type: 'bedroom',
      name: 'Bedroom',
      count: 2,
      minWidth: 9,
      minLength: 11,
      preferredWidth: 10,
      preferredLength: 12,
      priority: 'high',
      preferredLocation: null,
    },
    {
      type: 'bathroom',
      name: 'Bathroom',
      count: 2,
      minWidth: 6,
      minLength: 7,
      preferredWidth: 7,
      preferredLength: 8,
      priority: 'medium',
      preferredLocation: null,
    },
    {
      type: 'kitchen',
      name: 'Kitchen',
      count: 1,
      minWidth: 9,
      minLength: 9,
      preferredWidth: 10,
      preferredLength: 10,
      priority: 'high',
      preferredLocation: null,
    },
    {
      type: 'living',
      name: 'Living Room',
      count: 1,
      minWidth: 13,
      minLength: 15,
      preferredWidth: 14,
      preferredLength: 16,
      priority: 'high',
      preferredLocation: 'front',
    },
    {
      type: 'dining',
      name: 'Dining',
      count: 1,
      minWidth: 9,
      minLength: 11,
      preferredWidth: 10,
      preferredLength: 12,
      priority: 'medium',
      preferredLocation: null,
    },
    {
      type: 'parking',
      name: 'Parking',
      count: 1,
      minWidth: 9,
      minLength: 18,
      preferredWidth: 10,
      preferredLength: 20,
      priority: 'medium',
      preferredLocation: 'front',
    },
  ],
  style: 'modern',
  preferences: ['kitchen-near-dining', 'master-attached-bath', 'parking-near-entrance', 'max-natural-light'],
  vastuEnabled: false,
  vastu: { entrance: 'east', kitchen: 'southeast', bedroom: 'southwest', pooja: 'northeast' },
};

export const useApp = create<AppState>((set, get) => ({
  view: { name: 'landing' },
  setView: (v) => set({ view: v }),

  wizardConfig: defaultConfig,
  setWizardConfig: (c) => set((s) => ({ wizardConfig: { ...s.wizardConfig, ...c, plot: { ...s.wizardConfig.plot, ...(c.plot || {}) } } })),
  resetWizard: (c) => set({ wizardConfig: c || defaultConfig }),
  loadTemplate: (templateId) => {
    const t = TEMPLATES.find((x) => x.id === templateId);
    if (t) set({ wizardConfig: templateToConfig(t) });
  },

  designs: [],
  setDesigns: (d) => set({ designs: d }),

  currentDesign: null,
  currentLayout: null,
  selectedRoomId: null,
  view2d: true,
  currentFloor: 0,
  showAllFloors: false,
  accentColor: '#2b4a7a',
  materials: { flooring: 'vitrified', doors: 'engineered', windows: 'upvc', finish: 'standard' },
  finish: 'standard',
  style: 'modern',
  aiPanelOpen: true,
  rightPanel: 'validation',
  exportOpen: false,
  compareOpen: false,

  setCurrentDesign: (d) => set({ currentDesign: d, currentLayout: d.layout }),
  setCurrentLayout: (l) => set({ currentLayout: l }),
  setSelectedRoom: (id) => set({ selectedRoomId: id }),
  setView2d: (b) => set({ view2d: b }),
  setCurrentFloor: (f) => set({ currentFloor: f }),
  setShowAllFloors: (b) => set({ showAllFloors: b }),
  setAccentColor: (c) => set({ accentColor: c }),
  setMaterials: (m) => set((s) => ({ materials: { ...s.materials, ...m } })),
  setFinish: (f) => set({ finish: f, materials: { ...get().materials, finish: f } }),
  setStyle: (s) => set({ style: s }),
  setAiPanelOpen: (b) => set({ aiPanelOpen: b }),
  setRightPanel: (p) => set({ rightPanel: p }),
  setExportOpen: (b) => set({ exportOpen: b }),
  setCompareOpen: (b) => set({ compareOpen: b }),
  enterWorkspace: (d) =>
    set({
      currentDesign: d,
      currentLayout: d.layout,
      view: { name: 'workspace', projectId: null, config: get().wizardConfig, design: d },
      selectedRoomId: null,
      view2d: true,
      currentFloor: 0,
      style: get().wizardConfig.style,
    }),
}));
