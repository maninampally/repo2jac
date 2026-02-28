import "./globals.css";

export const metadata = {
  title: "Repo-to-Jac Converter",
  description: "Convert any Python GitHub repo to idiomatic Jac/Jaseci code",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}