import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send,
  Plus,
  Repeat,
  Image as ImageIcon,
  Calendar,
  Eye,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  X,
} from 'lucide-react';

interface DayPost {
  id: number;
  day: string;
  date: string;
  title: string;
  messageText: string;
  imageUrl?: string;
  sentCount: number;
  seenCount: number;
  status: 'sent' | 'scheduled';
}

export default function PostsTemplatesPage() {
  const navigate = useNavigate();

  // Day-wise history of posts/messages
  const [posts, setPosts] = useState<DayPost[]>([
    {
      id: 101,
      day: 'Monday',
      date: '09 Nov 2026',
      title: 'Diwali Festive Mega Sale 2026',
      messageText: 'Hi {{name}}, celebrate Diwali with exclusive 30% OFF on all items! Use code: DIWALI30.\n\nReply STOP to unsubscribe.',
      imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=600&q=80',
      sentCount: 1250,
      seenCount: 984,
      status: 'sent',
    },
    {
      id: 102,
      day: 'Friday',
      date: '07 Nov 2026',
      title: 'Weekend Flash 20% Discount Push',
      messageText: 'Hello {{name}}! Flash weekend sale starts tonight at 8 PM. Check out the latest collection now.',
      imageUrl: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=600&q=80',
      sentCount: 800,
      seenCount: 620,
      status: 'sent',
    },
    {
      id: 103,
      day: 'Tuesday',
      date: '04 Nov 2026',
      title: 'Gold Coin Reward Reminder',
      messageText: 'Dear {{name}}, your loyalty reward of 500 bonus points expires this Thursday. Redeem on your next visit!',
      sentCount: 650,
      seenCount: 512,
      status: 'sent',
    },
  ]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [repeatPostData, setRepeatPostData] = useState<DayPost | null>(null);

  const handleRepeatPost = (post: DayPost) => {
    setRepeatPostData(post);
    setShowCreateModal(true);
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Day-Wise Posts & Message Templates
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Create message + picture posts, view day-by-day sending history, and repeat past broadcasts with 1 click.
          </p>
        </div>

        <button
          onClick={() => {
            setRepeatPostData(null);
            setShowCreateModal(true);
          }}
          className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shadow-sm"
        >
          <Plus size={14} /> Create New Post
        </button>
      </div>

      {/* Day-Wise History Cards List */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
          <Calendar size={16} className="text-whatsapp-teal" />
          Broadcast History (Day by Day)
        </h2>

        {posts.map((post) => (
          <div
            key={post.id}
            className="card p-5 hover:border-whatsapp-teal/40 transition shadow-sm space-y-4 bg-white"
          >
            {/* Post Day & Title bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
              <div className="flex items-center gap-3">
                <span className="bg-emerald-100 text-emerald-900 text-xs font-bold px-2.5 py-1 rounded-lg">
                  {post.day}, {post.date}
                </span>
                <h3 className="font-bold text-sm text-gray-900">{post.title}</h3>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRepeatPost(post)}
                  className="btn-primary text-xs px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 flex items-center gap-1.5"
                  title="Pre-fill and re-send this post today"
                >
                  <Repeat size={13} /> Repeat This Post
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="btn-secondary text-xs px-3 py-1.5 text-gray-700"
                >
                  View Stats →
                </button>
              </div>
            </div>

            {/* Post Content Preview & Seen Stats */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
              {/* Image Preview if present */}
              {post.imageUrl && (
                <div className="md:col-span-3">
                  <img
                    src={post.imageUrl}
                    alt={post.title}
                    className="w-full h-32 object-cover rounded-xl border border-gray-200 shadow-inner"
                  />
                </div>
              )}

              {/* Message text */}
              <div className={post.imageUrl ? 'md:col-span-6' : 'md:col-span-9'}>
                <div className="bg-[#ECE5DD] p-3.5 rounded-xl border border-gray-300/80 text-xs font-medium text-gray-800 whitespace-pre-line leading-relaxed max-w-lg shadow-sm">
                  {post.messageText}
                </div>
              </div>

              {/* Seen vs Unseen mini badge */}
              <div className="md:col-span-3 bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Sent:</span>
                  <strong>{post.sentCount}</strong>
                </div>
                <div className="flex justify-between text-emerald-800 font-bold">
                  <span className="flex items-center gap-1">
                    <Eye size={12} className="text-emerald-600" /> Seen:
                  </span>
                  <span>{post.seenCount} ({((post.seenCount / post.sentCount) * 100).toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between text-amber-800 font-semibold">
                  <span>Unseen:</span>
                  <span>{post.sentCount - post.seenCount}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create / Repeat Post Modal */}
      {showCreateModal && (
        <CreateOrRepeatModal
          initialPost={repeatPostData}
          onClose={() => setShowCreateModal(false)}
          onPublished={(newPost) => {
            setShowCreateModal(false);
            setPosts([newPost, ...posts]);
          }}
        />
      )}
    </div>
  );
}

function CreateOrRepeatModal({
  initialPost,
  onClose,
  onPublished,
}: {
  initialPost: DayPost | null;
  onClose: () => void;
  onPublished: (p: DayPost) => void;
}) {
  const [title, setTitle] = useState(initialPost ? `Repeat: ${initialPost.title}` : '');
  const [messageText, setMessageText] = useState(
    initialPost?.messageText || 'Hi {{name}}, today’s exclusive offer: 20% off! Reply STOP to opt out.'
  );
  const [imageUrl, setImageUrl] = useState(initialPost?.imageUrl || '');
  const [sendOption, setSendOption] = useState<'now' | 'scheduled'>('now');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const newPost: DayPost = {
      id: Date.now(),
      day: 'Today',
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      title,
      messageText,
      imageUrl: imageUrl.trim() || undefined,
      sentCount: 10,
      seenCount: 0,
      status: 'sent',
    };
    onPublished(newPost);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="card w-full max-w-xl p-6 space-y-4 shadow-2xl my-6">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {initialPost ? 'Repeat Post / Broadcast' : 'Create New Message Post'}
            </h2>
            <p className="text-[11px] text-gray-500">
              {initialPost
                ? 'Pre-filled with past broadcast content. Modify or repeat instantly.'
                : 'Send message with optional photo banner to your customer database.'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSend} className="space-y-4 text-xs">
          <div>
            <label className="label">Campaign / Post Title *</label>
            <input
              type="text"
              className="input font-semibold"
              placeholder="e.g. Wednesday Special Promo"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Message Text (Supports variables like &#123;&#123;name&#125;&#125;) *</label>
            <textarea
              className="input font-medium text-xs h-28 resize-none"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Post Image URL (Optional Header Picture)</label>
            <div className="flex gap-2">
              <input
                type="url"
                className="input"
                placeholder="https://example.com/promo-banner.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </div>
            {imageUrl && (
              <img
                src={imageUrl}
                alt="preview"
                className="mt-2 h-24 w-auto rounded border object-cover"
                onError={() => {}}
              />
            )}
          </div>

          <div className="space-y-1">
            <label className="label">Dispatch Action</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="opt"
                  checked={sendOption === 'now'}
                  onChange={() => setSendOption('now')}
                />
                <span>Broadcast Immediately</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="opt"
                  checked={sendOption === 'scheduled'}
                  onChange={() => setSendOption('scheduled')}
                />
                <span>Schedule for Day / Time</span>
              </label>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Cancel
            </button>
            <button type="submit" className="btn-primary text-xs px-5 py-2">
              {initialPost ? 'Repeat & Dispatch Now' : 'Publish Broadcast'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

