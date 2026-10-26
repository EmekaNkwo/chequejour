/**
 * Guards a screen while work in progress would be lost: every way of leaving (a close
 * button, the Android back button, the back gesture) first asks `confirmLeave`, and
 * the navigation only goes ahead if it resolves to true.
 */
import { usePreventRemove } from 'expo-router';
import { useState } from 'react';

export function useConfirmLeave(active: boolean, confirmLeave: () => Promise<boolean>): void {
  const [leaving, setLeaving] = useState(false);
  usePreventRemove(active && !leaving, ({ repeat }) => {
    void confirmLeave().then((leave) => {
      if (!leave) return;
      setLeaving(true);
      repeat();
    });
  });
}
