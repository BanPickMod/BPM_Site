import { notFound, redirect } from "next/navigation";
import { isLang, locales } from "@/lib/i18n/config";
import { listPatchVersions } from "@/lib/patches";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

// The patch history opens on the latest version.
export default async function PatchesIndex({ params }: PageProps<"/[lang]/patches">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const latest = listPatchVersions()[0];
  if (!latest) notFound();
  redirect(`/${lang}/patches/${latest}`);
}
