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
  FurnitureItem,
  FurnitureType,
} from './types';
import { TEMPLATES, templateToConfig } from './templates';
import { FURNITURE_MAP } from './furniture-catalog';

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
  selectedFurnitureId: string | null;
  furniturePanelOpen: boolean;
  furnitureCategory: string;
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
  // Undo/Redo history
  _undoStack: LayoutData[];
  _redoStack: LayoutData[];
  compareOpen: boolean;

  setCurrentDesign: (d: ScoredLayout) => void;
  setCurrentLayout: (l: LayoutData) => void;
  setSelectedRoom: (id: string | null) => void;
  setSelectedFurniture: (id: string | null) => void;
  setFurniturePanelOpen: (b: boolean) => void;
  setFurnitureCategory: (c: string) => void;
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
  addFurniture: (type: FurnitureType, x: number, y: number) => void;
  updateFurniture: (id: string, patch: Partial<FurnitureItem>) => void;
  deleteFurniture: (id: string) => void;
  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
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
      name: 'Bedroom',
      count: 3,
      minWidth: 9,
      minLength: 11,
      preferredWidth: 11,
      preferredLength: 13,
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
  selectedFurnitureId: null,
  furniturePanelOpen: true,
  furnitureCategory: 'living',
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
  _undoStack: [],
  _redoStack: [],
  compareOpen: false,

  setCurrentDesign: (d) => set({ currentDesign: d, currentLayout: d.layout }),
  setCurrentLayout: (l) => {
    const current = get().currentLayout;
    if (current) {
      const undoStack = get()._undoStack || [];
      set({
        _undoStack: [...undoStack, JSON.parse(JSON.stringify(current))].slice(-50),
        _redoStack: [],
      });
    }
    set({ currentLayout: l });
  },
  setSelectedRoom: (id) => set({ selectedRoomId: id, selectedFurnitureId: null }),
  setSelectedFurniture: (id) => set({ selectedFurnitureId: id, selectedRoomId: null }),
  setFurniturePanelOpen: (b) => set({ furniturePanelOpen: b }),
  setFurnitureCategory: (c) => set({ furnitureCategory: c }),
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
      selectedFurnitureId: null,
      view2d: true,
      currentFloor: 0,
      style: get().wizardConfig.style,
    }),
  addFurniture: (type, x, y) => {
    const layout = get().currentLayout;
    if (!layout) return;
    const cat = FURNITURE_MAP[type];
    if (!cat) return;
    const item: FurnitureItem = {
      id: `f${Date.now()}${Math.floor(Math.random() * 1000)}`,
      type,
      name: cat.name,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      width: cat.width,
      length: cat.length,
      rotation: 0,
      floor: get().currentFloor,
      color: cat.color,
    };
    set({ currentLayout: { ...layout, furniture: [...layout.furniture, item] }, selectedFurnitureId: item.id, selectedRoomId: null });
  },
  updateFurniture: (id, patch) => {
    const layout = get().currentLayout;
    if (!layout) return;
    set({ currentLayout: { ...layout, furniture: layout.furniture.map((f) => (f.id === id ? { ...f, ...patch } : f)) } });
  },
  deleteFurniture: (id) => {
    const layout = get().currentLayout;
    if (!layout) return;
    pushHistory(get, set);
    set({ currentLayout: { ...layout, furniture: layout.furniture.filter((f) => f.id !== id) }, selectedFurnitureId: null });
  },
  undo: () => {
    const state = get();
    if (state._undoStack.length === 0 || !state.currentLayout) return;
    const prev = state._undoStack[state._undoStack.length - 1];
    set({
      _undoStack: state._undoStack.slice(0, -1),
      _redoStack: [...state._redoStack, state.currentLayout as LayoutData],
      currentLayout: prev,
    });
  },
  redo: () => {
    const state = get();
    if (state._redoStack.length === 0 || !state.currentLayout) return;
    const next = state._redoStack[state._redoStack.length - 1];
    set({
      _redoStack: state._redoStack.slice(0, -1),
      _undoStack: [...state._undoStack, state.currentLayout as LayoutData],
      currentLayout: next,
    });
  },
  canUndo: () => get()._undoStack.length > 0,
  canRedo: () => get()._redoStack.length > 0,
}));

// Helper: push current layout to undo stack before a mutation
function pushHistory(get: () => AppState, set: (partial: Partial<AppState>) => void) {
  const current = get().currentLayout;
  if (current) {
    const undoStack = get()._undoStack || [];
    set({
      _undoStack: [...undoStack, JSON.parse(JSON.stringify(current))].slice(-50),
      _redoStack: [],
    });
  }
}
