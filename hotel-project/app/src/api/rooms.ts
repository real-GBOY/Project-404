import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ENDPOINTS, http } from "@/config";

export type HousekeepingStatus = "clean" | "dirty" | "cleaning" | "inspected";
export type ServiceStatus = "in_service" | "maintenance" | "out_of_service";
export type RoomDisplayStatus =
  "out_of_service" | "maintenance" | "occupied" | "cleaning" | "dirty" | "reserved" | "available";

export interface RoomType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  capacity: number;
  beds: string;
  baseRate: number;
  amenities: string[];
  sortOrder: number;
  archivedAt: string | null;
  roomCount: number;
}

export interface Room {
  id: string;
  number: string;
  floor: number;
  roomTypeId: string;
  roomTypeName: string;
  roomTypeCode: string;
  housekeepingStatus: HousekeepingStatus;
  serviceStatus: ServiceStatus;
  displayStatus: RoomDisplayStatus;
  notes: string | null;
  archivedAt: string | null;
}

export interface RoomTypeInput {
  code: string;
  name: string;
  description?: string | null;
  capacity: number;
  beds: string;
  baseRate: number;
  amenities: string[];
}

export interface RoomInput {
  number: string;
  floor: number;
  roomTypeId: string;
  notes?: string | null;
}

export const roomKeys = {
  types: ["room-types"] as const,
  rooms: ["rooms"] as const,
};

export function useRoomTypes() {
  return useQuery({
    queryKey: roomKeys.types,
    queryFn: async () => (await http<{ items: RoomType[] }>(ENDPOINTS.roomTypes.list)).items,
  });
}

export function useRooms() {
  return useQuery({
    queryKey: roomKeys.rooms,
    queryFn: async () => (await http<{ items: Room[] }>(ENDPOINTS.rooms.list)).items,
  });
}

function useInvalidateRooms() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: roomKeys.types });
    void qc.invalidateQueries({ queryKey: roomKeys.rooms });
  };
}

export function useSaveRoomType() {
  const invalidate = useInvalidateRooms();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: RoomTypeInput }) => {
      if (!id) return http<RoomType>(ENDPOINTS.roomTypes.list, { method: "POST", body: input });
      const { code: _code, ...patch } = input;
      return http<RoomType>(ENDPOINTS.roomTypes.byId(id), { method: "PATCH", body: patch });
    },
    onSuccess: invalidate,
  });
}

export function useSaveRoom() {
  const invalidate = useInvalidateRooms();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: RoomInput }) =>
      id
        ? http<Room>(ENDPOINTS.rooms.byId(id), { method: "PATCH", body: input })
        : http<Room>(ENDPOINTS.rooms.list, { method: "POST", body: input }),
    onSuccess: invalidate,
  });
}

export function useArchiveRoom() {
  const invalidate = useInvalidateRooms();
  return useMutation({
    mutationFn: (id: string) => http<Room>(ENDPOINTS.rooms.archive(id), { method: "POST" }),
    onSuccess: invalidate,
  });
}
