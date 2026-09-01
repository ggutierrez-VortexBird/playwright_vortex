export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="topbar -mx-6 -mt-6 rounded-none">
        <h2>Grabación</h2>
      </div>
      <div className="vp-chrome vp-loading">
        <div className="vp-loading-pulse">
          <span className="rec-dot" />
          <span>Conectando al grabador…</span>
        </div>
      </div>
    </div>
  );
}