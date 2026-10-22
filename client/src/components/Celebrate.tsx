import { useEffect, useState } from 'react';
import { reducedMotion } from '../util';

const DROPS = Array.from({ length: 26 }, (_, i) => ({
  angle: (i / 26) * 360 + (i % 3) * 7,
  dist: 90 + ((i * 37) % 110),
  delay: (i % 5) * 40,
  amber: i % 4 === 0,
}));

// Gotas que se espalham uma vez quando a meta é batida. Some sozinho.
export function Celebrate({ trigger }: { trigger: number }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    setActive(trigger);
    const t = setTimeout(() => setActive(0), 2200);
    return () => clearTimeout(t);
  }, [trigger]);

  return (
    <>
      <p className="sr-only" role="status">
        {active ? 'Meta do dia batida! Parabéns.' : ''}
      </p>
      {active > 0 && !reducedMotion() && (
        <div className="burst" aria-hidden="true" key={active}>
          {DROPS.map((d, i) => (
            <span
              key={i}
              className={`burst__drop${d.amber ? ' burst__drop--amber' : ''}`}
              style={{
                ['--a' as string]: `${d.angle}deg`,
                ['--d' as string]: `${d.dist}px`,
                animationDelay: `${d.delay}ms`,
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
