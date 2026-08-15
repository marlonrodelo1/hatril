/**
 * Helper de toasts (Sonner) para Client Components.
 *
 * IMPORTANTE: Sonner es client-side. No se puede llamar a `toast()` directamente
 * desde un Server Action. Para mostrar feedback tras una Server Action que
 * **redirige**, mantenemos el patrón actual `?ok=1` / `?error=...` en la URL
 * (lo lee la página y lo renderiza). Este helper es para futuras acciones
 * **inline** (sin redirect): el Client Component llama a la action, recibe el
 * resultado y muestra el toast aquí mismo.
 *
 * Uso típico (Client Component):
 *   import { toast } from '@/lib/toast';
 *   toast.success('Cliente creado');
 *   toast.error('No se pudo guardar');
 */
export { toast } from 'sonner';
