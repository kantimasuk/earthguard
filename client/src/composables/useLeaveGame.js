// "ออกจากเกม" จากหน้า Pre-test / เล่นเกม / Post-test
// → ลบรอบการเล่นนี้ที่เซิร์ฟเวอร์ (ไม่เก็บผลเกม ผล Pre-test และผล Post-test) → กลับหน้าหลัก
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { sessionApi } from '@/services/sessionApi';
import { useSessionStore } from '@/stores/session';
import { useToastStore } from '@/stores/toast';

export function useLeaveGame(beforeLeave) {
  const router = useRouter();
  const session = useSessionStore();
  const toast = useToastStore();
  const exiting = ref(false);

  async function leave() {
    if (exiting.value) return;
    exiting.value = true;
    try {
      await beforeLeave?.();
      if (session.id) await sessionApi.remove(session.id);
    } catch (e) {
      // ลบไม่ได้เพราะไม่มีรอบนี้แล้ว = ไม่มีอะไรต้องลบ
      if (e?.status && e.status !== 404 && e.status !== 409) {
        toast.show('ออกจากเกมไม่สำเร็จ ลองใหม่อีกครั้ง', { type: 'error' });
        exiting.value = false;
        return;
      }
    }
    session.clear();
    toast.show('ออกจากเกมแล้ว ผลของรอบนี้ไม่ถูกบันทึก');
    router.replace('/menu');
  }

  return { leave, exiting };
}
