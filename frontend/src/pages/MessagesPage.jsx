import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, MessageCircle, RefreshCw, Send, User } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const formatTimestamp = value => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
};

export const MessagesPage = () => {
  const { user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [reportingMessageId, setReportingMessageId] = useState(null);
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReportId, setSubmittingReportId] = useState(null);
  const [notice, setNotice] = useState('');
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endOfMessagesRef = useRef(null);
  const activeFriendId = useRef(null);

  const loadFriends = async () => {
    setLoadingFriends(true);
    setError('');
    try {
      const response = await api.get('/relationships/friends');
      const friendEntries = response.data?.data || [];
      setFriends(friendEntries);
      setSelectedFriend(current => {
        const nextFriend = current && friendEntries.some(entry => entry.friend.studentId === current.studentId)
          ? current
          : friendEntries[0]?.friend || null;
        activeFriendId.current = nextFriend?.studentId || null;
        return nextFriend;
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Your friends could not be loaded.');
      setFriends([]);
    } finally {
      setLoadingFriends(false);
    }
  };

  useEffect(() => { loadFriends(); }, []);

  useEffect(() => {
    activeFriendId.current = selectedFriend?.studentId || null;
    if (!selectedFriend) {
      setMessages([]);
      return undefined;
    }

    let active = true;
    setLoadingMessages(true);
    setError('');
    api.get(`/messages/${encodeURIComponent(selectedFriend.studentId)}`)
      .then(response => {
        if (active) setMessages(response.data?.data || []);
      })
      .catch(requestError => {
        if (active) {
          setMessages([]);
          setError(requestError.response?.data?.message || 'This conversation could not be loaded.');
        }
      })
      .finally(() => {
        if (active) setLoadingMessages(false);
      });
    return () => { active = false; };
  }, [selectedFriend?.studentId]);

  const selectFriend = friend => {
    activeFriendId.current = friend.studentId;
    setSelectedFriend(friend);
  };

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async event => {
    event.preventDefault();
    const content = draft.trim();
    if (!selectedFriend || !content || sending) return;

    const friendId = selectedFriend.studentId;
    setSending(true);
    setError('');
    try {
      const response = await api.post(
        `/messages/${encodeURIComponent(friendId)}`,
        { content }
      );
      if (activeFriendId.current === friendId) {
        setMessages(current => [...current, response.data.data]);
      }
      setDraft('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Your message could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const handleReport = async (event, message) => {
    event.preventDefault();
    const friendId = selectedFriend?.studentId;
    if (!friendId || submittingReportId) return;

    setSubmittingReportId(message.messageId);
    setError('');
    setNotice('');
    try {
      await api.post(
        `/messages/${encodeURIComponent(friendId)}/${encodeURIComponent(message.messageId)}/report`,
        { details: reportDetails }
      );
      if (activeFriendId.current === friendId) {
        setMessages(current => current.map(item => (
          item.messageId === message.messageId ? { ...item, reportedByMe: true } : item
        )));
        setNotice('Your report was sent privately to the moderators for review.');
      }
      setReportingMessageId(null);
      setReportDetails('');
    } catch (requestError) {
      if (requestError.response?.status === 409 && activeFriendId.current === friendId) {
        setMessages(current => current.map(item => (
          item.messageId === message.messageId ? { ...item, reportedByMe: true } : item
        )));
        setReportingMessageId(null);
        setNotice('You have already reported this message.');
      } else {
        setError(requestError.response?.data?.message || 'This message could not be reported.');
      }
    } finally {
      setSubmittingReportId(null);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <MessageCircle className="h-6 w-6 text-campus-600" />Messages
        </h1>
        <p className="mt-1 text-sm text-slate-500">Private conversations with your confirmed friends.</p>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

      <div className="grid min-h-[560px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 md:border-b-0 md:border-r">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Friends</h2>
            <button
              type="button"
              onClick={loadFriends}
              disabled={loadingFriends}
              aria-label="Refresh friends"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loadingFriends ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto md:max-h-[510px]">
            {loadingFriends && <p className="px-4 py-6 text-center text-sm text-slate-500">Loading friends…</p>}
            {!loadingFriends && friends.map(({ friend }) => (
              <button
                type="button"
                key={friend.studentId}
                onClick={() => selectFriend(friend)}
                className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 ${
                  selectedFriend?.studentId === friend.studentId ? 'bg-campus-50' : ''
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-campus-100 bg-campus-50 text-sm font-semibold text-campus-700">
                  {(friend.name || friend.studentId || '?').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-800">{friend.name || friend.studentId}</span>
                  <span className="block truncate text-xs text-slate-500">{friend.department || 'Student'}</span>
                </span>
              </button>
            ))}
            {!loadingFriends && friends.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-slate-500">You need a confirmed friend to start a conversation.</p>
            )}
          </div>
        </aside>

        <section className="flex min-h-[430px] flex-col">
          {selectedFriend ? (
            <>
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3">
                <User className="h-5 w-5 text-campus-600" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{selectedFriend.name || selectedFriend.studentId}</h2>
                  <p className="text-xs text-slate-500">Confirmed friend</p>
                </div>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/70 p-4 sm:p-6">
                {loadingMessages && <p className="text-center text-sm text-slate-500">Loading conversation…</p>}
                {!loadingMessages && messages.length === 0 && (
                  <p className="mx-auto mt-12 max-w-xs text-center text-sm text-slate-500">
                    No messages yet. Send a message to start the conversation.
                  </p>
                )}
                {messages.map(message => {
                  const isOwnMessage = message.senderId === user?.studentId;
                  return (
                    <div key={message.messageId} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[90%] sm:max-w-[75%]">
                        <div className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                          isOwnMessage ? 'rounded-br-sm bg-campus-600 text-white' : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800'
                        }`}>
                          <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                          <p className={`mt-1 text-[10px] ${isOwnMessage ? 'text-campus-100' : 'text-slate-400'}`}>
                            {formatTimestamp(message.sentAt)}
                          </p>
                        </div>
                        {!isOwnMessage && (
                          <div className="mt-1">
                            {message.reportedByMe ? (
                              <span className="text-xs text-slate-400">Reported to moderators</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setReportingMessageId(message.messageId);
                                  setReportDetails('');
                                  setError('');
                                  setNotice('');
                                }}
                                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-700"
                              >
                                <AlertTriangle className="h-3 w-3" />Report message
                              </button>
                            )}
                          </div>
                        )}
                        {reportingMessageId === message.messageId && (
                          <form onSubmit={event => handleReport(event, message)} className="mt-2 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                            <p className="text-xs font-medium text-slate-700">Report this message as obscene or sexually inappropriate.</p>
                            <textarea
                              value={reportDetails}
                              onChange={event => setReportDetails(event.target.value)}
                              maxLength={1000}
                              rows={2}
                              aria-label="Optional report details"
                              placeholder="Add optional context for moderators"
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-campus-400 focus:outline-none focus:ring-2 focus:ring-campus-100"
                            />
                            <p className="text-[11px] leading-4 text-slate-500">
                              Your report is private. Moderators will review it; this does not automatically label the sender as fraudulent or restrict their account.
                            </p>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setReportingMessageId(null)}
                                disabled={submittingReportId === message.messageId}
                                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white disabled:opacity-50"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={submittingReportId === message.messageId}
                                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                              >
                                {submittingReportId === message.messageId ? 'Sending…' : 'Submit report'}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={endOfMessagesRef} />
              </div>
              <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-slate-100 p-3 sm:p-4">
                <textarea
                  value={draft}
                  onChange={event => setDraft(event.target.value)}
                  maxLength={2000}
                  rows={2}
                  aria-label="Message"
                  placeholder={`Message ${selectedFriend.name || 'your friend'}…`}
                  className="max-h-32 min-h-11 flex-1 resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-campus-400 focus:outline-none focus:ring-2 focus:ring-campus-100"
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-campus-600 px-4 text-sm font-semibold text-white hover:bg-campus-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />{sending ? 'Sending…' : 'Send'}
                </button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <MessageCircle className="mb-3 h-10 w-10 text-slate-300" />
              <h2 className="text-sm font-semibold text-slate-700">Select a friend</h2>
              <p className="mt-1 text-sm text-slate-500">Choose a confirmed friend to view or start a conversation.</p>
            </div>
          )}
        </section>
      </div>
      <p className="text-xs text-slate-400">Messages are limited to confirmed friends and are stored in the campus graph.</p>
    </div>
  );
};
