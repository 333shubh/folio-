import { SECTIONS } from "@/config/sections";

/**
 * The text sections after Selected Work: About, then Contact.
 *
 * Server components - they are static text, so there is no reason to ship
 * them to the client.
 */
export default function Sections() {
  const { about, contact } = SECTIONS;

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
