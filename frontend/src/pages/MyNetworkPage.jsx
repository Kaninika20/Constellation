import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  UserMinus,
  Clock,
  Check,
  X,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export const MyNetworkPage = () => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('requests'); // 'requests', 'friends', 'follow'
  const [requestSubTab, setRequestSubTab] = useState('incoming'); // 'incoming', 'outgoing'
  const [followSubTab, setFollowSubTab] = useState('following'); // 'following', 'followers'

  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState('');

  const fetchNetworkData = async () => {
    setLoading(true);
    try {
      const [incRes, outRes, friendsRes, followersRes, followingRes] = await Promise.allSettled([
        api.get('/relationships/friend-requests/incoming'),
        api.get('/relationships/friend-requests/outgoing'),
        api.get('/relationships/friends'),
        api.get('/relationships/followers'),
        api.get('/relationships/following')
      ]);

      if (incRes.status === 'fulfilled') setIncomingRequests(incRes.value.data?.data || []);
      if (outRes.status === 'fulfilled') setOutgoingRequests(outRes.value.data?.data || []);
      if (friendsRes.status === 'fulfilled') setFriends(friendsRes.value.data?.data || []);
      if (followersRes.status === 'fulfilled') setFollowers(followersRes.value.data?.data || []);
      if (followingRes.status === 'fulfilled') setFollowing(followingRes.value.data?.data || []);
    } catch (err) {
      console.warn('[MyNetwork] Using local demo social data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNetworkData();
  }, []);

  const handleAcceptRequest = async (senderId) => {
    setActionLoading(`accept_${senderId}`);
    setMessage('');
    try {
      await api.post(`/relationships/friend-requests/${senderId}/accept`);
      setMessage('Friend request accepted! You are now connected.');
      fetchNetworkData();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to accept request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectRequest = async (senderId) => {
    setActionLoading(`reject_${senderId}`);
    setMessage('');
    try {
      await api.post(`/relationships/friend-requests/${senderId}/reject`);
      setMessage('Friend request rejected.');
      fetchNetworkData();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to reject request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelRequest = async (receiverId) => {
    setActionLoading(`cancel_${receiverId}`);
    setMessage('');
    try {
      await api.delete(`/relationships/friend-requests/${receiverId}`);
      setMessage('Outgoing friend request canceled.');
      fetchNetworkData();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to cancel request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnfriend = async (friendId) => {
    if (!window.confirm('Are you sure you want to remove this friend connection?')) return;
    setActionLoading(`unfriend_${friendId}`);
    setMessage('');
    try {
      await api.delete(`/relationships/friends/${friendId}`);
      setMessage('Friend connection removed.');
      fetchNetworkData();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to remove friendship');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnfollow = async (targetId) => {
    setActionLoading(`unfollow_${targetId}`);
    setMessage('');
    try {
      await api.delete(`/relationships/follow/${targetId}`);
      setMessage('Unfollowed student.');
      fetchNetworkData();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to unfollow');
    } finally {
      setActionLoading(null);
    }
  };

  const handleFollow = async (targetId) => {
    setActionLoading(`follow_${targetId}`);
    setMessage('');
    try {
      await api.post(`/relationships/follow/${targetId}`);
      setMessage('Followed student.');
      fetchNetworkData();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to follow');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-campus-600" />
            My Social Network & Relationships
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage friend requests, confirmed mutual connections, and followed students via Neo4j
          </p>
        </div>

        <button
          onClick={fetchNetworkData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Graph
        </button>
      </div>

      {/* Notification Toast */}
      {message && (
        <div className="p-3 rounded-xl bg-campus-50 border border-campus-200 text-campus-800 text-xs flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-campus-500 hover:text-campus-800">✕</button>
        </div>
      )}

      {/* Social Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Mutual Friends</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{friends.length}</h3>
          <p className="text-[10px] text-emerald-600 font-medium mt-0.5">[:FRIENDS_WITH]</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pending Requests</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{incomingRequests.length}</h3>
          <p className="text-[10px] text-amber-600 font-medium mt-0.5">[:PENDING_FRIEND_REQUEST]</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Followers</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{followers.length}</h3>
          <p className="text-[10px] text-blue-600 font-medium mt-0.5">Students Following You</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Following</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{following.length}</h3>
          <p className="text-[10px] text-indigo-600 font-medium mt-0.5">[:FOLLOWS]</p>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="border-b border-slate-200 flex gap-6 text-sm font-semibold text-slate-500">
        <button
          onClick={() => setActiveTab('requests')}
          className={`pb-3 transition-colors relative ${
            activeTab === 'requests' ? 'text-campus-600 border-b-2 border-campus-600' : 'hover:text-slate-800'
          }`}
        >
          Friend Requests ({incomingRequests.length + outgoingRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('friends')}
          className={`pb-3 transition-colors relative ${
            activeTab === 'friends' ? 'text-campus-600 border-b-2 border-campus-600' : 'hover:text-slate-800'
          }`}
        >
          My Friends ({friends.length})
        </button>
        <button
          onClick={() => setActiveTab('follow')}
          className={`pb-3 transition-colors relative ${
            activeTab === 'follow' ? 'text-campus-600 border-b-2 border-campus-600' : 'hover:text-slate-800'
          }`}
        >
          Followers & Following ({followers.length + following.length})
        </button>
      </div>

      {/* Tab 1: Friend Requests Section */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setRequestSubTab('incoming')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                requestSubTab === 'incoming'
                  ? 'bg-campus-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Incoming Requests ({incomingRequests.length})
            </button>
            <button
              onClick={() => setRequestSubTab('outgoing')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                requestSubTab === 'outgoing'
                  ? 'bg-campus-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Outgoing Sent ({outgoingRequests.length})
            </button>
          </div>

          {requestSubTab === 'incoming' ? (
            incomingRequests.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 p-8">
                <UserCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-800">No incoming friend requests</h4>
                <p className="text-xs text-slate-500 mt-1">You are all caught up!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {incomingRequests.map(({ sender, sentAt, interests }) => (
                  <Card key={sender.studentId} className="p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start gap-3 mb-2">
                        <img
                          src={sender.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sender.name}`}
                          alt={sender.name}
                          className="w-11 h-11 rounded-2xl object-cover border border-slate-200 bg-white"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 truncate">{sender.name}</h4>
                          <p className="text-[11px] text-slate-500">{sender.department} • Year {sender.yearOfStudy}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {sender.studentId}</p>
                        </div>
                      </div>
                      {sender.bio && (
                        <p className="text-xs text-slate-600 line-clamp-2 my-2">{sender.bio}</p>
                      )}
                      {interests && interests.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {interests.slice(0, 2).map((it, idx) => (
                            <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                              #{it}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <Link to={`/profile/${sender.studentId}`} className="text-[11px] text-campus-600 font-semibold hover:underline">
                        View Profile
                      </Link>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleRejectRequest(sender.studentId)}
                          isLoading={actionLoading === `reject_${sender.studentId}`}
                          className="text-xs"
                          icon={X}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleAcceptRequest(sender.studentId)}
                          isLoading={actionLoading === `accept_${sender.studentId}`}
                          className="text-xs"
                          icon={Check}
                        >
                          Accept
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )
          ) : (
            outgoingRequests.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 p-8">
                <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-800">No outgoing friend requests</h4>
                <p className="text-xs text-slate-500 mt-1">Explore the Student Directory to connect with classmates!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {outgoingRequests.map(({ receiver, sentAt }) => (
                  <Card key={receiver.studentId} className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={receiver.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${receiver.name}`}
                        alt={receiver.name}
                        className="w-10 h-10 rounded-2xl object-cover border border-slate-200 bg-white"
                      />
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{receiver.name}</h4>
                        <p className="text-[11px] text-slate-500">{receiver.department} • Year {receiver.yearOfStudy}</p>
                        <span className="text-[10px] text-amber-600 font-medium">Pending acceptance...</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCancelRequest(receiver.studentId)}
                      isLoading={actionLoading === `cancel_${receiver.studentId}`}
                      className="text-xs text-red-600 border-red-200 hover:bg-red-50"
                      icon={X}
                    >
                      Cancel
                    </Button>
                  </Card>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* Tab 2: My Friends Section */}
      {activeTab === 'friends' && (
        <div className="space-y-4">
          {friends.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 p-8">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-800">No confirmed friends yet</h4>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Visit the Student Directory or your Course Classmates to send friend requests!
              </p>
              <Link to="/directory">
                <Button size="sm">Browse Student Directory</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {friends.map(({ friend, since, interests }) => (
                <Card key={friend.studentId} className="p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-3">
                        <img
                          src={friend.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.name}`}
                          alt={friend.name}
                          className="w-10 h-10 rounded-2xl object-cover border border-slate-200 bg-white"
                        />
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">{friend.name}</h4>
                          <p className="text-[11px] text-slate-500">{friend.department} • Year {friend.yearOfStudy}</p>
                        </div>
                      </div>
                      <Badge color="emerald">Friends</Badge>
                    </div>
                    {friend.bio && (
                      <p className="text-xs text-slate-600 line-clamp-2 my-2">{friend.bio}</p>
                    )}
                    {interests && interests.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {interests.slice(0, 2).map((it, idx) => (
                          <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                            #{it}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <Link to={`/profile/${friend.studentId}`} className="text-[11px] text-campus-600 font-semibold hover:underline">
                      View Profile
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleUnfriend(friend.studentId)}
                      isLoading={actionLoading === `unfriend_${friend.studentId}`}
                      className="text-xs text-red-600 hover:bg-red-50"
                      icon={UserMinus}
                    >
                      Unfriend
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Followers & Following Section */}
      {activeTab === 'follow' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setFollowSubTab('following')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                followSubTab === 'following'
                  ? 'bg-campus-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Following ({following.length})
            </button>
            <button
              onClick={() => setFollowSubTab('followers')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                followSubTab === 'followers'
                  ? 'bg-campus-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Followers ({followers.length})
            </button>
          </div>

          {followSubTab === 'following' ? (
            following.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 p-8">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-800">You are not following anyone yet</h4>
                <p className="text-xs text-slate-500 mt-1">Discover peers in clubs, courses, or directory!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {following.map(({ followed }) => (
                  <Card key={followed.studentId} className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={followed.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${followed.name}`}
                        alt={followed.name}
                        className="w-10 h-10 rounded-2xl object-cover border border-slate-200 bg-white"
                      />
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{followed.name}</h4>
                        <p className="text-[11px] text-slate-500">{followed.department}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUnfollow(followed.studentId)}
                      isLoading={actionLoading === `unfollow_${followed.studentId}`}
                      className="text-xs"
                    >
                      Unfollow
                    </Button>
                  </Card>
                ))}
              </div>
            )
          ) : (
            followers.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 p-8">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-800">No followers yet</h4>
                <p className="text-xs text-slate-500 mt-1">Participate in clubs and events to grow your audience!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {followers.map(({ follower }) => {
                  const isFollowingBack = following.some(f => f.followed.studentId === follower.studentId);
                  return (
                    <Card key={follower.studentId} className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={follower.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${follower.name}`}
                          alt={follower.name}
                          className="w-10 h-10 rounded-2xl object-cover border border-slate-200 bg-white"
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 truncate">{follower.name}</h4>
                          <p className="text-[11px] text-slate-500">{follower.department}</p>
                        </div>
                      </div>
                      {isFollowingBack ? (
                        <span className="text-[10px] font-semibold px-2 py-1 rounded bg-slate-100 text-slate-600">
                          Mutual Follow
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleFollow(follower.studentId)}
                          isLoading={actionLoading === `follow_${follower.studentId}`}
                          className="text-xs"
                        >
                          Follow Back
                        </Button>
                      )}
                    </Card>
                  );
                })}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};

