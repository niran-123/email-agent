import { useState, useEffect, useCallback } from 'react';
import { Mail, RefreshCw, Unlink, Paperclip, Clock, Tag, Search, Radio, ShieldCheck, Sparkles, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { gmailApi, analysisApi } from '../services/api.js';
import Card from '../components/Card.jsx';
import Badge from '../components/Badge.jsx';
import Button from '../components/Button.jsx';
import Loading from '../components/Loading.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Modal from '../components/Modal.jsx';

export default function InboxPage() {
  const { user, primaryAccount, loginWithGoogle, fetchUser } = useAuth();
  const [syncStatus, setSyncStatus] = useState(null);
  const [profile, setProfile] = useState(null);
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [watching, setWatching] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [emailAnalysis, setEmailAnalysis] = useState(null);
  const [analyzingEmail, setAnalyzingEmail] = useState(false);

  useEffect(() => {
    if (selectedEmail?._id) {
      setEmailAnalysis(null);
      analysisApi
        .getEmailSummary(selectedEmail._id)
        .then((res) => {
          if (res.data?.data) {
            setEmailAnalysis(res.data.data);
          }
        })
        .catch(() => {
          // No summary yet or error
        });
    }
  }, [selectedEmail]);

  const handleRunAnalysis = async (force = false) => {
    if (!selectedEmail?._id) return;
    setAnalyzingEmail(true);
    try {
      const res = await analysisApi.summarizeEmail(selectedEmail._id, force);
      if (res.data?.data) {
        setEmailAnalysis(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'AI analysis failed');
    } finally {
      setAnalyzingEmail(false);
    }
  };

  const loadData = useCallback(async () => {
    if (!user || !primaryAccount) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [syncRes, profileRes, emailsRes] = await Promise.allSettled([
        gmailApi.getSyncStatus(primaryAccount._id),
        gmailApi.getProfile(primaryAccount._id),
        gmailApi.getEmails({ accountId: primaryAccount._id, q: searchQuery }),
      ]);

      if (syncRes.status === 'fulfilled') setSyncStatus(syncRes.value.data.data);
      if (profileRes.status === 'fulfilled') setProfile(profileRes.value.data.data);
      if (emailsRes.status === 'fulfilled') setEmails(emailsRes.value.data.data || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load Gmail data');
    } finally {
      setLoading(false);
    }
  }, [user, primaryAccount, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    setError(null);
    try {
      const res = await gmailApi.syncEmails(20, primaryAccount?._id);
      setSyncMessage(res.data.message || 'Sync completed successfully');
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleStartWatch = async () => {
    setWatching(true);
    setError(null);
    try {
      const res = await gmailApi.startWatch(primaryAccount?._id);
      setSyncMessage(`Push notifications activated until ${new Date(res.data.data.expiration).toLocaleDateString()}`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to activate Gmail watch');
    } finally {
      setWatching(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await gmailApi.disconnect(primaryAccount?._id);
      setDisconnectModalOpen(false);
      await fetchUser();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Disconnect failed');
    }
  };

  if (!user || !primaryAccount) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-6">
        <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mx-auto">
          <Mail size={32} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Connect Your Gmail Account</h2>
          <p className="text-gray-500 mt-2 text-sm">
            Authorize MailMind AI to securely read and automatically sync your emails using Google OAuth 2.0 with the read-only scope.
          </p>
        </div>
        <Button
          onClick={loginWithGoogle}
          size="lg"
          icon={
            <svg className="w-5 h-5 mr-1" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          }
        >
          Sign in with Google
        </Button>
      </div>
    );
  }

  const isWatchActive = syncStatus?.watchStatus === 'active';

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gmail Synchronization Engine</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Connected as <span className="font-semibold text-gray-800">{primaryAccount.emailAddress}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={handleStartWatch}
            loading={watching}
            variant={isWatchActive ? 'secondary' : 'outline'}
            size="sm"
            icon={<Radio size={14} className={isWatchActive ? 'text-green-600 animate-pulse' : 'text-gray-400'} />}
          >
            {isWatchActive ? 'Renew Pub/Sub Watch' : 'Enable Live Watch'}
          </Button>

          <Button
            onClick={handleSync}
            loading={syncing}
            variant="primary"
            size="sm"
            icon={<RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />}
          >
            {syncing ? 'Syncing...' : 'Sync Emails Now'}
          </Button>

          <Button
            onClick={() => setDisconnectModalOpen(true)}
            variant="outline"
            size="sm"
            className="text-red-600 hover:bg-red-50 hover:border-red-200"
            icon={<Unlink size={14} />}
          >
            Disconnect
          </Button>
        </div>
      </div>

      {syncMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 flex items-center justify-between">
          <span>{syncMessage}</span>
          <button onClick={() => setSyncMessage(null)} className="text-green-600 hover:text-green-900 text-xs font-semibold">
            Dismiss
          </button>
        </div>
      )}

      {error && <ErrorMessage title="Gmail Service Notice" message={error} onRetry={loadData} />}

      {/* Account Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Pub/Sub Push Watch</div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-base font-semibold text-gray-900 capitalize">
              {syncStatus?.watchStatus || 'Inactive'}
            </span>
            <Badge variant={isWatchActive ? 'success' : 'neutral'}>
              {isWatchActive ? 'Active' : 'Standby'}
            </Badge>
          </div>
          <div className="text-xs text-gray-400 mt-2.5 truncate">
            {syncStatus?.watchExpiration
              ? `Renews by: ${new Date(syncStatus.watchExpiration).toLocaleDateString()}`
              : 'Push watch not configured'}
          </div>
        </Card>

        <Card>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Stored Emails in DB</div>
          <div className="text-2xl font-bold text-brand-600 mt-2">
            {syncStatus?.statistics?.totalStored ?? emails.length}
          </div>
          <div className="text-xs text-gray-400 mt-2.5 flex items-center gap-1">
            <ShieldCheck size={12} className="text-green-600" /> Idempotently indexed
          </div>
        </Card>

        <Card>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Live Mailbox Messages</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">
            {profile?.messagesTotal ? Number(profile.messagesTotal).toLocaleString() : '—'}
          </div>
          <div className="text-xs text-gray-400 mt-2.5 truncate">History ID: {syncStatus?.lastHistoryId || profile?.historyId || '—'}</div>
        </Card>

        <Card>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Last Synchronization</div>
          <div className="text-sm font-semibold text-gray-800 mt-3 truncate">
            {syncStatus?.lastSyncedAt ? new Date(syncStatus.lastSyncedAt).toLocaleTimeString() : 'Never'}
          </div>
          <div className="text-xs text-gray-400 mt-2 flex items-center gap-1">
            <Clock size={12} /> {syncStatus?.syncInProgress ? 'Sync running...' : 'Idle'}
          </div>
        </Card>
      </div>

      {/* Search & Email Listing */}
      <Card padding={false} className="overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search synced emails by subject or sender..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <span className="text-xs text-gray-400">Showing {emails.length} emails</span>
        </div>

        {loading ? (
          <Loading label="Loading emails..." />
        ) : emails.length === 0 ? (
          <div className="py-16 text-center text-gray-500 text-sm">
            <Mail size={32} className="mx-auto text-gray-300 mb-2" />
            No emails synced yet. Click "Sync Emails Now" above to retrieve recent emails.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {emails.map((email) => (
              <div
                key={email._id}
                onClick={() => setSelectedEmail(email)}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {email.senderName || email.sender || email.from?.name || 'Unknown'}
                    </span>
                    <span className="text-xs text-gray-400 truncate">
                      &lt;{email.sender || email.from?.email}&gt;
                    </span>
                    {email.hasAttachments && (
                      <Paperclip size={13} className="text-gray-400 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-gray-800 font-medium truncate">{email.subject}</p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{email.snippet}</p>
                </div>

                <div className="flex sm:flex-col items-end justify-between sm:justify-center text-right flex-shrink-0">
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {new Date(email.receivedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <div className="flex gap-1 mt-1">
                    {email.labels?.slice(0, 2).map((l) => (
                      <span key={l} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Email Detail Modal */}
      <Modal
        isOpen={Boolean(selectedEmail)}
        onClose={() => setSelectedEmail(null)}
        title={selectedEmail?.subject || 'Email Details'}
        size="2xl"
      >
        {selectedEmail && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-xl space-y-1.5 text-xs text-gray-600 border border-gray-100">
              <div>
                <strong className="text-gray-900">From:</strong> {selectedEmail.senderName || selectedEmail.from?.name}{' '}
                &lt;{selectedEmail.sender || selectedEmail.from?.email}&gt;
              </div>
              <div>
                <strong className="text-gray-900">To:</strong>{' '}
                {selectedEmail.recipient?.join(', ') || selectedEmail.to?.map((t) => t.email).join(', ') || 'Me'}
              </div>
              <div>
                <strong className="text-gray-900">Date:</strong>{' '}
                {new Date(selectedEmail.receivedAt).toLocaleString()}
              </div>
              {selectedEmail.labels?.length > 0 && (
                <div className="flex items-center gap-1.5 pt-1">
                  <Tag size={12} />
                  {selectedEmail.labels.map((lbl) => (
                    <span key={lbl} className="bg-white border border-gray-200 px-1.5 py-0.5 rounded text-[10px]">
                      {lbl}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {selectedEmail.attachments?.length > 0 && (
              <div className="border border-gray-200 rounded-xl p-3 bg-white">
                <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                  <Paperclip size={14} /> Attachments ({selectedEmail.attachments.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedEmail.attachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="text-xs bg-gray-50 border border-gray-200 px-2.5 py-1.5 rounded-lg flex items-center gap-2"
                    >
                      <span className="font-medium text-gray-800">{att.filename}</span>
                      <span className="text-gray-400 text-[10px]">
                        ({Math.round(att.size / 1024)} KB)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Email Analysis Section */}
            <div className="border border-brand-100 bg-brand-50/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-brand-600" />
                  <span className="text-sm font-semibold text-gray-900">AI Intelligence & Summary</span>
                  {emailAnalysis?.summary && (
                    <div className="flex items-center gap-1.5 ml-2">
                      <Badge
                        variant={
                          emailAnalysis.summary.priority === 'CRITICAL'
                            ? 'error'
                            : emailAnalysis.summary.priority === 'HIGH'
                              ? 'warning'
                              : emailAnalysis.summary.priority === 'MEDIUM'
                                ? 'info'
                                : 'neutral'
                        }
                      >
                        {emailAnalysis.summary.priority}
                      </Badge>
                      <Badge variant="neutral">{emailAnalysis.summary.category}</Badge>
                    </div>
                  )}
                </div>

                <Button
                  size="sm"
                  variant={emailAnalysis ? 'outline' : 'primary'}
                  onClick={() => handleRunAnalysis(Boolean(emailAnalysis))}
                  loading={analyzingEmail}
                  icon={<Sparkles size={13} className={analyzingEmail ? 'animate-spin' : ''} />}
                >
                  {analyzingEmail
                    ? 'Analyzing...'
                    : emailAnalysis
                      ? 'Re-analyze'
                      : 'Analyze with AI'}
                </Button>
              </div>

              {emailAnalysis?.summary ? (
                <div className="space-y-3 pt-2 text-xs text-gray-700">
                  <div className="bg-white p-3 rounded-lg border border-brand-100 shadow-sm">
                    <p className="font-semibold text-gray-900 text-sm mb-1">Executive Summary</p>
                    <p className="text-gray-800 leading-relaxed">{emailAnalysis.summary.summary}</p>
                    {emailAnalysis.summary.detailedSummary && (
                      <p className="text-gray-600 mt-2 leading-relaxed border-t border-gray-100 pt-2">
                        {emailAnalysis.summary.detailedSummary}
                      </p>
                    )}
                  </div>

                  {/* Action Items */}
                  {emailAnalysis.actionItems?.length > 0 && (
                    <div className="bg-white p-3 rounded-lg border border-yellow-200 shadow-sm space-y-2">
                      <div className="flex items-center gap-1.5 font-semibold text-yellow-900 text-xs uppercase tracking-wide">
                        <AlertTriangle size={13} className="text-yellow-600" /> Action Items Extracted ({emailAnalysis.actionItems.length})
                      </div>
                      <div className="divide-y divide-gray-100">
                        {emailAnalysis.actionItems.map((act, idx) => (
                          <div key={idx} className="py-1.5 first:pt-0 last:pb-0 flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2">
                              <CheckCircle2 size={14} className="text-brand-600 mt-0.5 flex-shrink-0" />
                              <span className="text-gray-800 font-medium">{act.task}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {act.deadlineText && (
                                <span className="bg-yellow-50 text-yellow-800 border border-yellow-200 px-1.5 py-0.5 rounded text-[10px] font-medium">
                                  {act.deadlineText}
                                </span>
                              )}
                              <span className="text-[10px] text-gray-400">
                                {Math.round((act.confidence || 0.9) * 100)}% conf
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Key Points & Next Steps */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {emailAnalysis.summary.keyPoints?.length > 0 && (
                      <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                        <span className="font-semibold text-gray-800 block mb-1">Key Points</span>
                        <ul className="list-disc list-inside space-y-0.5 text-gray-600">
                          {emailAnalysis.summary.keyPoints.map((pt, i) => (
                            <li key={i}>{pt}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {emailAnalysis.summary.suggestedNextSteps?.length > 0 && (
                      <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                        <span className="font-semibold text-gray-800 block mb-1">Suggested Next Steps</span>
                        <ul className="space-y-1 text-gray-600">
                          {emailAnalysis.summary.suggestedNextSteps.map((step, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <ArrowRight size={12} className="text-brand-600 mt-0.5 flex-shrink-0" />
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="text-[11px] text-gray-400 italic pt-1">
                    Intent: {emailAnalysis.summary.senderIntent} &bull; Model: {emailAnalysis.summary.model} (v{emailAnalysis.summary.promptVersion})
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-500 py-1 flex items-center justify-between">
                  <span>No summary generated yet. Click "Analyze with AI" above to extract insights.</span>
                </div>
              )}
            </div>

            <div className="prose prose-sm max-w-none p-2 text-gray-800 whitespace-pre-wrap font-sans text-sm border-t border-gray-100 pt-4">
              {selectedEmail.bodyText || selectedEmail.snippet || '(No body text)'}
            </div>
          </div>
        )}
      </Modal>

      {/* Disconnect Confirmation Modal */}
      <Modal
        isOpen={disconnectModalOpen}
        onClose={() => setDisconnectModalOpen(false)}
        title="Disconnect Gmail Account?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDisconnectModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDisconnect}>
              Yes, Disconnect
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          This will revoke access tokens, cancel active push notifications, and stop syncing emails from{' '}
          <strong className="text-gray-900">{primaryAccount?.emailAddress}</strong>. You can reconnect at any time.
        </p>
      </Modal>
    </div>
  );
}
