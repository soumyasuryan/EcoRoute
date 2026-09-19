import "./globals.css";
import "leaflet/dist/leaflet.css";

export const metadata = {
  title: "EcoRoute — Operations Dispatch Console",
  description: "Enterprise operations routing console for warehouse dispatchers navigating Delhi NCR with real-time AQI monitoring.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full bg-[#090d16]">
      <body className="min-h-full flex flex-col bg-[#090d16] text-[#f8fafc] antialiased selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
