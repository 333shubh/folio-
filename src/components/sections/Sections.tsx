import { SECTIONS } from "@/config/sections";

/**
 * The sections the hero nav links into.
 *
 * Server components - they are static text, so there is no reason to ship
 * them to the client.
 */
export default function Sections() {
  const { about, work, services, contact } = SECTIONS;

  return (
    <>
      <section id={about.id} className="section">
        <h2 className="section__title">{about.title}</h2>
        <div className="section__body">
          {about.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </section>

      <section id={work.id} className="section">
        <h2 className="section__title">{work.title}</h2>
        <ul className="section__list">
          {work.items.map((item) => (
            <li key={item.name} className="section__item">
              <a className="section__item-link" href={item.href}>
                <span className="section__item-name">{item.name}</span>
                <span className="section__item-note">{item.note}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section id={services.id} className="section">
        <h2 className="section__title">{services.title}</h2>
        <ul className="section__list">
          {services.items.map((item) => (
            <li key={item.name} className="section__item">
              <span className="section__item-name">{item.name}</span>
              <span className="section__item-note">{item.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id={contact.id} className="section">
        <h2 className="section__title">{contact.title}</h2>
        <div className="section__body">
          <p>
            <a className="section__mail" href={`mailto:${contact.email}`}>
              {contact.email}
            </a>
          </p>
          <ul className="section__socials">
            {contact.socials.map((s) => (
              <li key={s.label}>
                <a
                  className="section__social"
                  href={s.href}
                  target={s.href.startsWith("http") ? "_blank" : undefined}
                  rel={s.href.startsWith("http") ? "noreferrer" : undefined}
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
