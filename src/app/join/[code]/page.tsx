import { redirect } from "next/navigation";

/** F2-7: /join/{code} → /room/{code} */
export default async function JoinPage({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;
  redirect(`/room/${code.toUpperCase()}`);
}
