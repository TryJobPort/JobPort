import Link from "next/link";
import styles from "./legal.module.css";

export default function LegalLayout({
  title,
  subtitle,
  updated = "Last updated: Jan 2026",
  sections = [],
  children,
}) {
  return (
    <main className={styles.wrap}>
      <div className={styles.container}>
        <div className={styles.top}>
          <Link href="/" className={styles.brand} aria-label="JobPort home">
            <span className={styles.brandMark} aria-hidden="true" />
            <span className={styles.brandText}>JobPort</span>
          </Link>

          <Link href="/" className={styles.back}>
            ← Back to JobPort
          </Link>
        </div>

        <section className={styles.card}>
          <header className={styles.header}>
            <h1 className={styles.h1}>{title}</h1>
            {subtitle ? <p className={styles.sub}>{subtitle}</p> : null}
            <div className={styles.meta}>{updated}</div>

            {sections?.length ? (
              <nav className={styles.toc} aria-label="On this page">
                <div className={styles.tocLabel}>On this page</div>
                <div className={styles.tocChips}>
                  {sections.map((s) => (
                    <a key={s.id} href={`#${s.id}`} className={styles.chip}>
                      {s.label}
                    </a>
                  ))}
                </div>
              </nav>
            ) : null}
          </header>

          <div className={styles.body}>{children}</div>
        </section>
      </div>
    </main>
  );
}
