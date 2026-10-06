import { HostRoom } from "@/features/room/HostRoom";

export default async function HostPage({
  params,
}: PageProps<"/room/[code]/host">) {
  const { code } = await params;
  // TODO(마일스톤 3): localStorage host_key 확인, 없으면 참가자 화면으로 (F2-8) — 클라이언트에서 처리
  return <HostRoom code={code.toUpperCase()} />;
}
