import { ParticipantRoom } from "@/features/room/ParticipantRoom";

export default async function RoomPage({ params }: PageProps<"/room/[code]">) {
  const { code } = await params;
  return <ParticipantRoom code={code.toUpperCase()} />;
}
