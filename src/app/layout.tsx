import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RewardConnection",
  description: "Jetons, tâches et temps Internet familial",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
