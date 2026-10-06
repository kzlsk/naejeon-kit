"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { getSupabase } from "@/lib/supabase/client";

import { fetchMembers } from "@/features/members/api";
import type { Member } from "@/features/members/types";

import { fetchRoom, type Room } from "./api";

export const queryKeys = {
  room: (code: string) => ["room", code] as const,
  members: (roomId: string) => ["members", roomId] as const,
};

export function useRoom(code: string) {
  return useQuery({
    queryKey: queryKeys.room(code),
    queryFn: () => fetchRoom(code),
  });
}

export function useMembers(roomId: string) {
  return useQuery({
    queryKey: queryKeys.members(roomId),
    queryFn: () => fetchMembers(roomId),
  });
}

/**
 * 방 데이터 실시간 구독 (PRD §8). 이벤트가 오면 해당 쿼리를 다시 불러온다.
 * 구독이 붙은 직후에도 한 번 다시 불러와서, 첫 조회와 구독 사이의 변경을 놓치지 않는다.
 * @returns 실시간 연결 여부
 */
export function useRoomRealtime(room: Room): boolean {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    const membersKey = queryKeys.members(room.id);
    const refetchMembers = () =>
      queryClient.invalidateQueries({ queryKey: membersKey });
    const refetchRoom = () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.room(room.code) });

    const channel = supabase
      .channel(`room:${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "members",
          filter: `room_id=eq.${room.id}`,
        },
        refetchMembers,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "members",
          filter: `room_id=eq.${room.id}`,
        },
        refetchMembers,
      )
      // DELETE 는 필터가 적용되지 않으므로, 우리 방 멤버 id 인지 캐시로 확인
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "members" },
        (payload) => {
          const id = (payload.old as { id?: string }).id;
          const cached = queryClient.getQueryData<Member[]>(membersKey);
          if (!id || cached?.some((m) => m.id === id)) refetchMembers();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${room.id}`,
        },
        refetchRoom,
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") {
          refetchMembers();
          refetchRoom();
        }
      });

    return () => {
      setConnected(false);
      supabase.removeChannel(channel);
    };
  }, [room.id, room.code, queryClient]);

  return connected;
}
