import React, { useEffect, useState, useCallback } from "react";
import type { ChangeEvent } from "react";
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  ConversationSummary, ActivitySummaryData, WeeklyReport,
  OutcomeType, Message, InsightsData,
} from '../types';
import {
  Coins, Search, Clock, HeartPulse, ShieldQuestion, CalendarDays, CreditCard,
  MessageCircle, CheckCircle2, MessageSquare, Hourglass, Bot, Users, TrendingUp, AlertTriangle,
  CheckCircle, BarChart3, Rocket,
} from 'lucide-react';

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;


// ── Constants ─────────────────────────────────────────────────────────────────

const SCENARIO_CONFIG: Record<string, { label: string; color: string }> = {
  new_enquiry:       { label: 'New Enquiry',       color: 'bg-blue-900   text-blue-300   border border-blue-700'   },
  finance_objection: { label: 'Finance Objection', color: 'bg-yellow-900 text-yellow-300 border border-yellow-700' },
  cold_lead:         { label: 'Cold Lead',         color: 'bg-purple-900 text-purple-300 border border-purple-700' },
  missed_call:       { label: 'Missed Call',       color: 'bg-orange-900 text-orange-300 border border-orange-700' },
};

const OBJECTION_CONFIG: Record<string, { label: string; icon: IconComponent; color: string }> = {
  price_too_high:        { label: 'Price',        icon: Coins,           color: 'bg-red-900    text-red-300    border border-red-700'    },
  comparing_competitors: { label: 'Comparing',    icon: Search,          color: 'bg-blue-900   text-blue-300   border border-blue-700'   },
  timing_issue:          { label: 'Not Ready',    icon: Clock,           color: 'bg-yellow-900 text-yellow-300 border border-yellow-700' },
  anxiety_fear:          { label: 'Anxiety',      icon: HeartPulse,      color: 'bg-purple-900 text-purple-300 border border-purple-700' },
  trust_concern:         { label: 'Trust',        icon: ShieldQuestion,  color: 'bg-orange-900 text-orange-300 border border-orange-700' },
  availability:          { label: 'Availability', icon: CalendarDays,    color: 'bg-cyan-900   text-cyan-300   border border-cyan-700'   },
  finance_options:       { label: 'Finance',      icon: CreditCard,      color: 'bg-green-900  text-green-300  border border-green-700'  },
  general_enquiry:       { label: 'Enquiry',      icon: MessageCircle,   color: 'bg-gray-800   text-gray-400   border border-gray-600'   },
};

const OUTCOME_CONFIG: Record<OutcomeType, { label: string; color: string; icon: IconComponent | string }> = {
  booked:      { label: 'Booked ✓',      color: 'bg-green-900  text-green-300  border border-green-700',  icon: CheckCircle2   },
  replied:     { label: 'Still Talking', color: 'bg-blue-900   text-blue-300   border border-blue-700',   icon: MessageSquare  },
  no_response: { label: 'No Response',  color: 'bg-gray-800   text-gray-400   border border-gray-600',   icon: Hourglass      },
  lost:        { label: 'Lost',         color: 'bg-red-900    text-red-300    border border-red-700',    icon: '✗'            },
};

const LANG_FLAGS: Record<string, string> = { en: '🇬🇧', tr: '🇹🇷', ar: '🇸🇦', es: '🇪🇸', ru: '🇷🇺' };

function formatTimeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatCurrency(n: number | null): string {
  if (n == null) return '—';
  return `€${n.toLocaleString()}`;
}

function formatResponseTime(secs: number): string {
  if (secs < 60)   return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${Math.floor(secs / 3600)}h`;
}

function trendIcon(cur: number, prev: number): string {
  if (prev === 0) return cur > 0 ? '↑' : '—';
  return cur > prev ? '↑' : cur < prev ? '↓' : '→';
}
function trendColor(cur: number, prev: number, higher = true): string {
  if (cur === prev) return 'text-gray-400';
  const better = higher ? cur > prev : cur < prev;
  return better ? 'text-green-400' : 'text-red-400';
}

// ── Delivery status steps ─────────────────────────────────────────────────────

type DeliveryStep = 'sent' | 'delivered' | 'read' | 'replied';

function getStepsDone(status: string | null, hasReply: boolean): number {
  if (hasReply) return 4;
  if (status === 'read') return 3;
  if (status === 'delivered') return 2;
  if (status === 'sent') return 1;
  return 0;
}

function DeliveryProgress({ status, hasReply }: { status: string | null; hasReply: boolean }) {
  const steps: DeliveryStep[] = ['sent', 'delivered', 'read', 'replied'];
  const done = getStepsDone(status, hasReply);
  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => (
        <React.Fragment key={step}>
          <div
            title={step.charAt(0).toUpperCase() + step.slice(1)}
            className={`w-2 h-2 rounded-full transition-all ${
              i < done ? 'bg-accent' : 'bg-line'
            }`}
          />
          {i < steps.length - 1 && (
            <div className={`w-3 h-px ${i < done - 1 ? 'bg-accent' : 'bg-line'}`} />
          )}
        </React.Fragment>
      ))}
      <span className="text-gray-500 text-[10px] ml-1">
        {hasReply ? 'replied' : status || 'pending'}
      </span>
    </div>
  );
}

// ── Conversation Card ─────────────────────────────────────────────────────────

interface CardProps {
  conv: ConversationSummary;
  showClinic: boolean;
  onTakeOver: (leadId: string) => Promise<void>;
}

function ConversationCard({ conv, showClinic, onTakeOver }: CardProps) {
  const [expanded,     setExpanded]     = useState(false);
  const [messages,     setMessages]     = useState<Message[] | null>(null);
  const [msgLoading,   setMsgLoading]   = useState(false);
  const [takingOver,   setTakingOver]   = useState(false);
  const [showReply,    setShowReply]    = useState(false);
  const [replyText,    setReplyText]    = useState('');
  const [sending,      setSending]      = useState(false);
  const [sent,         setSent]         = useState(false);

  async function toggleExpand() {
    setExpanded(e => !e);
    if (!messages && !msgLoading) {
      setMsgLoading(true);
      try {
        const res = await api.get<{ messages: Message[] }>(`/api/leads/${conv.leadId}/messages`);
        setMessages(res.data.messages);
      } catch { setMessages([]); }
      finally { setMsgLoading(false); }
    }
  }

  async function handleTakeOver(e: React.MouseEvent) {
    e.stopPropagation();
    setTakingOver(true);
    await onTakeOver(conv.leadId);
    setTakingOver(false);
  }

  async function handleSendReply(e: React.MouseEvent) {
    e.stopPropagation();
    if (!replyText.trim() || sending) return;
    setSending(true);
    try {
      await api.post(`/api/clinics/${conv.clinicId}/send-message`, {
        to: conv.phone,
        message: replyText.trim(),
      });
      setSent(true);
      setReplyText('');
      setTimeout(() => { setSent(false); setShowReply(false); }, 2000);
    } catch {
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  }

  const scenarioCfg  = conv.scenario     ? SCENARIO_CONFIG[conv.scenario]       : null;
  const objectionCfg = (conv.objectionType && conv.objectionType !== 'general_enquiry')
    ? OBJECTION_CONFIG[conv.objectionType as string] : null;
  const outcomeCfg  = OUTCOME_CONFIG[conv.outcome];
  const hasReply    = !!conv.lastReplyContent;

  return (
    <div className={`bg-surface-sunken border rounded-xl overflow-hidden transition-colors ${
      conv.actionRequired ? 'border-yellow-800/60' : 'border-line'
    }`}>
      {/* ── Card header ── */}
      <div className="px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">

          {/* Left: avatar + name */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`w-10 h-10 rounded-full border flex items-center justify-center text-sm font-semibold shrink-0 ${
              conv.actionRequired
                ? 'bg-yellow-950 border-yellow-700 text-yellow-300'
                : 'bg-surface-sunken border-line-strong text-white'
            }`}>
              {conv.patientName.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-medium text-sm">{conv.patientName}</span>
                <span className="text-gray-500 text-xs">{LANG_FLAGS[conv.language] ?? '🌐'}</span>
                {showClinic && <span className="text-gray-500 text-xs">{conv.clinic}</span>}
                {conv.actionRequired && (
                  <span className="text-xs bg-yellow-950 text-yellow-400 border border-yellow-700 px-1.5 py-0.5 rounded-full">
                    Action needed
                  </span>
                )}
              </div>
              <p className="text-gray-500 text-xs mt-0.5">{conv.phone}</p>
              {conv.treatment && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {conv.treatment}
                  {conv.treatmentValue != null && (
                    <span className="text-accent ml-1">{formatCurrency(conv.treatmentValue)}</span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Right: badges + time */}
          <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 flex-wrap justify-start sm:justify-end">
              {scenarioCfg && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${scenarioCfg.color}`}>
                  {scenarioCfg.label}
                </span>
              )}
              {objectionCfg && (
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${objectionCfg.color}`} title="Detected objection">
                  {(() => { const Icon = objectionCfg.icon; return <Icon size={12} />; })()} {objectionCfg.label}
                </span>
              )}
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${outcomeCfg.color}`}>
                {typeof outcomeCfg.icon === 'string'
                  ? outcomeCfg.icon
                  : (() => { const Icon = outcomeCfg.icon as IconComponent; return <Icon size={12} />; })()
                } {outcomeCfg.label}
              </span>
            </div>
            <span className="text-gray-600 text-xs">{formatTimeAgo(conv.lastAiAt)}</span>
          </div>
        </div>

        {/* Message previews + delivery + actions */}
        <div className="mt-3 space-y-2">
          {conv.lastAiContent && (
            <div className="flex items-start gap-2">
              <span className="text-gray-600 w-5 shrink-0 mt-0.5 flex items-center"><Bot size={14} /></span>
              <p className="text-gray-400 text-xs leading-relaxed line-clamp-2 flex-1">
                {conv.lastAiContent.length > 120
                  ? conv.lastAiContent.slice(0, 120) + '…'
                  : conv.lastAiContent}
              </p>
            </div>
          )}
          {hasReply && (
            <div className="flex items-start gap-2">
              <span className="text-gray-600 w-5 shrink-0 mt-0.5 flex items-center"><MessageSquare size={14} /></span>
              <p className="text-gray-300 text-xs leading-relaxed line-clamp-1 flex-1">
                {conv.lastReplyContent!.length > 100
                  ? conv.lastReplyContent!.slice(0, 100) + '…'
                  : conv.lastReplyContent}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <DeliveryProgress status={conv.deliveryStatus} hasReply={hasReply} />
            <div className="flex items-center gap-2">
              <span className="text-gray-600 text-xs">{conv.aiMessages} AI msg{conv.aiMessages !== 1 ? 's' : ''}</span>
              {conv.aiFollowUpEnabled && conv.outcome !== 'booked' && (
                <button
                  onClick={handleTakeOver}
                  disabled={takingOver}
                  className="text-xs text-gray-400 hover:text-white bg-surface-sunken hover:bg-line border border-line-strong px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                >
                  {takingOver ? '…' : 'Take Over'}
                </button>
              )}
              {!conv.aiFollowUpEnabled && (
                <>
                  <span className="text-xs text-orange-400 border border-orange-800 bg-orange-950 px-2 py-0.5 rounded-full">
                    Human handling
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowReply(r => !r); }}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/30 hover:bg-[#25D366]/20 transition-colors"
                  >
                    <MessageCircle size={14} /> Reply via WhatsApp
                  </button>
                </>
              )}
              <button
                onClick={toggleExpand}
                className="text-gray-500 hover:text-white transition-colors text-sm ml-1"
                title={expanded ? 'Collapse' : 'Expand conversation'}
              >
                {expanded ? '▲' : '▼'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showReply && (
        <div className="border-t border-line bg-surface px-5 py-3 flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <input
            type="text"
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSendReply(e as any); }}
            placeholder="Type your message..."
            className="flex-1 bg-surface-sunken border border-line rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#25D366]/50"
            autoFocus
          />
          <button
            onClick={handleSendReply}
            disabled={sending || !replyText.trim()}
            className="text-xs px-3 py-1.5 rounded-lg bg-[#25D366] text-white disabled:opacity-40 hover:bg-[#20b858] transition-colors"
          >
            {sending ? '…' : sent ? '✓ Sent' : 'Send'}
          </button>
        </div>
      )}

      {/* ── Expanded thread ── */}
      {expanded && (
        <div className="border-t border-line bg-surface px-5 py-4 max-h-80 overflow-y-auto space-y-3">
          {msgLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !messages?.length ? (
            <p className="text-gray-600 text-xs text-center py-3">No messages yet.</p>
          ) : (
            messages.map(msg => {
              const isOut = msg.direction === 'outbound';
              return (
                <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs ${
                    isOut
                      ? 'bg-accent text-white rounded-br-sm'
                      : 'bg-surface-sunken text-gray-200 rounded-bl-sm'
                  }`}>
                    <p className="leading-relaxed">{msg.content}</p>
                    <div className={`flex items-center gap-1 mt-1 ${isOut ? 'justify-end' : ''}`}>
                      <span className={`text-[10px] ${isOut ? 'text-white/70' : 'text-gray-500'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isOut && msg.aiGenerated && (
                        <span className="text-[10px] text-white/70">· AI</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── Receptionist simplified card ──────────────────────────────────────────────

interface ActionCardProps {
  conv: ConversationSummary;
  onMarkCalled: (leadId: string) => Promise<void>;
  onResolve: (leadId: string) => Promise<void>;
}

function ActionRequiredCard({ conv, onMarkCalled, onResolve }: ActionCardProps) {
  const [marking,     setMarking]     = useState(false);
  const [resolving,   setResolving]   = useState(false);
  const [composing,   setComposing]   = useState(false);
  const [message,     setMessage]     = useState('');
  const [sending,     setSending]     = useState(false);
  const [sendStatus,  setSendStatus]  = useState<'idle' | 'ok' | 'error'>('idle');
  const [sendError,   setSendError]   = useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea when compose box opens
  React.useEffect(() => {
    if (composing) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [composing]);

  async function handleMark(e: React.MouseEvent) {
    e.stopPropagation();
    setMarking(true);
    await onMarkCalled(conv.leadId);
    setMarking(false);
  }

  async function handleResolve(e: React.MouseEvent) {
    e.stopPropagation();
    setResolving(true);
    await onResolve(conv.leadId);
    setResolving(false);
  }

  async function handleSend(e: React.MouseEvent) {
    e.stopPropagation();
    if (!message.trim() || sending) return;
    setSending(true);
    setSendStatus('idle');
    try {
      await api.post(`/api/clinics/${conv.clinicId}/send-message`, {
        to:      conv.phone,
        message: message.trim(),
        leadId:  conv.leadId,
      });
      setSendStatus('ok');
      setMessage('');
      // Collapse compose box after short delay
      setTimeout(() => {
        setComposing(false);
        setSendStatus('idle');
      }, 1800);
    } catch (err: unknown) {
      setSendStatus('error');
      setSendError((err as any)?.response?.data?.error || 'Failed to send message');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd/Ctrl + Enter to send
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend(e as unknown as React.MouseEvent);
    }
    if (e.key === 'Escape') {
      setComposing(false);
      setMessage('');
      setSendStatus('idle');
    }
  }

  return (
    <div className="bg-surface-sunken border border-yellow-800/50 rounded-xl p-5">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-yellow-950 border border-yellow-700 flex items-center justify-center text-yellow-300 font-semibold text-sm shrink-0">
          {conv.patientName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-base">
            {conv.patientName}
            <span className="text-gray-500 font-normal text-sm ml-2">· {LANG_FLAGS[conv.language] ?? '🌐'}</span>
          </p>
          <p className="text-gray-400 text-sm mt-0.5">
            {conv.phone}
            {conv.clinic && <span className="text-gray-500 ml-2">· {conv.clinic}</span>}
          </p>
          {conv.treatment && (
            <p className="text-gray-300 text-sm mt-1.5">
              Interested in <strong className="text-white">{conv.treatment}</strong>
              {conv.treatmentValue && <span className="text-accent ml-1">{formatCurrency(conv.treatmentValue)}</span>}
              {' '}— hasn't booked yet
            </p>
          )}
          {conv.lastReplyContent && (
            <p className="text-gray-500 text-xs mt-1.5 italic">
              Last said: "{conv.lastReplyContent.slice(0, 80)}{conv.lastReplyContent.length > 80 ? '…' : ''}"
            </p>
          )}
          <p className="text-gray-600 text-xs mt-1">{conv.aiMessages} AI messages sent · last {formatTimeAgo(conv.lastAiAt)}</p>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {/* Reply on WhatsApp — toggles compose box */}
            <button
              onClick={e => { e.stopPropagation(); setComposing(c => !c); setSendStatus('idle'); }}
              className={`inline-flex items-center gap-1.5 border text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                composing
                  ? 'bg-[#25D366]/20 text-[#25D366] border-[#25D366]/50'
                  : 'bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border-[#25D366]/30'
              }`}
            >
              <MessageCircle size={14} /> {composing ? 'Cancel reply' : 'Reply on WhatsApp'}
            </button>

            {/* Mark as Called */}
            <button
              onClick={handleMark}
              disabled={marking || resolving}
              className="inline-flex items-center gap-1.5 bg-blue-900/50 hover:bg-blue-900 text-blue-300 border border-blue-700/50 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {marking && <span className="w-3 h-3 border border-blue-300 border-t-transparent rounded-full animate-spin" />}
              ✓ Mark as Called
            </button>

            {/* Resolve — clears action_required, re-enables AI */}
            <button
              onClick={handleResolve}
              disabled={marking || resolving}
              className="inline-flex items-center gap-1.5 bg-green-900/50 hover:bg-green-900 text-green-300 border border-green-700/50 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {resolving && <span className="w-3 h-3 border border-green-300 border-t-transparent rounded-full animate-spin" />}
              <CheckCircle size={14} /> Resolve
            </button>
          </div>

          {/* Inline compose box */}
          {composing && (
            <div className="mt-3 bg-surface border border-[#25D366]/20 rounded-xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-sunken">
                <MessageCircle size={14} className="text-[#25D366] shrink-0" />
                <span className="text-gray-400 text-xs">
                  Sending as <strong className="text-gray-200">{conv.clinic}</strong> → {conv.patientName} ({conv.phone})
                </span>
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={message}
                onChange={e => { setMessage(e.target.value); setSendStatus('idle'); }}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${conv.patientName}…`}
                rows={3}
                className="w-full bg-transparent px-4 py-3 text-white text-sm placeholder-gray-600 resize-none focus:outline-none"
              />

              {/* Status feedback */}
              {sendStatus === 'ok' && (
                <div className="px-4 pb-2 text-xs text-green-400 flex items-center gap-1">
                  <CheckCircle size={14} /> Sent via WhatsApp
                </div>
              )}
              {sendStatus === 'error' && (
                <div className="px-4 pb-2 text-xs text-red-400 flex items-center gap-1">
                  <span>❌</span> {sendError}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between px-3 py-2 border-t border-surface-sunken bg-surface/50">
                <span className="text-gray-600 text-xs">⌘↵ to send · Esc to cancel</span>
                <div className="flex gap-2">
                  <button
                    onClick={e => { e.stopPropagation(); setComposing(false); setMessage(''); setSendStatus('idle'); }}
                    className="text-xs text-gray-500 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={!message.trim() || sending}
                    className="inline-flex items-center gap-1.5 bg-[#25D366] hover:bg-[#20b558] text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                  >
                    {sending && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Period helpers ─────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { value: 'today',     label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_7',    label: 'Last 7 Days' },
  { value: 'last_30',   label: 'Last 30 Days' },
  { value: 'last_90',   label: 'Last 90 Days' },
  { value: 'custom',    label: 'Custom Range' },
];

// ── Weekly Report Card ────────────────────────────────────────────────────────

interface WeeklyReportCardProps {
  onExport: (opts: { period: string; dateFrom: string; dateTo: string }) => void;
  isExporting: boolean;
}

function WeeklyReportCard({ onExport, isExporting }: WeeklyReportCardProps) {
  const [open,     setOpen]     = useState(true);
  const [period,   setPeriod]   = useState('this_week');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [report,   setReport]   = useState<WeeklyReport | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (period === 'custom' && (!dateFrom || !dateTo)) return;
    setLoading(true);
    const params: Record<string, string> = { period };
    if (period === 'custom') { params.date_from = dateFrom; params.date_to = dateTo; }
    api.get<WeeklyReport>('/api/activity/weekly-report', { params })
      .then(r => setReport(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period, dateFrom, dateTo]);

  const c = report?.current;
  const p = report?.previous;
  const compareLabel = report?.compareLabel ?? 'vs last period';

  const stats = c && p ? [
    {
      label: 'Leads Recovered',
      cur: c.leadsRecovered, prev: p.leadsRecovered,
      fmt: (v: number) => String(v), higher: true,
    },
    {
      label: 'Pipeline Created',
      cur: c.pipelineValue, prev: p.pipelineValue,
      fmt: (v: number) => formatCurrency(v), higher: true,
    },
    {
      label: 'Bookings Made',
      cur: c.bookingsMade, prev: p.bookingsMade,
      fmt: (v: number) => String(v), higher: true,
    },
    {
      label: 'Avg Response',
      cur: c.avgResponseSecs, prev: p.avgResponseSecs,
      fmt: (v: number) => formatResponseTime(v), higher: false,
    },
  ] : [];

  const topScenarioCfg = c?.topScenario ? SCENARIO_CONFIG[c.topScenario] : null;

  return (
    <div className="bg-surface-sunken border border-line rounded-xl overflow-hidden">
      {/* Header row */}
      <div className="px-6 py-4 flex items-center justify-between gap-4">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-3 flex-1 text-left"
        >
          <BarChart3 size={18} />
          <div>
            <p className="text-white font-medium text-sm">Performance Report</p>
            {c && !loading && (
              <p className="text-gray-500 text-xs">
                {c.leadsRecovered} leads · {formatCurrency(c.pipelineValue)} pipeline · {c.bookingsMade} bookings
              </p>
            )}
          </div>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {/* Period selector */}
          <select
            value={period}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setPeriod(e.target.value)}
            onClick={e => e.stopPropagation()}
            className="bg-surface-sunken border border-line-strong rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-accent transition-colors"
          >
            {PERIOD_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <button
            onClick={e => { e.stopPropagation(); onExport({ period, dateFrom, dateTo }); }}
            disabled={isExporting}
            className="text-xs text-accent hover:text-accent-hover border border-accent/30 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {isExporting
              ? <span className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
              : '↓'}
            Export CSV
          </button>
          <button onClick={() => setOpen(o => !o)} className="text-gray-500 text-sm px-1">
            {open ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Custom date pickers */}
      {period === 'custom' && (
        <div className="px-6 pb-3 flex items-center gap-3 border-t border-surface-sunken">
          <span className="text-gray-500 text-xs">From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="bg-surface-sunken border border-line-strong rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-accent transition-colors"
          />
          <span className="text-gray-500 text-xs">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="bg-surface-sunken border border-line-strong rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      )}

      {open && (
        <div className="px-6 pb-5 border-t border-line">
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-500 text-sm">Loading report…</span>
            </div>
          ) : !c ? (
            <p className="text-gray-600 text-sm text-center py-6">No data available.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                {stats.map(s => {
                  const icon    = trendIcon(s.cur, s.prev);
                  const color   = trendColor(s.cur, s.prev, s.higher);
                  const pctDiff = s.prev > 0
                    ? Math.round(Math.abs(s.cur - s.prev) / s.prev * 100)
                    : null;
                  return (
                    <div key={s.label} className="bg-surface-sunken border border-line-strong rounded-xl p-4">
                      <p className="text-gray-500 text-xs mb-2">{s.label}</p>
                      <p className="text-white text-xl font-semibold">{s.fmt(s.cur)}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className={`text-xs font-medium ${color}`}>
                          {icon} {pctDiff != null ? `${pctDiff}%` : '—'} {compareLabel}
                        </span>
                      </div>
                      <p className="text-gray-600 text-xs mt-0.5">Prior: {s.fmt(s.prev)}</p>
                    </div>
                  );
                })}
              </div>
              {topScenarioCfg && (
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                  <span>Top scenario:</span>
                  <span className={`px-2 py-0.5 rounded-full font-medium ${topScenarioCfg.color}`}>
                    {topScenarioCfg.label}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Summary Bar ───────────────────────────────────────────────────────────────

function SummaryBar({ data, onPendingClick }: { data: ActivitySummaryData; onPendingClick: () => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      {([
        { label: "Today's AI Messages", value: data.todayMessages,        icon: Bot,           accent: false },
        { label: 'Leads Contacted',     value: data.todayLeadsContacted,  icon: Users,         accent: false },
        { label: 'Reply Rate',          value: `${data.replyRate}%`,      icon: MessageCircle, accent: true  },
        { label: 'Conversion Rate',     value: `${data.conversionRate}%`, icon: TrendingUp,    accent: true  },
        {
          label: 'Pending Actions',
          value: data.pendingActions,
          icon: AlertTriangle,
          accent: false,
          badge: data.pendingActions > 0,
          clickable: true,
        },
      ] as { label: string; value: string | number; icon: IconComponent; accent: boolean; badge?: boolean; clickable?: boolean }[]).map(card => (
        <div
          key={card.label}
          onClick={card.clickable ? onPendingClick : undefined}
          className={`bg-surface-sunken border rounded-xl p-4 ${'clickable' in card && card.clickable ? 'cursor-pointer hover:border-yellow-700/60 hover:bg-surface-sunken transition-colors' : ''} ${
            'badge' in card && card.badge ? 'border-yellow-800/50' : 'border-line'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider leading-tight">{card.label}</span>
            {(() => { const Icon = card.icon; return <Icon size={20} className="text-gray-400" />; })()}
          </div>
          <div className="flex items-end gap-1.5">
            <span className={`text-2xl font-semibold ${card.accent ? 'text-accent' : 'badge' in card && card.badge ? 'text-yellow-400' : 'text-white'}`}>
              {card.value}
            </span>
            {'badge' in card && card.badge ? (
              <span className="text-xs text-yellow-400 bg-yellow-950 border border-yellow-800 px-1.5 py-0.5 rounded-full mb-0.5">
                needs attention
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Filters Bar ───────────────────────────────────────────────────────────────

interface Filters {
  dateRange: string;
  clinicId: string;
  scenario: string;
  outcome: string;
  language: string;
}

interface FiltersBarProps {
  filters: Filters;
  clinicOptions: { id: string; name: string }[];
  showClinicFilter: boolean;
  onChange: (f: Filters) => void;
  onExport: () => void;
  isExporting: boolean;
}

const SEL = 'bg-surface-sunken border border-line rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-accent transition-colors';

function FiltersBar({ filters, clinicOptions, showClinicFilter, onChange, onExport, isExporting }: FiltersBarProps) {
  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    onChange({ ...filters, [k]: e.target.value });

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Date range */}
      <select className={SEL} value={filters.dateRange} onChange={set('dateRange')}>
        <option value="all">All Time</option>
        <option value="today">Today</option>
        <option value="this_week">This Week</option>
        <option value="this_month">This Month</option>
      </select>

      {/* Clinic (super_admin only) */}
      {showClinicFilter && (
        <select className={SEL} value={filters.clinicId} onChange={set('clinicId')}>
          <option value="">All Clinics</option>
          {clinicOptions.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}

      {/* Scenario */}
      <select className={SEL} value={filters.scenario} onChange={set('scenario')}>
        <option value="all">All Scenarios</option>
        <option value="new_enquiry">New Enquiry</option>
        <option value="finance_objection">Finance Objection</option>
        <option value="cold_lead">Cold Lead</option>
        <option value="missed_call">Missed Call</option>
      </select>

      {/* Outcome */}
      <select className={SEL} value={filters.outcome} onChange={set('outcome')}>
        <option value="all">All Outcomes</option>
        <option value="booked">Booked</option>
        <option value="replied">Replied</option>
        <option value="no_response">No Response</option>
        <option value="lost">Lost</option>
      </select>

      {/* Language */}
      <select className={SEL} value={filters.language} onChange={set('language')}>
        <option value="all">All Languages</option>
        <option value="en">🇬🇧 English</option>
        <option value="tr">🇹🇷 Turkish</option>
        <option value="ar">🇸🇦 Arabic</option>
        <option value="es">🇪🇸 Spanish</option>
        <option value="ru">🇷🇺 Russian</option>
      </select>

      {/* Export */}
      <button
        onClick={onExport}
        disabled={isExporting}
        className="ml-auto flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover border border-accent/30 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
      >
        {isExporting
          ? <span className="w-3.5 h-3.5 border border-accent border-t-transparent rounded-full animate-spin" />
          : '↓'}
        Export CSV
      </button>
    </div>
  );
}

// ── Insights Tab (super_admin only) ──────────────────────────────────────────

const INSIGHT_PERIODS = [
  { value: 'last_7',  label: 'Last 7 Days' },
  { value: 'last_30', label: 'Last 30 Days' },
  { value: 'last_90', label: 'Last 90 Days' },
  { value: 'this_week', label: 'This Week' },
];

function InsightsTab() {
  const [data,    setData]    = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [period,  setPeriod]  = useState('last_30');

  useEffect(() => {
    setLoading(true);
    api.get<InsightsData>('/api/insights/global', { params: { period } })
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load insights'))
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error || !data) return (
    <p className="text-red-400 text-sm text-center py-12">{error || 'No data'}</p>
  );

  const topObjections        = data.topObjections        ?? [];
  const scenarioPerformance  = data.scenarioPerformance  ?? [];
  const sentimentTrend       = data.sentimentTrend       ?? [];
  const clinicActivity       = data.clinicActivity       ?? [];
  const languageDistribution = data.languageDistribution ?? [];
  const funnel               = data.funnel               ?? [];

  const maxObjection = Math.max(...topObjections.map(o => o.count ?? 0).filter(Number.isFinite), 1);
  const maxActivity  = Math.max(...clinicActivity.map(c => c.aiMessages ?? 0).filter(Number.isFinite), 1);

  return (
    <div className="space-y-5 pt-1">

      {/* Phase 2 banner */}
      <div className="bg-surface-sunken border border-accent/20 rounded-xl px-5 py-3 flex items-center gap-3">
        <Rocket size={24} className="text-accent shrink-0" />
        <div>
          <p className="text-accent text-sm font-medium">Phase 2 Analytics — Live Preview</p>
          <p className="text-gray-500 text-xs">Advanced ML-powered insights and cross-clinic benchmarking coming soon.</p>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-3">
        <span className="text-gray-500 text-xs uppercase tracking-wider">Period</span>
        <div className="flex gap-1">
          {INSIGHT_PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                period === p.value
                  ? 'bg-accent text-white border-accent font-medium'
                  : 'border-line text-gray-400 hover:text-white hover:border-line-strong'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 1: Top Objections + Language Distribution */}
      <div className="grid grid-cols-2 gap-5">

        {/* Top Objections */}
        <div className="bg-surface-sunken border border-line rounded-xl p-5">
          <p className="text-white font-medium text-sm mb-4">Top Patient Objections</p>
          {topObjections.length === 0 ? (
            <p className="text-gray-600 text-xs">No objection data yet.</p>
          ) : (
            <div className="space-y-3">
              {topObjections.map(obj => {
                const cfg = OBJECTION_CONFIG[obj.type];
                return (
                  <div key={obj.type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-300 text-xs flex items-center gap-1.5">
                        {cfg?.icon ? (() => { const Icon = cfg.icon; return <Icon size={12} />; })() : '●'}
                        {obj.label}
                      </span>
                      <span className="text-gray-400 text-xs font-medium">{obj.count}</span>
                    </div>
                    <div className="h-1.5 bg-surface-sunken rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${cfg?.color.split(' ')[0] ?? 'bg-gray-500'}`}
                        style={{ width: `${(obj.count / maxObjection) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Language Distribution */}
        <div className="bg-surface-sunken border border-line rounded-xl p-5">
          <p className="text-white font-medium text-sm mb-4">Language Distribution</p>
          {languageDistribution.length === 0 ? (
            <p className="text-gray-600 text-xs">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {languageDistribution.map(l => (
                <div key={l.language}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-300 text-xs">
                      {l.language === 'en' ? '🇬🇧 English' : l.language === 'tr' ? '🇹🇷 Turkish' : l.language === 'ar' ? '🇸🇦 Arabic' : l.language === 'es' ? '🇪🇸 Spanish' : l.language === 'ru' ? '🇷🇺 Russian' : l.language.toUpperCase()}
                    </span>
                    <span className="text-gray-400 text-xs">{l.count} <span className="text-gray-600">({l.pct}%)</span></span>
                  </div>
                  <div className="h-1.5 bg-surface-sunken rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${l.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Scenario Conversion + Funnel */}
      <div className="grid grid-cols-2 gap-5">

        {/* Scenario Performance */}
        <div className="bg-surface-sunken border border-line rounded-xl p-5">
          <p className="text-white font-medium text-sm mb-4">Scenario Conversion Rates</p>
          {scenarioPerformance.length === 0 ? (
            <p className="text-gray-600 text-xs">No scenario data yet.</p>
          ) : (
            <div className="divide-y divide-surface-sunken">
              {scenarioPerformance.map(s => {
                const cfg = SCENARIO_CONFIG[s.scenario];
                return (
                  <div key={s.scenario} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg?.color ?? 'bg-gray-800 text-gray-400'}`}>
                        {cfg?.label ?? s.scenario}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-white text-sm font-semibold">{s.conversionRate.toFixed(1)}%</span>
                      <span className="text-gray-600 text-xs ml-1.5">{s.booked}/{s.total}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Lead Funnel */}
        <div className="bg-surface-sunken border border-line rounded-xl p-5">
          <p className="text-white font-medium text-sm mb-4">Lead Funnel</p>
          {funnel.length === 0 ? (
            <p className="text-gray-600 text-xs">No funnel data yet.</p>
          ) : (
            <div className="space-y-2">
              {funnel.map((stage, i) => (
                <div key={stage.stage} className="flex items-center gap-3">
                  <span className="text-gray-500 text-xs w-5 text-right">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-gray-300 text-xs capitalize">{stage.stage}</span>
                      <span className="text-gray-400 text-xs">{stage.count} <span className="text-gray-600">({stage.pct}%)</span></span>
                    </div>
                    <div className="h-1.5 bg-surface-sunken rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{ width: `${stage.pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Clinic Activity Leaderboard */}
      <div className="bg-surface-sunken border border-line rounded-xl p-5">
        <p className="text-white font-medium text-sm mb-4">Clinic Activity Leaderboard</p>
        {clinicActivity.length === 0 ? (
          <p className="text-gray-600 text-xs">No clinic data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 uppercase tracking-wider text-[10px] border-b border-line">
                  <th className="text-left pb-2 font-medium">Clinic</th>
                  <th className="text-right pb-2 font-medium">Leads</th>
                  <th className="text-right pb-2 font-medium">AI Messages</th>
                  <th className="text-right pb-2 font-medium">Bookings</th>
                  <th className="text-right pb-2 font-medium">Conv. Rate</th>
                  <th className="pb-2 pl-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-sunken">
                {clinicActivity.map(c => (
                  <tr key={c.clinicId} className="hover:bg-surface-sunken transition-colors">
                    <td className="py-2.5 text-gray-200 font-medium">{c.clinicName}</td>
                    <td className="py-2.5 text-right text-gray-300">{c.leads}</td>
                    <td className="py-2.5 text-right text-gray-300">{c.aiMessages}</td>
                    <td className="py-2.5 text-right text-gray-300">{c.bookings}</td>
                    <td className="py-2.5 text-right text-accent font-semibold">{c.conversionRate.toFixed(1)}%</td>
                    <td className="py-2.5 pl-4">
                      <div className="w-20 h-1.5 bg-surface-sunken rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${(c.aiMessages / maxActivity) * 100}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Row 4: Sentiment Trend */}
      <div className="bg-surface-sunken border border-line rounded-xl p-5">
        <p className="text-white font-medium text-sm mb-4">Sentiment Trend <span className="text-gray-500 font-normal">(by week)</span></p>
        {sentimentTrend.length === 0 ? (
          <p className="text-gray-600 text-xs">No sentiment data yet.</p>
        ) : (
          <div className="space-y-2">
            {sentimentTrend.map(w => {
              const total = w.positive + w.neutral + w.negative || 1;
              return (
                <div key={w.week} className="flex items-center gap-3">
                  <span className="text-gray-500 text-[10px] w-16 shrink-0">
                    {new Date(w.week).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                  <div className="flex-1 flex gap-px h-4 rounded-full overflow-hidden">
                    <div className="bg-green-600 transition-all" style={{ width: `${(w.positive / total) * 100}%` }} title={`Positive: ${w.positive}`} />
                    <div className="bg-gray-500 transition-all"  style={{ width: `${(w.neutral  / total) * 100}%` }} title={`Neutral: ${w.neutral}`}  />
                    <div className="bg-red-600 transition-all"   style={{ width: `${(w.negative / total) * 100}%` }} title={`Negative: ${w.negative}`} />
                  </div>
                  <div className="flex gap-2 text-[10px] shrink-0">
                    <span className="text-green-400">{w.positive}</span>
                    <span className="text-gray-500">{w.neutral}</span>
                    <span className="text-red-400">{w.negative}</span>
                  </div>
                </div>
              );
            })}
            <div className="flex items-center gap-3 pt-1 text-[10px] text-gray-500">
              <span className="w-16" />
              <div className="flex gap-3">
                <span><span className="inline-block w-2 h-2 rounded-full bg-green-600 mr-1" />Positive</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-gray-500 mr-1"  />Neutral</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-red-600 mr-1"   />Negative</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AIActivityPage() {
  const { user } = useAuth();
  const role = user?.role ?? 'koordinator';
  const isSuperAdmin  = role === 'super_admin';
  const isReceptionist = role === 'koordinator';

  // Data state
  const [conversations,  setConversations]  = useState<ConversationSummary[]>([]);
  const [summary,        setSummary]        = useState<ActivitySummaryData | null>(null);
  const [clinicOptions,  setClinicOptions]  = useState<{ id: string; name: string }[]>([]);
  const [total,          setTotal]          = useState(0);
  const [pages,          setPages]          = useState(1);

  // UI state
  const [isLoading,      setIsLoading]      = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [activeTab,      setActiveTab]      = useState<'all' | 'action_required' | 'insights'>('all');
  const [page,           setPage]           = useState(1);
  const [isExporting,    setIsExporting]    = useState(false);

  const [filters, setFilters] = useState<Filters>({
    dateRange: 'all',
    clinicId:  '',
    scenario:  'all',
    outcome:   'all',
    language:  'all',
  });

  // ── Fetch data ────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        date_range: filters.dateRange,
        scenario:   filters.scenario,
        outcome:    filters.outcome,
        language:   filters.language,
        page,
        limit: 20,
      };
      if (filters.clinicId) params.clinic_id = filters.clinicId;
      if (activeTab === 'action_required') params.action_required = 'true';

      const [convRes, sumRes] = await Promise.all([
        api.get<{ conversations: ConversationSummary[]; total: number; pages: number }>('/api/activity', { params }),
        api.get<ActivitySummaryData>('/api/activity/summary'),
      ]);

      setConversations(convRes.data.conversations);
      setTotal(convRes.data.total);
      setPages(convRes.data.pages);
      setSummary(sumRes.data);
    } catch (err: unknown) {
      setError((err as any)?.response?.data?.error || 'Failed to load activity');
    } finally {
      setIsLoading(false);
    }
  }, [filters, activeTab, page]);

  // Fetch clinic list for super_admin filter
  useEffect(() => {
    if (!isSuperAdmin) return;
    api.get<{ clinics: { id: string; name: string }[] }>('/api/clinics')
      .then(r => setClinicOptions(r.data.clinics.map(c => ({ id: c.id, name: c.name }))))
      .catch(() => {});
  }, [isSuperAdmin]);

  // Refetch when filters or tab change
  useEffect(() => {
    setPage(1);
  }, [filters, activeTab]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleTakeOver(leadId: string) {
    try {
      await api.post(`/api/activity/leads/${leadId}/take-over`);
      setConversations(cs =>
        cs.map(c => c.leadId === leadId ? { ...c, aiFollowUpEnabled: false, actionRequired: true } : c)
      );
    } catch (err: unknown) {
      setError((err as any)?.response?.data?.error || 'Failed to take over lead');
    }
  }

  async function handleMarkCalled(leadId: string) {
    try {
      await api.post(`/api/activity/leads/${leadId}/mark-called`);
      setConversations(cs => cs.filter(c => c.leadId !== leadId));
    } catch (err: unknown) {
      setError((err as any)?.response?.data?.error || 'Failed to mark as called');
    }
  }

  async function handleResolve(leadId: string) {
    try {
      await api.patch(`/api/leads/${leadId}/resolve`);
      // Remove from action_required tab; update flag on 'all' tab
      setConversations(cs =>
        activeTab === 'action_required'
          ? cs.filter(c => c.leadId !== leadId)
          : cs.map(c => c.leadId === leadId ? { ...c, actionRequired: false, aiFollowUpEnabled: true } : c)
      );
    } catch (err: unknown) {
      setError((err as any)?.response?.data?.error || 'Failed to resolve lead');
    }
  }

  // ── CSV Export ─────────────────────────────────────────────────────────────

  async function handleExport(opts?: { period?: string; dateFrom?: string; dateTo?: string }) {
    setIsExporting(true);
    try {
      const dateRange = opts?.period ?? filters.dateRange;
      const params: Record<string, string> = {
        date_range: dateRange,
        scenario:   filters.scenario,
        outcome:    filters.outcome,
        language:   filters.language,
      };
      if (filters.clinicId) params.clinic_id = filters.clinicId;
      if (activeTab === 'action_required') params.action_required = 'true';
      if (dateRange === 'custom') {
        if (opts?.dateFrom) params.date_from = opts.dateFrom;
        if (opts?.dateTo)   params.date_to   = opts.dateTo;
      }

      const res = await api.get('/api/activity/export', {
        params,
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `carenova-activity-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError('Export failed');
    } finally {
      setIsExporting(false);
    }
  }

  // ── Receptionist view ─────────────────────────────────────────────────────

  if (isReceptionist) {
    const actionItems = conversations.filter(c => c.actionRequired);
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-5">
          <div className="mb-2">
            <h1 className="font-serif text-3xl text-white">Action Required</h1>
            <p className="text-gray-400 text-sm mt-1">
              {actionItems.length} lead{actionItems.length !== 1 ? 's' : ''} need a call today
            </p>
          </div>

          {isLoading ? (
            <Spinner />
          ) : actionItems.length === 0 ? (
            <div className="bg-surface-sunken border border-line rounded-xl py-16 text-center">
              <p className="text-3xl mb-3">🎉</p>
              <p className="text-white font-medium">All caught up!</p>
              <p className="text-gray-500 text-sm mt-1">No action required right now.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {actionItems.map(conv => (
                <ActionRequiredCard key={conv.leadId} conv={conv} onMarkCalled={handleMarkCalled} onResolve={handleResolve} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Clinic admin / Super admin view ───────────────────────────────────────

  const actionCount = conversations.filter(c => c.actionRequired).length;

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-1">
          <div>
            <h1 className="font-serif text-3xl text-white">AI Activity</h1>
            <p className="text-gray-400 text-sm mt-1">Real-time WhatsApp conversation monitoring</p>
          </div>
          <button
            onClick={fetchAll}
            className="text-xs text-accent hover:text-accent-hover px-3 py-1.5 border border-line rounded-lg transition-colors mt-1"
          >
            ↻ Refresh
          </button>
        </div>

        {error && (
          <div className="bg-red-950 border border-red-800 text-red-300 text-sm px-4 py-3 rounded-lg">
            ⚠ {error}
          </div>
        )}

        {/* Summary bar */}
        {summary && <SummaryBar data={summary} onPendingClick={() => setActiveTab('action_required')} />}

        {/* Weekly report */}
        <WeeklyReportCard onExport={handleExport} isExporting={isExporting} />

        {/* Clinic admin: "My Actions Today" section */}
        {!isSuperAdmin && actionCount > 0 && activeTab !== 'action_required' && (
          <div className="bg-yellow-950/30 border border-yellow-800/40 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-yellow-400 text-lg">⚠</span>
                <div>
                  <p className="text-yellow-300 font-medium text-sm">
                    {actionCount} lead{actionCount !== 1 ? 's' : ''} need human follow-up
                  </p>
                  <p className="text-yellow-600 text-xs">AI couldn't close — these leads need a receptionist call</p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('action_required')}
                className="text-xs text-yellow-400 border border-yellow-700 bg-yellow-950 hover:bg-yellow-900 px-3 py-1.5 rounded-lg transition-colors"
              >
                View all →
              </button>
            </div>
          </div>
        )}

        {/* Tab bar + filters */}
        <div className="space-y-3">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-line pb-0">
            {([
              { value: 'all',             label: `All Conversations (${total})` },
              { value: 'action_required', label: `Action Required (${actionCount})`, alert: actionCount > 0 },
              ...(isSuperAdmin ? [{ value: 'insights', label: 'Insights', icon: BarChart3 }] : []),
            ] as { value: 'all' | 'action_required' | 'insights'; label: string; alert?: boolean; icon?: IconComponent }[]).map(tab => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.value
                    ? 'border-accent text-accent'
                    : 'border-transparent text-gray-500 hover:text-white'
                }`}
              >
                {tab.icon && <tab.icon size={14} />}
                {tab.label}
                {tab.alert && <span className="ml-1.5 inline-flex w-2 h-2 rounded-full bg-red-500" />}
              </button>
            ))}
          </div>

          {/* Filters (hidden on Insights tab) */}
          {activeTab !== 'insights' && (
            <FiltersBar
              filters={filters}
              clinicOptions={clinicOptions}
              showClinicFilter={isSuperAdmin}
              onChange={f => setFilters(f)}
              onExport={() => handleExport()}
              isExporting={isExporting}
            />
          )}
        </div>

        {/* Insights tab content */}
        {activeTab === 'insights' && <InsightsTab />}

        {/* Conversation list */}
        {activeTab !== 'insights' && (isLoading ? (
          <Spinner />
        ) : conversations.length === 0 ? (
          <div className="bg-surface-sunken border border-line rounded-xl py-16 text-center">
            <div className="mb-3"><Bot size={48} className="mx-auto text-gray-400" /></div>
            <p className="text-white font-medium">No conversations match your filters</p>
            <p className="text-gray-500 text-sm mt-1">Try adjusting the date range or filters above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeTab === 'action_required'
              ? conversations.map(conv => (
                  <ActionRequiredCard
                    key={conv.leadId}
                    conv={conv}
                    onMarkCalled={handleMarkCalled}
                    onResolve={handleResolve}
                  />
                ))
              : conversations.map(conv => (
                  <ConversationCard
                    key={conv.leadId}
                    conv={conv}
                    showClinic={isSuperAdmin}
                    onTakeOver={handleTakeOver}
                  />
                ))
            }
          </div>
        ))}

        {/* Pagination */}
        {activeTab !== 'insights' && pages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-xs px-3 py-1.5 border border-line rounded-lg text-gray-400 hover:text-white disabled:opacity-40 transition-colors"
            >
              ← Prev
            </button>
            <span className="text-gray-500 text-xs">Page {page} of {pages}</span>
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="text-xs px-3 py-1.5 border border-line rounded-lg text-gray-400 hover:text-white disabled:opacity-40 transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-500 text-sm">Loading activity…</p>
      </div>
    </div>
  );
}
