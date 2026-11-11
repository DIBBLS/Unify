import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, type ClassListMe } from '../lib/api';
import { errorToast } from '../lib/errors';
import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display, Label } from '../components/redesign/ui';

// One-time: the name and matric number on the register.
// Once the class rep has uploaded the class list, the student finds their own
// entry by matric instead (the name comes from the list). Verifying with the
// LASU student email is offered but not required yet.
const input: React.CSSProperties = {
  width: '100%', padding: 14, marginTop: 6, borderRadius: 12, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text)', fontSize: 16,
};
const shell = { maxWidth: 'min(var(--shell, 480px), 560px)', margin: '0 auto', padding: '20px 16px 96px' } as const;

export default function AttendanceSetupRoute() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') ? decodeURIComponent(params.get('next') as string) : ROUTES.attendancePass;
  const [me, setMe] = useState<ClassListMe | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = () =>
    api.classListMe().then(setMe).catch(() => setMe(null)).finally(() => setLoaded(true));
  useEffect(() => { void load(); }, []);

  if (!loaded) return <div style={shell} />;
  return (
    <div style={shell}>
      <BackButton to={ROUTES.timetable} />
      {me?.list ? <ClaimFlow me={me} onDone={() => navigate(next, { replace: true })} reload={load} /> : <TypedDetails next={next} />}
    </div>
  );
}

// No class list yet: the student types their own name and matric (as before).
function TypedDetails({ next }: { next: string }) {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [matric, setMatric] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.attendanceProfile().then((p) => { setFullName(p.fullName); setMatric(p.matric); }).catch(() => {});
  }, []);

  const save = async () => {
    if (fullName.trim().length < 2 || matric.trim().length < 3) {
      errorToast(new Error('Enter your full name and matric number.'), 'save your details');
      return;
    }
    setBusy(true);
    try {
      await api.attendanceSetProfile(fullName.trim(), matric.trim());
      navigate(next, { replace: true });
    } catch (e) {
      // The class list went up while this page was open: switch to claiming.
      if ((e as { status?: number }).status === 409) window.location.reload();
      else errorToast(e, 'save your details');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 8 }}>
        <BoxBoy pose="phoneOut" width={110} />
        <Display size={26}>Your attendance details</Display>
        <div className="t-13 muted">Your lecturer sees these on the register. When your class rep uploads the class list, you'll confirm your name from it.</div>
      </Card>
      <div style={{ marginTop: 18 }}>
        <Label>Full name (as on your ID)</Label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Adaeze Okafor" autoComplete="name" style={input} />
      </div>
      <div style={{ marginTop: 14 }}>
        <Label>Matric number</Label>
        <input value={matric} onChange={(e) => setMatric(e.target.value)} placeholder="e.g. 190401001" autoCapitalize="characters" style={input} />
      </div>
      <button className="btn btn--amber btn--block" disabled={busy} onClick={() => void save()} style={{ marginTop: 22 }}>
        {busy ? 'Saving…' : 'Save and continue'}
      </button>
    </>
  );
}

function ClaimFlow({ me, onDone, reload }: { me: ClassListMe; onDone: () => void; reload: () => Promise<void> }) {
  const [matric, setMatric] = useState('');
  const [fullName, setFullName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [askHoc, setAskHoc] = useState<null | 'not_on_list' | 'already_claimed'>(null);
  const [emailOpen, setEmailOpen] = useState(!!me.emailPending);
  const cls = `${me.list!.department} · ${me.list!.level}`;

  const claim = async (withRequest = false) => {
    if (matric.trim().length < 4) {
      errorToast(new Error('Enter your matric number.'), 'find you on the list');
      return;
    }
    setBusy(true);
    try {
      const r = await api.classListClaim(matric.trim(), withRequest ? { fullName: fullName.trim(), note: note.trim() || undefined } : undefined);
      if (r.status === 'claimed') onDone();
      else if (r.status === 'not_found') setAskHoc(r.reason);
      else await reload();
    } catch (e) {
      errorToast(e, 'find you on the list');
    } finally {
      setBusy(false);
    }
  };

  // Already on the list.
  if (me.entry) {
    return (
      <>
        <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 8 }}>
          <BoxBoy pose="cheer" width={110} />
          <Display size={26}>You're on the class list</Display>
          <div className="t-15 w-7">{me.entry.name}</div>
          <div className="t-13 muted">{me.entry.matric} · {cls}</div>
          {me.entry.verifiedEmail && <div className="t-13" style={{ color: 'var(--u-green-deep, #16a34a)' }}>Verified with your LASU email</div>}
        </Card>
        <button className="btn btn--amber btn--block" onClick={onDone} style={{ marginTop: 18 }}>Continue</button>
        {!me.entry.verifiedEmail && (
          <EmailVerify me={me} open={emailOpen} setOpen={setEmailOpen} onClaimed={onDone} reload={reload} optionalNote="Optional. It confirms the entry is yours." />
        )}
        <div className="t-13 muted" style={{ textAlign: 'center', marginTop: 14 }}>Name spelt wrong? Ask your class rep to fix it on the class list.</div>
      </>
    );
  }

  // Waiting for the class rep.
  if (me.request) {
    return (
      <>
        <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 8 }}>
          <BoxBoy pose="phoneOut" width={110} />
          <Display size={26}>Waiting for your class rep</Display>
          <div className="t-13 muted">
            {me.request.reason === 'already_claimed'
              ? `Another account has already claimed ${me.request.matric}. Your class rep will check and sort it out.`
              : `${me.request.matric} isn't on the ${cls} class list yet. Your class rep can add you.`}
          </div>
        </Card>
        <div className="t-13 muted" style={{ textAlign: 'center', marginTop: 12 }}>You can still show My pass in class while you wait.</div>
        <button className="btn btn--amber btn--block" onClick={onDone} style={{ marginTop: 16 }}>Go to My pass</button>
        <button
          className="btn btn--white btn--block"
          style={{ marginTop: 10 }}
          onClick={() => void api.classListCancelRequest().then(reload).catch((e) => errorToast(e, 'cancel the request'))}
        >
          Cancel request
        </button>
      </>
    );
  }

  return (
    <>
      <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 8 }}>
        <BoxBoy pose="phoneOut" width={110} />
        <Display size={26}>Find yourself on the class list</Display>
        <div className="t-13 muted">Your class rep uploaded the {cls} list ({me.list!.size} students). Enter your matric number to confirm which one is you. You only do this once.</div>
      </Card>
      <div style={{ marginTop: 18 }}>
        <Label>Matric number</Label>
        <input
          value={matric}
          onChange={(e) => { setMatric(e.target.value); setAskHoc(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !askHoc) void claim(); }}
          placeholder="e.g. 190401001"
          autoCapitalize="characters"
          inputMode="text"
          style={input}
        />
      </div>
      {!askHoc ? (
        <>
          <button className="btn btn--amber btn--block" disabled={busy} onClick={() => void claim()} style={{ marginTop: 18 }}>
            {busy ? 'Checking…' : "That's me"}
          </button>
          <button className="btn btn--white btn--block" style={{ marginTop: 10 }} onClick={() => setAskHoc('not_on_list')}>
            I'm not on the list
          </button>
        </>
      ) : (
        <>
          <div role="status" className="t-13" style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'var(--surface-2, #f8f7f3)', border: '1px solid var(--border)' }}>
            {askHoc === 'already_claimed'
              ? `Another account has already claimed ${matric.trim().toUpperCase()}. If it's yours, ask your class rep to check.`
              : matric.trim()
                ? `${matric.trim().toUpperCase()} isn't on the ${cls} list. Check the number, or ask your class rep to add you.`
                : 'Enter your matric number above, then ask your class rep to add you.'}
          </div>
          <div style={{ marginTop: 14 }}>
            <Label>Full name (as on your ID)</Label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Adaeze Okafor" autoComplete="name" style={input} />
          </div>
          <div style={{ marginTop: 14 }}>
            <Label>Note to your class rep (optional)</Label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. I joined late / direct entry" maxLength={300} style={input} />
          </div>
          <button className="btn btn--amber btn--block" disabled={busy || fullName.trim().length < 2 || matric.trim().length < 4} onClick={() => void claim(true)} style={{ marginTop: 18 }}>
            {busy ? 'Sending…' : 'Ask my class rep'}
          </button>
          <button className="btn btn--white btn--block" style={{ marginTop: 10 }} onClick={() => setAskHoc(null)}>Back</button>
        </>
      )}
      <EmailVerify me={me} open={emailOpen} setOpen={setEmailOpen} onClaimed={onDone} reload={reload} optionalNote="Or confirm with your LASU student email: your matric is read from the address." />
    </>
  );
}

function EmailVerify({ me, open, setOpen, onClaimed, reload, optionalNote }: {
  me: ClassListMe; open: boolean; setOpen: (v: boolean) => void; onClaimed: () => void; reload: () => Promise<void>; optionalNote: string;
}) {
  const [email, setEmail] = useState(me.emailPending?.email || '');
  const [sentTo, setSentTo] = useState(me.emailPending?.email || '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      const r = await api.classListEmailStart(email.trim());
      setSentTo(r.email);
    } catch (e) {
      errorToast(e, 'send the code');
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    setBusy(true);
    try {
      const r = await api.classListEmailConfirm(code);
      if (r.status === 'claimed') onClaimed();
      else await reload();
    } catch (e) {
      errorToast(e, 'check the code');
    } finally {
      setBusy(false);
    }
  };

  if (!open)
    return (
      <button className="btn btn--white btn--block" style={{ marginTop: 10 }} onClick={() => setOpen(true)}>
        Verify with my LASU email
      </button>
    );
  return (
    <Card style={{ marginTop: 16, gap: 8 }}>
      <div className="t-15 w-7">Verify with your LASU email</div>
      <div className="t-13 muted">{optionalNote}</div>
      {!sentTo ? (
        <>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={me.emailFormat}
            type="email"
            autoCapitalize="none"
            autoComplete="email"
            style={input}
          />
          <button className="btn btn--amber btn--block" disabled={busy || !/@st\.lasu\.edu\.ng$/i.test(email.trim())} onClick={() => void send()}>
            {busy ? 'Sending…' : 'Send me a code'}
          </button>
        </>
      ) : (
        <>
          <div className="t-13">We sent a 6-digit code to <b>{sentTo}</b>. It can take a few minutes, and may land in junk.</div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            aria-label="Code from the email"
            style={{ ...input, textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: 800 }}
          />
          <button className="btn btn--amber btn--block" disabled={busy || code.length !== 6} onClick={() => void confirm()}>
            {busy ? 'Checking…' : 'Confirm'}
          </button>
          <button className="btn btn--white btn--block" disabled={busy} onClick={() => { setSentTo(''); setCode(''); }}>Use a different email</button>
        </>
      )}
    </Card>
  );
}
