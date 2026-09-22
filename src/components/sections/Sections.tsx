import { SECTIONS } from "@/config/sections";

/**
 * The text sections after Selected Work and About: Contact.
 *
 * A server component - it is static text, so there is no reason to ship it
 * to the client. About used to be here too; it has its own screen and its
 * own canvas now, and lives in `components/about`.
 */
export default function Sections() {
  const { contact } = SECTIONS;

  return (
    <>
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
