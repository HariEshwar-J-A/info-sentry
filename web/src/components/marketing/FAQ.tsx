interface FAQItem {
  question: string
  answer: string
}

interface Props {
  items: FAQItem[]
  heading?: string
}

/**
 * Uses native <details>/<summary> for a11y-first accordion — no JS needed,
 * keyboard and SR work out of the box. CSS handles the open/close animation.
 */
export function FAQ({ items, heading = 'Frequently asked questions' }: Props) {
  return (
    <section aria-labelledby="faq-heading">
      <h2
        id="faq-heading"
        style={{
          fontFamily: 'Sora, sans-serif',
          fontSize: 'clamp(22px, 3vw, 36px)',
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          marginBottom: 32,
        }}
      >
        {heading}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item, i) => (
          <details
            key={i}
            style={{
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              overflow: 'hidden',
            }}
          >
            <summary
              style={{
                padding: '18px 20px',
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--text-primary)',
                cursor: 'pointer',
                listStyle: 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                userSelect: 'none',
              }}
            >
              {item.question}
              <span aria-hidden="true" style={{ color: 'var(--violet-400)', fontSize: 18, flexShrink: 0 }}>+</span>
            </summary>
            <p style={{
              padding: '0 20px 18px',
              fontSize: 14,
              color: 'var(--text-secondary)',
              lineHeight: 1.7,
              margin: 0,
            }}>
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  )
}
