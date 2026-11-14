import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Info,
  CheckCheck,
  Trash2,
  ChevronRight,
  Thermometer,
  Boxes,
  FileCheck2,
  Landmark,
  ShoppingBasket,
  Truck,
  Calculator,
  CalendarClock,
} from 'lucide-react';
import type {
  EnterpriseNotification,
  EnterpriseNotificationCategory,
  EnterpriseNotificationSeverity,
} from '../../types/index.ts';

interface NotificationCenterPopoverProps {
  theme: 'light' | 'dark';
  notifications: EnterpriseNotification[];
  unreadCount: number;
  onMarkRead: (id: string) => Promise<void> | void;
  onMarkAllRead: () => Promise<void> | void;
  onClearRead: () => Promise<void> | void;
  onNavigate: (targetTab: string, targetSubTab?: string) => void;
}

type NotificationFilter = 'ALL' | 'UNREAD' | 'CRITICAL';

function formatRelativeTime(isoDate: string): string {
  const ts = new Date(isoDate).getTime();
  if (!Number.isFinite(ts)) return 'Just now';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 45) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function getCategoryMeta(category: EnterpriseNotificationCategory): {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
} {
  switch (category) {
    case 'PERISHABLES':
      return { label: 'PERISHABLES', Icon: CalendarClock };
    case 'INVENTORY':
      return { label: 'INVENTORY', Icon: Boxes };
    case 'QUALITY_CONTROL':
      return { label: 'QUALITY CONTROL', Icon: Thermometer };
    case 'PROCUREMENT_FINANCE':
      return { label: 'PROCUREMENT / FINANCE', Icon: FileCheck2 };
    case 'B2B_FINANCE':
      return { label: 'B2B FINANCE', Icon: Landmark };
    case 'FULFILLMENT':
      return { label: 'FULFILLMENT', Icon: ShoppingBasket };
    case 'LOGISTICS':
      return { label: 'LOGISTICS', Icon: Truck };
    case 'POS_OPERATIONS':
      return { label: 'POS OPERATIONS', Icon: Calculator };
    default:
      return { label: 'SYSTEM', Icon: Info };
  }
}

function getSeverityStyle(severity: EnterpriseNotificationSeverity) {
  switch (severity) {
    case 'CRITICAL':
      return {
        label: 'CRITICAL',
        badge: 'bg-rose-500/15 text-rose-700 border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/25',
        iconBox: 'bg-rose-500/15 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
        SeverityIcon: ShieldAlert,
      };
    case 'WARNING':
      return {
        label: 'WARNING',
        badge: 'bg-amber-500/15 text-amber-800 border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/25',
        iconBox: 'bg-amber-500/15 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
        SeverityIcon: AlertTriangle,
      };
    case 'ACTION_REQUIRED':
      return {
        label: 'ACTION REQUIRED',
        badge: 'bg-indigo-500/15 text-indigo-700 border-indigo-500/25 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/25',
        iconBox: 'bg-indigo-500/15 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
        SeverityIcon: Clock,
      };
    case 'INFO':
    default:
      return {
        label: 'INFO',
        badge: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/25',
        iconBox: 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
        SeverityIcon: Info,
      };
  }
}

export const NotificationCenterPopover: React.FC<NotificationCenterPopoverProps> = ({
  theme,
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onClearRead,
  onNavigate,
}) => {
  const isLight = theme === 'light';
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>('ALL');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const criticalCount = notifications.filter((n) => n.severity === 'CRITICAL' && !n.isRead).length;
  const readCount = notifications.filter((n) => n.isRead).length;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'UNREAD') return !n.isRead;
    if (filter === 'CRITICAL') return n.severity === 'CRITICAL';
    return true;
  });

  const handleNotificationClick = async (n: EnterpriseNotification) => {
    if (!n.isRead) {
      await onMarkRead(n.id);
    }
    setIsOpen(false);
    onNavigate(n.targetTab, n.targetSubTab);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Header Notification Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative p-2 rounded-xl border text-xs font-medium transition-all flex items-center justify-center cursor-pointer ${
          isLight
            ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 shadow-2xs'
            : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200'
        } ${isOpen ? (isLight ? 'ring-2 ring-[#0F4C3A]/30 border-[#0F4C3A]' : 'ring-2 ring-emerald-500/40 border-emerald-500') : ''}`}
        title="Enterprise Alerts & Action Center"
        aria-label="Open Enterprise Notifications"
        aria-expanded={isOpen}
      >
        <Bell className={`w-4 h-4 ${unreadCount > 0 ? (isLight ? 'text-[#0F4C3A]' : 'text-emerald-400') : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none flex items-center justify-center shadow-sm ring-2 ring-white dark:ring-zinc-950">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Interactive Alert Center Dropdown Popover */}
      {isOpen && (
        <div
          className={`fixed sm:absolute right-2 sm:right-0 left-2 sm:left-auto top-14 sm:top-full sm:mt-2 sm:w-96 max-h-[480px] flex flex-col rounded-2xl border shadow-2xl z-50 overflow-hidden transition-all ${
            isLight
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-zinc-900 border-zinc-800 text-zinc-100'
          }`}
        >
          {/* Popover Header */}
          <div className={`px-4 py-3 border-b flex items-center justify-between gap-2 ${isLight ? 'border-slate-200 bg-slate-50/70' : 'border-zinc-800 bg-zinc-950/60'}`}>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold tracking-tight">
                  Enterprise Alerts &amp; Action Center
                </h3>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Real-time FEFO, Stock, QC, Finance &amp; Logistics events
              </p>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => onMarkAllRead()}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  isLight
                    ? 'text-[#0F4C3A] hover:bg-emerald-500/10'
                    : 'text-emerald-400 hover:bg-emerald-500/10'
                }`}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all as read</span>
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className={`px-4 py-2 border-b flex items-center justify-between gap-2 ${isLight ? 'border-slate-100 bg-white' : 'border-zinc-800/80 bg-zinc-900'}`}>
            <div className="flex items-center gap-1.5">
              {([
                { id: 'ALL', label: `All (${notifications.length})` },
                { id: 'UNREAD', label: `Unread (${unreadCount})` },
                { id: 'CRITICAL', label: `Critical (${criticalCount})` },
              ] as { id: NotificationFilter; label: string }[]).map((pill) => {
                const active = filter === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setFilter(pill.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                      active
                        ? isLight
                          ? 'bg-[#0F4C3A] text-white'
                          : 'bg-emerald-600 text-white'
                        : isLight
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>

            {readCount > 0 && (
              <button
                type="button"
                onClick={() => onClearRead()}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
                  isLight ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-800' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
                title="Clear read notifications"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear read</span>
              </button>
            )}
          </div>

          {/* Notification Feed List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/70">
            {filteredNotifications.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <div className={`w-10 h-10 mx-auto mb-2.5 rounded-xl flex items-center justify-center ${isLight ? 'bg-slate-100 text-slate-400' : 'bg-zinc-800 text-zinc-500'}`}>
                  <Bell className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold">
                  {filter === 'UNREAD'
                    ? 'All caught up — zero unread alerts'
                    : filter === 'CRITICAL'
                    ? 'No critical alerts active'
                    : 'No operational alerts recorded'}
                </p>
                <p className={`text-[11px] mt-1 ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                  Live ERP exceptions will appear here automatically.
                </p>
              </div>
            ) : (
              filteredNotifications.map((item) => {
                const cat = getCategoryMeta(item.category);
                const sev = getSeverityStyle(item.severity);
                const CatIcon = cat.Icon;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNotificationClick(item)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors cursor-pointer group ${
                      !item.isRead
                        ? isLight
                          ? 'bg-emerald-50/45 hover:bg-emerald-50/80'
                          : 'bg-emerald-950/20 hover:bg-zinc-800/70'
                        : isLight
                        ? 'bg-white hover:bg-slate-50'
                        : 'bg-zinc-900 hover:bg-zinc-800/50'
                    }`}
                  >
                    {/* Category / Severity Icon */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${sev.iconBox}`}>
                      <CatIcon className="w-4 h-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border ${sev.badge}`}>
                            {sev.label}
                          </span>
                          <span className={`text-[10px] font-semibold truncate ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                            {cat.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-[10px] tabular-nums ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>
                            {formatRelativeTime(item.updatedAt || item.createdAt)}
                          </span>
                          {!item.isRead && (
                            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                          )}
                        </div>
                      </div>

                      <p className={`text-xs font-bold leading-snug ${isLight ? 'text-slate-900' : 'text-zinc-100'}`}>
                        {item.title}
                      </p>
                      <p className={`text-[11px] mt-0.5 leading-relaxed line-clamp-2 ${isLight ? 'text-slate-600' : 'text-zinc-300'}`}>
                        {item.message}
                      </p>

                      {item.metadataLabel && (
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-medium truncate max-w-[235px] ${
                            isLight ? 'bg-slate-100 text-slate-700' : 'bg-zinc-800 text-zinc-300'
                          }`}>
                            {item.metadataLabel}
                          </span>
                          <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity ${
                            isLight ? 'text-[#0F4C3A]' : 'text-emerald-400'
                          }`}>
                            <span>Open</span>
                            <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
