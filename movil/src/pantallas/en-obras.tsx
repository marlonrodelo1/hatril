import { Link } from 'react-router';


/** Una dirección que la app no tiene, o algo que ya no existe. */
export function NoExiste() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6">
      <h1 className="t-titulo">Esto no existe</h1>
      <Link to="/" className="font-semibold">
        Volver al inicio
      </Link>
    </div>
  );
}
