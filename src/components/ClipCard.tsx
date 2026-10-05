import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Trash2,
  ExternalLink,
  Code2,
  Palette,
  Globe,
  FileText,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ClipItem } from '../types/clipboard';
import { useTouchLongPress } from '../hooks/useTouchLongPress';
import { triggerHaptic } from '../utils/haptics';

interface ClipCardProps {
  clip: ClipItem;
  viewMode: 'grid' | 'compact';
  onCopy: (clip: ClipItem) => void;
  onDelete: (id: string) => void;
}

export const ClipCard: React.FC<ClipCardProps> = ({
  clip,
  viewMode,
  onCopy,
  onDelete,
}) => {
  const [copied, setCopied] = useState(false);
  const [expandedMassive, setExpandedMassive] = useState(false);

  // Touch-responsive long press hook for Apple-like mobile delete gesture
  const { isPressing, pressProgress, didTrigger, handlers } = useTouchLongPress({
    onLongPress: () => {
      onDelete(clip.id);
    },
    threshold: 520,
    moveTolerance: 10,
  });

  // Safe windowing for massive code snippets (prevents browser crash on 10,000+ lines)
  const { previewContent, totalLines, isMassive } = useMemo(() => {
    if (clip.type !== 'code' && clip.type !== 'text') {
      return { previewContent: clip.content, totalLines: 1, isMassive: false };
    }
    const lines = clip.content.split('\n');
    const count = lines.length;
    if (count > 45 && !expandedMassive) {
      return {
        previewContent: lines.slice(0, 35).join('\n'),
        totalLines: count,
        isMassive: true,
      };
    }
    return { previewContent: clip.content, totalLines: count, isMassive: false };
  }, [clip.content, clip.type, expandedMassive]);

  const handleCardClick = (e: React.MouseEvent) => {
    // If long press triggered delete, prevent synthetic click from copying
    if (didTrigger.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const target = e.target as HTMLElement;
    if (
      target.closest('button[data-action="delete"]') ||
      target.closest('button[data-action="toggle-expand"]') ||
      target.closest('a[data-action="link"]')
    ) {
      return;
    }

    triggerHaptic('selection');
    onCopy(clip);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleCopyButton = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('selection');
    onCopy(clip);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('delete');
    onDelete(clip.id);
  };

  const formatRelativeTime = (timestamp: number) => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const renderTypeIcon = () => {
    switch (clip.type) {
      case 'code':
        return <Code2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />;
      case 'color':
        return <Palette className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />;
      case 'url':
        return <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
      case 'image':
        return <ImageIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-neutral-400" />;
    }
  };

  // Compact View
  if (viewMode === 'compact') {
    return (
      <div
        onClick={handleCardClick}
        {...handlers}
        className={`glass-slab rounded-xl px-4 py-3 flex items-center justify-between gap-4 cursor-pointer group select-none relative apple-card-press touch-card transition-all duration-300 overflow-hidden ${
          isPressing
            ? 'scale-[0.98] ring-2 ring-rose-500/70 shadow-[0_0_28px_rgba(244,63,94,0.35)] border-rose-500/60 bg-rose-500/[0.08] dark:bg-rose-950/30'
            : ''
        }`}
      >
        {/* Apple HUD overlay during touch long-press */}
        {isPressing && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md rounded-xl px-4 animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
            <div className="flex items-center gap-2.5 text-white">
              <div className="relative w-6 h-6 flex items-center justify-center">
                <svg className="w-6 h-6 -rotate-90">
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    className="stroke-white/20"
                    strokeWidth="2.5"
                    fill="none"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    className="stroke-rose-500 transition-all duration-75 ease-linear"
                    strokeWidth="2.5"
                    strokeDasharray={56.5}
                    strokeDashoffset={56.5 - (56.5 * pressProgress) / 100}
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
                <Trash2 className="w-3 h-3 text-rose-500 absolute" />
              </div>
              <span className="text-xs font-semibold tracking-tight text-white font-mono">
                {pressProgress >= 90 ? 'Deleting…' : 'Hold to delete'}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="p-2 rounded-lg bg-black/[0.05] dark:bg-black/40 border border-black/[0.08] dark:border-white/10 shrink-0">
            {renderTypeIcon()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-mono text-slate-900 dark:text-neutral-100 truncate">
              {clip.content.replace(/\n/g, ' ')}
            </p>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5">
              <span className="capitalize">{clip.language || clip.type}</span>
              {totalLines > 1 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{totalLines.toLocaleString()} lines</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>{formatRelativeTime(clip.createdAt)}</span>
              <span className="md:hidden text-[10px] text-slate-400 dark:text-neutral-500">
                · Hold to delete
              </span>
            </div>
          </div>
        </div>

        {/* Distinct Action Buttons: Copy (Blue) & Delete (Rose) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopyButton}
            title="Click to copy"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors ${
              copied
                ? 'bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-400/50'
                : 'btn-copy'
            }`}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            data-action="delete"
            onClick={handleDelete}
            title="Delete from clipboard"
            className="btn-delete p-1.5 rounded-lg cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Grid View (Standard)
  return (
    <div
      onClick={handleCardClick}
      {...handlers}
      className={`glass-slab rounded-2xl p-5 flex flex-col justify-between cursor-pointer group select-none relative min-h-[180px] apple-card-press touch-card transition-all duration-300 overflow-hidden ${
        isPressing
          ? 'scale-[0.975] ring-2 ring-rose-500/70 shadow-[0_0_35px_rgba(244,63,94,0.35)] border-rose-500/60 bg-rose-500/[0.08] dark:bg-rose-950/30'
          : ''
      }`}
    >
      {/* Apple Fluid HUD Long-press Deletion Ring Overlay */}
      {isPressing && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 dark:bg-black/75 backdrop-blur-md rounded-2xl animate-in fade-in zoom-in-95 duration-150 pointer-events-none p-4">
          <div className="px-4 py-2.5 rounded-full bg-neutral-900/95 dark:bg-neutral-900/95 border border-rose-500/50 shadow-2xl flex items-center gap-3">
            <div className="relative w-7 h-7 flex items-center justify-center">
              <svg className="w-7 h-7 -rotate-90">
                <circle
                  cx="14"
                  cy="14"
                  r="11"
                  className="stroke-white/15"
                  strokeWidth="2.5"
                  fill="none"
                />
                <circle
                  cx="14"
                  cy="14"
                  r="11"
                  className="stroke-rose-500 transition-all duration-75 ease-linear"
                  strokeWidth="2.5"
                  strokeDasharray={69.1}
                  strokeDashoffset={69.1 - (69.1 * pressProgress) / 100}
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
              <Trash2 className="w-3.5 h-3.5 text-rose-500 absolute animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-white tracking-tight">
                {pressProgress >= 90 ? 'Deleting Clip…' : 'Hold to Delete'}
              </span>
              <span className="text-[10px] text-neutral-400 font-mono">
                Release to cancel
              </span>
            </div>
          </div>
        </div>
      )}
      {/* Top Header: Content Format & Line count / Relative time */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-black/[0.08] dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-black/[0.05] dark:bg-black/40 border border-black/[0.08] dark:border-white/10 shrink-0">
            {renderTypeIcon()}
          </div>
          <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-700 dark:text-neutral-300 font-mono">
            {clip.language || clip.type}
          </span>
          {totalLines > 1 && (
            <span className="text-[11px] font-mono text-slate-500 dark:text-neutral-400">
              · {totalLines.toLocaleString()} lines
            </span>
          )}
        </div>

        <div className="text-[11px] text-slate-500 dark:text-neutral-400 font-mono">
          {formatRelativeTime(clip.createdAt)}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="py-4 flex-1 flex flex-col justify-center">
        {/* TYPE: CODE (Safe against 10,000+ lines crash) */}
        {clip.type === 'code' && (
          <div className="relative">
            <pre className="font-mono text-xs text-slate-900 dark:text-neutral-100 bg-slate-100/90 dark:bg-black/55 border border-slate-200/90 dark:border-white/10 p-3.5 rounded-xl overflow-x-auto max-h-52 leading-relaxed whitespace-pre font-normal selection:bg-sky-500/25">
              <code>{previewContent}</code>
            </pre>

            {/* Truncation / Safety banner for large snippets */}
            {isMassive && (
              <div className="mt-2 p-2 rounded-lg bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-400/20 flex items-center justify-between text-[11px] text-sky-800 dark:text-sky-300">
                <span>
                  Showing first 35 of {totalLines.toLocaleString()} lines
                </span>
                <button
                  type="button"
                  data-action="toggle-expand"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedMassive(true);
                  }}
                  className="px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-500/20 hover:bg-sky-200 dark:hover:bg-sky-500/30 text-sky-800 dark:text-sky-200 font-mono flex items-center gap-1 cursor-pointer"
                >
                  <span>Expand All</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
            )}

            {expandedMassive && totalLines > 45 && (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  data-action="toggle-expand"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedMassive(false);
                  }}
                  className="text-[11px] text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <span>Collapse Preview</span>
                  <ChevronUp className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* TYPE: COLOR */}
        {clip.type === 'color' && (
          <div className="flex flex-col gap-3">
            <div
              className="w-full h-24 rounded-xl border border-black/10 dark:border-white/20 shadow-md flex items-center justify-center relative overflow-hidden"
              style={{ backgroundColor: clip.colorHex || clip.content }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
              <span className="relative z-10 text-xs font-mono font-bold px-3 py-1.5 rounded-lg bg-black/75 text-white backdrop-blur-md border border-white/15 shadow-sm">
                {clip.colorHex || clip.content}
              </span>
            </div>
            {clip.colorRgb && (
              <span className="text-xs font-mono text-slate-600 dark:text-neutral-400 text-center">
                {clip.colorRgb}
              </span>
            )}
          </div>
        )}

        {/* TYPE: URL */}
        {clip.type === 'url' && (
          <div className="p-3.5 rounded-xl bg-slate-100/90 dark:bg-black/35 border border-slate-200/90 dark:border-white/10 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="text-xs font-mono text-sky-600 dark:text-sky-400 truncate block font-medium">
                {clip.content}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-neutral-400 mt-0.5 block">
                Click to copy · open icon to visit
              </span>
            </div>
            <a
              data-action="link"
              href={clip.content.startsWith('http') ? clip.content : `https://${clip.content}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-2 rounded-lg glass-button text-slate-600 hover:text-slate-900 dark:text-neutral-300 dark:hover:text-white cursor-pointer shrink-0"
              title="Open link in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* TYPE: IMAGE */}
        {clip.type === 'image' && (
          <div className="rounded-xl overflow-hidden bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 max-h-48 flex items-center justify-center p-2">
            <img
              src={clip.imageData || clip.content}
              alt="Clipboard image"
              className="max-h-44 object-contain rounded-lg w-full"
            />
          </div>
        )}

        {/* TYPE: TEXT (Safe against 10,000+ lines crash) */}
        {clip.type === 'text' && (
          <div className="text-xs text-slate-900 dark:text-neutral-100 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap select-text font-normal">
            {previewContent}
            {isMassive && (
              <p className="mt-2 text-[11px] text-slate-500 dark:text-neutral-400 font-mono">
                ... ({totalLines.toLocaleString()} total lines)
              </p>
            )}
          </div>
        )}
      </div>

      {/* Bottom Bar: Clean with Distinct Copy (Blue) & Delete (Rose) Buttons */}
      <div className="pt-3 border-t border-black/[0.08] dark:border-white/10 flex items-center justify-between text-xs">
        {/* Subtle Format / Meta Indicator on Left with mobile touch hint */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-500 dark:text-neutral-400">
            {clip.type.toUpperCase()}
          </span>
          <span className="md:hidden text-[10px] font-mono text-slate-400 dark:text-neutral-500">
            · Hold to delete
          </span>
        </div>

        {/* Action Buttons: Blue Copy & Rose Delete */}
        <div className="flex items-center gap-2">
          {/* Distinct Blue Copy Button */}
          <button
            onClick={handleCopyButton}
            title="Copy content to clipboard"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors ${
              copied
                ? 'bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-400/50'
                : 'btn-copy'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Distinct Rose Delete Button */}
          <button
            data-action="delete"
            onClick={handleDelete}
            title="Delete clip"
            className="btn-delete p-1.5 rounded-lg cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
