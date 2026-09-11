import Link from "next/link";

export default function NotFound() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center"
      style={{
        background:
          "radial-gradient(circle at 30% 20%, #1B2438 0%, #131B2E 55%, #0B0F1A 100%)",
      }}
    >
      <p
        className="font-headline font-extrabold leading-none"
        style={{
          fontSize: "88px",
          letterSpacing: "-0.03em",
          backgroundImage: "linear-gradient(180deg, #fff, #7C839B)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        404
      </p>
      <p className="font-body text-body-md text-[#B7BEDA]">
        Esta pantalla no existe o fue movida.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-lg bg-m3-secondary-container px-5 py-2.5 font-label text-label-md font-semibold text-m3-on-secondary-container transition-colors hover:bg-m3-secondary-fixed"
      >
        Volver al dashboard
      </Link>
    </main>
  );
}
