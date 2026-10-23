import { create } from 'zustand'

type SessionState = { pseudonyms: boolean; dark: boolean; compact: boolean; connectorError: boolean; shortLogs: boolean; role: 'reviewer' | 'admin' | 'auditor'; togglePseudonyms: () => void; toggleDark: () => void; toggleCompact: () => void; setRole: (role: SessionState['role']) => void; setConnectorError: (value: boolean) => void; setShortLogs: (value: boolean) => void }

export const useSessionStore = create<SessionState>((set) => ({ pseudonyms: false, dark: false, compact: false, connectorError: false, shortLogs: false, role: 'reviewer', togglePseudonyms: () => set((state) => ({ pseudonyms: !state.pseudonyms })), toggleDark: () => set((state) => ({ dark: !state.dark })), toggleCompact: () => set((state) => ({ compact: !state.compact })), setRole: (role) => set({ role }), setConnectorError: (connectorError) => set({ connectorError }), setShortLogs: (shortLogs) => set({ shortLogs }) }))
