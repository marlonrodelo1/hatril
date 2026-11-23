/** La raya con «o con tu correo» entre los botones de Google y Apple y el formulario. */
export function Separador() {
  return (
    <div className="flex items-center gap-3 text-label text-muted-foreground">
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
      o con tu correo
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </div>
  );
}
