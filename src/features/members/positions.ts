import {
  ControllerIcon,
  DuelistIcon,
  InitiatorIcon,
  SentinelIcon,
} from "@/components/ui/icons";
import type { Position } from "@/lib/constants";

export const POSITION_ICONS: Record<Position, typeof DuelistIcon> = {
  duelist: DuelistIcon,
  initiator: InitiatorIcon,
  controller: ControllerIcon,
  sentinel: SentinelIcon,
};
