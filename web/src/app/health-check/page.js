export default async function HealthCheckPage() {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
  const res = await fetch(`${base}/health`, { cache: "no-store" });
  const health = await res.json();

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ marginBottom: 8 }}>JobPort</h1>
      <p style={{ marginTop: 0, color: "#555" }}>Health handshake (dev)</p>
      <pre
        style={{
          marginTop: 16,
          padding: 16,
          border: "1px solid #ddd",
          borderRadius: 12,
          maxWidth: 720,
          whiteSpace: "pre-wrap",
        }}
      >
        {JSON.stringify(health, null, 2)}
      </pre>
    </main>
  );
}
