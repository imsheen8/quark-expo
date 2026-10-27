/** مهمة خلفية (نظام التشغيل يقرر التوقيت؛ الحد الأدنى ~15 دقيقة وغير مضمونة). */
import { runDueTasks, syncTaskNotifications } from './engines';

export const BG_TASK = 'quark-due-tasks';
let defined = false;

function define() {
  if (defined) return;
  try {
    const TM = require('expo-task-manager');
    const BT = require('expo-background-task');
    TM.defineTask(BG_TASK, async () => {
      try {
        await runDueTasks();
        await syncTaskNotifications();
        return BT.BackgroundTaskResult.Success;
      } catch {
        return BT.BackgroundTaskResult.Failed;
      }
    });
    defined = true;
  } catch {}
}
define();

export async function registerBackground() {
  try {
    const BT = require('expo-background-task');
    if (await BT.getStatusAsync() === BT.BackgroundTaskStatus.Available) await BT.registerTaskAsync(BG_TASK, { minimumInterval: 15 });
  } catch {}
}
