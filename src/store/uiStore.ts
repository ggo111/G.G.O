import { create } from 'zustand';

interface UIState {
  showArmory: boolean;
  showLoadout: boolean;
  showExchange: boolean;
  showPromo: boolean;
  showProfile: boolean;
  showLeaderboard: boolean;
  showMissions: boolean;
  showTitleSettings: boolean;
  showDebugPanel: boolean;
  toastMsg: string | null;

  setShowArmory: (v: boolean) => void;
  setShowLoadout: (v: boolean) => void;
  setShowExchange: (v: boolean) => void;
  setShowPromo: (v: boolean) => void;
  setShowProfile: (v: boolean) => void;
  setShowLeaderboard: (v: boolean) => void;
  setShowMissions: (v: boolean) => void;
  setShowTitleSettings: (v: boolean) => void;
  setShowDebugPanel: (v: boolean) => void;
  showToast: (msg: string, durationMs?: number) => void;
  clearToast: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  showArmory: false,
  showLoadout: false,
  showExchange: false,
  showPromo: false,
  showProfile: false,
  showLeaderboard: false,
  showMissions: false,
  showTitleSettings: false,
  showDebugPanel: false,
  toastMsg: null,

  setShowArmory: (v) => set({ showArmory: v }),
  setShowLoadout: (v) => set({ showLoadout: v }),
  setShowExchange: (v) => set({ showExchange: v }),
  setShowPromo: (v) => set({ showPromo: v }),
  setShowProfile: (v) => set({ showProfile: v }),
  setShowLeaderboard: (v) => set({ showLeaderboard: v }),
  setShowMissions: (v) => set({ showMissions: v }),
  setShowTitleSettings: (v) => set({ showTitleSettings: v }),
  setShowDebugPanel: (v) => set({ showDebugPanel: v }),
  showToast: (msg, durationMs = 2800) => {
    set({ toastMsg: msg });
    window.setTimeout(() => set({ toastMsg: null }), durationMs);
  },
  clearToast: () => set({ toastMsg: null }),
}));
