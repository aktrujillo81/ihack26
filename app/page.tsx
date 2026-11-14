import { t } from "@/lib/i18n";

export default function HomePage() {
  return (
    <main className="container">
      <h1>{t.home.heading}</h1>
      <p>{t.home.body}</p>
    </main>
  );
}
