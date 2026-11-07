import { Icon } from '@/components/Icon';
import { Logo } from './Logo';

const FEATS = ['💬 Private chat', '📞 Calls', '👥 Groups', '📸 Stories', '👤 @username', '🔐 Encryption', '🤖 AI', '☁️ Cloud', '💳 Payments', '💼 Business'];

export function EmptyMain() {
  return (
    <div className="empty-main">
      <div className="em-logo"><Logo size={96} /></div>
      <h2>WHATSMORE for Web</h2>
      <div className="brand-line">One App. More Possibilities.</div>
      <p>More Than Chat. Message, call, share stories, pay and shop — all in one place.<br />Pick a chat on the left to start.</p>
      <div className="em-feats">{FEATS.map((f) => <span key={f}>{f}</span>)}</div>
      <div className="em-foot"><Icon name="lock" size={14} /> Your personal messages are end-to-end encrypted</div>
    </div>
  );
}
