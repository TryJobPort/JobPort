import "./globals.css";
import { ToastProvider } from "../components/ToastProvider";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata = {
  title: "JobPort",
  description: "Job application monitoring",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
