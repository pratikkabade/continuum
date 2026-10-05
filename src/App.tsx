/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RotateCcw, Trash2, X } from 'lucide-react';
import { ClipItem, ViewMode } from './types/clipboard';
import { getStoredClips, saveClips, subscribeToSync } from './utils/storage';
import {
  playCopySound,
  playSuccessSound,
  playTickSound,
  playDeleteSound,
} from './utils/audio';
import { detectClipType } from './utils/detector';
import { Navbar } from './components/Navbar';
import { ClipCard } from './components/ClipCard';
import { DynamicIslandToast, ToastPayload } from './components/DynamicIslandToast';
import {
  isFirebaseConfigured,
  subscribeToCloudClips,
  saveClipToCloud,
  deleteClipFromCloud,
} from './services/firebase';

interface PendingDelete {
  clip: ClipItem;
  originalIndex: number;
  secondsRemaining: number;
}

export default function App() {
  // Theme state (default dark Glass OS)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('continuum_glass_theme');
      if (saved) return saved === 'dark';
      return true;
    }
    return true;
  });

  const [clips, setClips] = useState<ClipItem[]>(() => getStoredClips());
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Dynamic Island Toast
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Undo Delete State
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const pendingDeleteTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((title: string, subtitle?: string, type: ToastPayload['type'] = 'copy') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({
      id: String(Date.now()),
      title,
      subtitle,
      type,
    });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 2200);
  }, []);

  // Update theme class on root
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      localStorage.setItem('continuum_glass_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem('continuum_glass_theme', 'light');
    }
  }, [darkMode]);

  const toggleTheme = () => {
    setDarkMode((prev) => !prev);
    playTickSound();
  };

  // Sync across tabs via BroadcastChannel
  useEffect(() => {
    const unsubscribe = subscribeToSync((synced) => {
      setClips(synced);
    });
    return unsubscribe;
  }, []);

  // Subscribe to Firebase Cloud if configured
  useEffect(() => {
    if (isFirebaseConfigured()) {
      const unsubscribe = subscribeToCloudClips((cloudClips) => {
        setClips((prev) => {
          const merged = [...cloudClips];
          prev.forEach((local) => {
            if (!merged.some((m) => m.id === local.id)) {
              merged.push(local);
            }
          });
          saveClips(merged, false);
          return merged;
        });
      });
      return unsubscribe;
    }
  }, []);

  const updateClips = (updater: (prev: ClipItem[]) => ClipItem[]) => {
    setClips((prev) => {
      const next = updater(prev);
      saveClips(next);
      return next;
    });
  };

  // Automatic paste handler: Reads system clipboard and creates clip with auto-detected type
  const handleAutoPaste = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        try {
          const items = await navigator.clipboard.read();
          for (const item of items) {
            for (const type of item.types) {
              if (type.startsWith('image/')) {
                const blob = await item.getType(type);
                const reader = new FileReader();
                reader.onload = (e) => {
                  const base64 = e.target?.result as string;
                  const newClip: ClipItem = {
                    id: `clip-${Date.now()}`,
                    content: base64,
                    type: 'image',
                    imageData: base64,
                    createdAt: Date.now(),
                    copyCount: 0,
                  };
                  updateClips((prev) => [newClip, ...prev]);
                  saveClipToCloud(newClip);
                  playSuccessSound();
                  showToast('Pasted Image', 'Added to clipboard', 'success');
                };
                reader.readAsDataURL(blob);
                return;
              }
            }
          }
        } catch {
          // Fall back to readText
        }
      }

      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        const detection = detectClipType(text);
        const newClip: ClipItem = {
          id: `clip-${Date.now()}`,
          content: text,
          type: detection.type,
          language: detection.language,
          colorHex: detection.colorHex,
          colorRgb: detection.colorRgb,
          createdAt: Date.now(),
          copyCount: 0,
        };

        updateClips((prev) => {
          return [newClip, ...prev.filter((c) => c.content !== text)];
        });

        saveClipToCloud(newClip);
        playSuccessSound();
        const displayLabel = text.length > 30 ? text.slice(0, 30) + '…' : text;
        showToast('Pasted to Clipboard', displayLabel, 'success');
      } else {
        showToast('Clipboard Empty', 'Copy some text or code first', 'sync');
      }
    } catch {
      showToast('Clipboard Access Required', 'Press ⌘V / Ctrl+V to paste', 'secret');
    }
  };

  // Copy clip
  const handleCopyClip = async (clip: ClipItem) => {
    try {
      await navigator.clipboard.writeText(clip.content);
      playCopySound();

      updateClips((prev) =>
        prev.map((c) => (c.id === clip.id ? { ...c, copyCount: (c.copyCount || 0) + 1 } : c))
      );

      const preview = clip.content.length > 25 ? clip.content.slice(0, 25) + '…' : clip.content;
      showToast('Copied to Clipboard', preview, 'copy');
    } catch {
      showToast('Copied', undefined, 'copy');
    }
  };

  // Delete clip with 5-second UNDO window
  const handleDeleteClip = (id: string) => {
    const targetIndex = clips.findIndex((c) => c.id === id);
    const targetClip = clips[targetIndex];
    if (!targetClip) return;

    // If an existing undo is active, permanently delete the previous one first
    if (pendingDelete) {
      deleteClipFromCloud(pendingDelete.clip.id);
      if (pendingDeleteTimerRef.current) clearTimeout(pendingDeleteTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    }

    playDeleteSound();

    // Remove from active list
    updateClips((prev) => prev.filter((c) => c.id !== id));

    // Register pending delete with 5-second countdown
    setPendingDelete({
      clip: targetClip,
      originalIndex: targetIndex,
      secondsRemaining: 5,
    });

    // 1-second countdown interval
    countdownIntervalRef.current = setInterval(() => {
      setPendingDelete((prev) => {
        if (!prev) return null;
        if (prev.secondsRemaining <= 1) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          return null;
        }
        return { ...prev, secondsRemaining: prev.secondsRemaining - 1 };
      });
    }, 1000);

    // 5-second final purge
    pendingDeleteTimerRef.current = setTimeout(() => {
      deleteClipFromCloud(id);
      setPendingDelete(null);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    }, 5000);
  };

  // Undo deletion handler
  const handleUndoDelete = () => {
    if (!pendingDelete) return;

    if (pendingDeleteTimerRef.current) clearTimeout(pendingDeleteTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    const restoredClip = pendingDelete.clip;
    const restoredIndex = pendingDelete.originalIndex;

    updateClips((prev) => {
      const next = [...prev];
      if (restoredIndex >= 0 && restoredIndex <= next.length) {
        next.splice(restoredIndex, 0, restoredClip);
      } else {
        next.unshift(restoredClip);
      }
      return next;
    });

    setPendingDelete(null);
    playSuccessSound();
    showToast('Restored Clip', undefined, 'success');
  };

  // Dismiss undo banner and commit immediately
  const handleDismissUndo = () => {
    if (!pendingDelete) return;
    if (pendingDeleteTimerRef.current) clearTimeout(pendingDeleteTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    deleteClipFromCloud(pendingDelete.clip.id);
    setPendingDelete(null);
  };

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (pendingDeleteTimerRef.current) clearTimeout(pendingDeleteTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // Global Paste Listeners: Cmd+V or Ctrl+V
  useEffect(() => {
    const handlePasteEvent = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const text = e.clipboardData?.getData('text');
      const items = e.clipboardData?.items;

      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith('image/')) {
            const file = items[i].getAsFile();
            if (file) {
              const reader = new FileReader();
              reader.onload = (uploadEvent) => {
                const base64 = uploadEvent.target?.result as string;
                const newClip: ClipItem = {
                  id: `clip-${Date.now()}`,
                  content: base64,
                  type: 'image',
                  imageData: base64,
                  createdAt: Date.now(),
                  copyCount: 0,
                };
                updateClips((prev) => [newClip, ...prev]);
                saveClipToCloud(newClip);
                playSuccessSound();
                showToast('Pasted Image', 'Added to clipboard', 'success');
              };
              reader.readAsDataURL(file);
              return;
            }
          }
        }
      }

      if (text && text.trim()) {
        const detection = detectClipType(text);
        const newClip: ClipItem = {
          id: `clip-${Date.now()}`,
          content: text,
          type: detection.type,
          language: detection.language,
          colorHex: detection.colorHex,
          colorRgb: detection.colorRgb,
          createdAt: Date.now(),
          copyCount: 0,
        };
        updateClips((prev) => [newClip, ...prev.filter((c) => c.content !== text)]);
        saveClipToCloud(newClip);
        playSuccessSound();
        showToast('Pasted to Clipboard', text.slice(0, 30), 'success');
      }
    };

    window.addEventListener('paste', handlePasteEvent);
    return () => window.removeEventListener('paste', handlePasteEvent);
  }, [showToast]);

  // Window drag & drop image listener
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => e.preventDefault();
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (files && files[0] && files[0].type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          const newClip: ClipItem = {
            id: `clip-${Date.now()}`,
            content: base64,
            type: 'image',
            imageData: base64,
            createdAt: Date.now(),
            copyCount: 0,
          };
          updateClips((prev) => [newClip, ...prev]);
          saveClipToCloud(newClip);
          playSuccessSound();
          showToast('Image Dropped', 'Added to clipboard', 'success');
        };
        reader.readAsDataURL(files[0]);
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [showToast]);

  // Recent first order
  const sortedClips = [...clips].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="min-h-screen relative flex flex-col antialiased selection:bg-sky-500/30 selection:text-sky-700 dark:selection:text-sky-300">
      {/* Ambient Glass OS Refractive Background Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-cyan-400/15 dark:bg-cyan-500/10 blur-[130px]" />
        <div className="absolute top-[30%] right-[10%] w-[600px] h-[600px] rounded-full bg-blue-400/15 dark:bg-blue-600/10 blur-[150px]" />
        <div className="absolute bottom-[10%] left-[10%] w-[450px] h-[450px] rounded-full bg-sky-300/20 dark:bg-indigo-500/10 blur-[140px]" />
      </div>

      {/* Dynamic Island Toast */}
      <DynamicIslandToast toast={toast} />

      {/* Top Glass OS Action Bar: Left = Paste, Right = Grid/List Toggle */}
      <Navbar
        onPaste={handleAutoPaste}
        viewMode={viewMode}
        onToggleViewMode={setViewMode}
        darkMode={darkMode}
        onToggleTheme={toggleTheme}
        clipsCount={clips.length}
      />

      {/* Main Stream: Pure Content Clips */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-4 pb-20">
        {sortedClips.length > 0 ? (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
                : 'flex flex-col gap-3'
            }
          >
            {sortedClips.map((clip) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                viewMode={viewMode}
                onCopy={handleCopyClip}
                onDelete={handleDeleteClip}
              />
            ))}
          </div>
        ) : (
          /* Clean Empty Glass State */
          <div
            onClick={handleAutoPaste}
            className="py-24 text-center flex flex-col items-center justify-center glass-slab rounded-2xl cursor-pointer hover:border-sky-500/50 transition-colors px-6"
          >
            <div className="w-12 h-12 rounded-xl bg-slate-200/80 dark:bg-white/[0.08] border border-slate-300 dark:border-white/15 flex items-center justify-center text-sky-600 dark:text-sky-400 mb-4">
              <span className="text-xl">📋</span>
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Clipboard is empty</p>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1 max-w-xs leading-relaxed">
              Click here or press the Paste button to grab content from your device.
            </p>
          </div>
        )}
      </main>

      {/* Apple Glass OS Floating 5-Second Undo Delete Banner */}
      {pendingDelete && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="glass-slab rounded-2xl px-4 py-2.5 flex items-center gap-3 shadow-2xl border border-white/20 dark:border-white/20 text-xs">
            <div className="flex items-center gap-2">
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span className="text-slate-800 dark:text-slate-200 font-medium">
                Clip deleted
              </span>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                ({pendingDelete.secondsRemaining}s)
              </span>
            </div>

            {/* Prominent Undo Button */}
            <button
              onClick={handleUndoDelete}
              className="px-3 py-1 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors active:scale-95"
            >
              <RotateCcw className="w-3 h-3 stroke-[2.5]" />
              <span>Undo</span>
            </button>

            {/* Dismiss immediately */}
            <button
              onClick={handleDismissUndo}
              title="Dismiss and delete permanently"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
