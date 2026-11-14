import { t } from "@/lib/i18n/strings";

export default function HomePage() {
  return (
    <main className="container">
      <h1>{t("app.name")}</h1>
      <p>{t("home.placeholder")}</p>
    </main>
  );
}
