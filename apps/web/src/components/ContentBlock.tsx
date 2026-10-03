import type { ContentBlock } from '../types/note';
import Formula from './Formula';
import { MathText, MathPlain } from './MathText';

export function ContentBlockView({ block, fig }: { block: ContentBlock; fig?: number }) {
  switch (block.type) {
    case 'paragraph':
      return <MathText html={block.text} />;
    case 'bullets':
      return (
        <ul>
          {block.items.map((li, i) => (
            <li key={i}>
              <MathText html={li} />
            </li>
          ))}
        </ul>
      );
    case 'symbol': {
      // BUG-011: the symbol is math (often raw LaTeX like \alpha) — render
      // it through MathJax, never as raw text running into the name.
      const raw = block.symbol || '';
      const symHtml = /^\\/.test(raw.trim()) ? `\\(${raw.trim()}\\)` : raw;
      return (
        <div className="symbol-card">
          <div className="sym">
            <MathText html={symHtml} />
          </div>
          <div className="sym-body">
            <div className="sym-name">
              <MathPlain text={block.name} />
            </div>
            <div className="sym-desc">
              <MathPlain text={block.desc} />
            </div>
          </div>
        </div>
      );
    }
    case 'formula':
      return (
        <div className="formula-box">
          <div className="f-label">{block.label}</div>
          <Formula latex={block.equation} />
          {block.note && (
            <div className="f-note">
              <MathText html={block.note} />
            </div>
          )}
        </div>
      );
    case 'insight':
      return (
        <div className="insight-box">
          <div className="i-label">Key Insight</div>
          <p>
            <MathPlain text={block.text} />
          </p>
        </div>
      );
    case 'analogy':
      return (
        <div className="analogy-box">
          <div className="a-label">Analogy</div>
          <p>
            <MathPlain text={block.text} />
          </p>
        </div>
      );
    case 'workedExample':
      return (
        <div className="worked-example">
          <div className="we-eyebrow">{block.eyebrow}</div>
          <div className="we-title">
            <MathPlain text={block.title} />
          </div>
          {block.given?.length > 0 && (
            <div className="we-given">
              <div className="g-label">Given</div>
              <ul>
                {block.given.map((g, i) => (
                  <li key={i}>
                    <MathPlain text={g} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {block.steps?.map((st, i) => (
            <div key={i} className="we-step">
              <div className="we-step-label">{st.label}</div>
              <div className="we-step-title">
                <MathPlain text={st.title} />
              </div>
              {st.body && (
                <div className="we-step-body">
                  <MathPlain text={st.body} />
                </div>
              )}
              {st.math && (
                <div className="we-math">
                  <Formula latex={st.math} />
                </div>
              )}
            </div>
          ))}
          {block.result && (
            <div className="we-result">
              <MathPlain text={block.result} />
            </div>
          )}
        </div>
      );
    case 'diagram':
      return (
        <figure className="diagram-wrap">
          {block.imageRef ? (
            <img src={block.imageRef} alt={block.caption} style={{ maxWidth: '100%', borderRadius: 8 }} />
          ) : (
            <div
              style={{
                border: '1px dashed var(--border)',
                borderRadius: 8,
                padding: '20px 16px',
                color: 'var(--text3)',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Illustration{fig ? ` ${fig}` : ''} — see description below
            </div>
          )}
          <figcaption>
            <div className="d-caption">
              {fig ? `Fig ${fig} — ` : ''}{block.caption}
            </div>
            {block.description && (
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                <MathPlain text={block.description} />
              </div>
            )}
          </figcaption>
        </figure>
      );
    default:
      return null;
  }
}
