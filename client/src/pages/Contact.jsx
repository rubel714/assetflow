import React, { useState } from "react";
import { showSnackbar } from "../lib/snackbar";

const CONTACT = {
  email: "hello@assetflow.example",
  phone: "+880 1700 000000",
  hours: "Sunday–Thursday, 9:00–18:00",
};

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      showSnackbar("Please fill in all fields", { type: "validation" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      showSnackbar("Enter a valid email address", { type: "validation" });
      return;
    }

    setSending(true);
    window.setTimeout(() => {
      showSnackbar("Thanks — we received your message and will reply by email.");
      setName("");
      setEmail("");
      setMessage("");
      setSending(false);
    }, 400);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-enter">
      <section className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.3em] text-muted mb-3">Contact us</p>
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ color: "var(--text-main)" }}>
          Talk with the <span className="text-accent">AssetFlow</span> team
        </h2>
        <p className="text-muted text-sm md:text-base leading-relaxed">
          Questions about a demo, licensing, or how the register works? Send a note and we will get back to you.
        </p>
      </section>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="glass rounded-2xl p-5 border border-white/10">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">Email</p>
            <a href={`mailto:${CONTACT.email}`} className="text-accent font-medium break-all">
              {CONTACT.email}
            </a>
          </div>
          <div className="glass rounded-2xl p-5 border border-white/10">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">Phone</p>
            <p className="font-medium">{CONTACT.phone}</p>
          </div>
          <div className="glass rounded-2xl p-5 border border-white/10">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">Hours</p>
            <p className="font-medium">{CONTACT.hours}</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="lg:col-span-3 glass rounded-2xl p-6 md:p-8 border border-white/10 space-y-5"
        >
          <div>
            <label className="input-label" htmlFor="contact-name">
              Name
            </label>
            <input
              id="contact-name"
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={sending}
              autoComplete="name"
            />
          </div>
          <div>
            <label className="input-label" htmlFor="contact-email">
              Email
            </label>
            <input
              id="contact-email"
              type="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={sending}
              autoComplete="email"
            />
          </div>
          <div>
            <label className="input-label" htmlFor="contact-message">
              Message
            </label>
            <textarea
              id="contact-message"
              className="input-field min-h-[8rem] resize-y"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sending}
            />
          </div>
          <button
            type="submit"
            disabled={sending}
            className="px-5 py-3 rounded-xl bg-cyan-600 text-white font-bold shadow-lg hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? "Sending…" : "Send message"}
          </button>
        </form>
      </div>
    </div>
  );
}
