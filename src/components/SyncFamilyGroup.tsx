"use client";

import { useEffect } from "react";
import { useAccountModal } from "@/context/AccountModalContext";

export function SyncFamilyGroup({ familyGroupId }: { familyGroupId: string | null }) {
  const { setFamilyGroupId } = useAccountModal();

  useEffect(() => {
    if (familyGroupId) {
      setFamilyGroupId(familyGroupId);
    }
  }, [familyGroupId, setFamilyGroupId]);

  return null;
}
