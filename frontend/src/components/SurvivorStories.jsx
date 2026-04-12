import { useEffect, useRef } from 'react';

const stories = [
  {
    name: 'Anita',
    quote: 'Early detection saved my life.',
  },
  {
    name: 'Meera',
    quote: 'Hope kept me going.',
  },
  {
    name: 'Radhika',
    quote: 'Never give up.',
  },
];

export default function SurvivorStories() {
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('in-view');
        });
      },
      { threshold: 0.15 }
    );

    const cards = sectionRef.current?.querySelectorAll('.anim-in');
    cards?.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  return (
    <section className="section" id="stories" ref={sectionRef}>
      <h2 className="section__title">Survivor Stories</h2>
      <p className="section__subtitle">Hope, courage and strength</p>

      <div className="stories__grid">
        {stories.map((s, i) => (
          <div
            key={s.name}
            className="story-card anim-in"
            style={{ transitionDelay: `${i * 0.12}s` }}
          >
            <h3 className="story-card__name">{s.name}</h3>
            <p className="story-card__quote">{s.quote}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
