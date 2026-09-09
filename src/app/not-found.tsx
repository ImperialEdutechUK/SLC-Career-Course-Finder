import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="shell shell--narrow" style={{ paddingBlock: '4rem 3rem' }}>
      <p className="eyebrow">Page not found</p>
      <h1>We could not find that page</h1>
      <p className="lede">
        The link may be out of date, or the course may no longer be published in the current
        catalogue release.
      </p>
      <div className="cluster" style={{ marginTop: '1.5rem' }}>
        <Link href="/" className="btn btn--primary">Start the guide</Link>
        <Link href="/courses" className="btn btn--secondary">Browse all courses</Link>
      </div>
    </div>
  );
}
