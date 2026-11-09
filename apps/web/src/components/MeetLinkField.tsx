import { useState } from 'react';
import { Video, ClipboardPaste, ExternalLink } from 'lucide-react';
import { MEET_NEW_URL, cleanMeetLink, isMeetLink, isHttpsLink } from '../lib/meet';

// One place to get a Google Meet link: open Google's "new meeting" in another tab (the app stays
// open here), copy the link, paste it back. The field cleans what you paste and says if it does
// not look like a Meet link. Other https links (Zoom, Teams) are accepted with a gentle note.
export default function MeetLinkField({ value, onChange, label = 'Online class link' }: { value: string; onChange: (v: string) => void; label?: string }) {
  const [note, setNote] = useState('');
  const set = (raw: string) => {
    const v = cleanMeetLink(raw);
    onChange(v);
    setNote(!v ? '' : isMeetLink(v) ? '' : isHttpsLink(v) ? 'This is not a Google Meet link, but it will work for joining.' : 'That does not look like a link yet.');
  };
  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) set(text);
      else setNote('Nothing to paste yet. Copy the meeting link first.');
    } catch {
      setNote('Your browser blocked pasting. Long-press the box and paste instead.');
    }
  };
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700 }}>{label}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a href={MEET_NEW_URL} target="_blank" rel="noopener noreferrer" className="btn btn--white btn--sm" style={{ gap: 6 }}>
          <Video size={14} /> Create a Google Meet <ExternalLink size={12} />
        </a>
        <button type="button" className="btn btn--white btn--sm" style={{ gap: 6 }} onClick={() => void paste()}>
          <ClipboardPaste size={14} /> Paste link
        </button>
      </div>
      <input
        value={value}
        onChange={(e) => set(e.target.value)}
        inputMode="url"
        autoComplete="off"
        placeholder="https://meet.google.com/abc-defg-hij"
        aria-label={label}
        style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 }}
      />
      <div style={{ fontSize: 11, color: note ? 'var(--u-warn-ink)' : 'var(--text2)' }}>
        {note || 'Create opens Google Meet in a new tab. Copy the meeting link there, then tap Paste link.'}
      </div>
    </div>
  );
}
