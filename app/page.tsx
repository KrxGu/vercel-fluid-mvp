export default function HomePage() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
        maxWidth: "640px"
      }}
    >
      <h1>Fluid Compute Coalescing MVP</h1>
      <p>
        This minimal Next.js app exposes two serverless endpoints that hit the
        same slow upstream:
      </p>
      <ul style={{ marginLeft: "1.5rem" }}>
        <li>
          <code>/api/search-raw</code> – baseline behaviour, each invocation
          calls the upstream.
        </li>
        <li>
          <code>/api/search</code> – wraps the call with Redis-backed request
          coalescing to collapse concurrent bursts.
        </li>
      </ul>
      <p>
        Deploy to Vercel, configure Upstash Redis credentials, then compare the
        two endpoints with a load generator such as{" "}
        <code>npx autocannon</code> running against the same query string.
      </p>
      
      <hr style={{ margin: "2rem 0", border: "none", borderTop: "1px solid #ddd" }} />
      
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <h2 style={{ fontSize: "1.25rem", margin: "0 0 0.5rem 0" }}>Links</h2>
        <div>
          <strong>Live Demo:</strong>{" "}
          <a 
            href="https://vercel-fluid-mvp.vercel.app/" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: "#0070f3", textDecoration: "none" }}
          >
            vercel-fluid-mvp.vercel.app
          </a>
        </div>
        <div>
          <strong>GitHub Repository:</strong>{" "}
          <a 
            href="https://github.com/KrxGu/vercel-fluid-mvp" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: "#0070f3", textDecoration: "none" }}
          >
            github.com/KrxGu/vercel-fluid-mvp
          </a>
        </div>
      </div>
    </main>
  );
}

