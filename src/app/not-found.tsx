import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="rk-card" style={{ textAlign: 'center', padding: 48 }}>
      <h1 className="section-title">Sidan finns inte</h1>
      <p className="muted">Adressen finns inte i RönneKoll.</p>
      <Link href="/">Till Översikt</Link>
    </div>
  );
}
