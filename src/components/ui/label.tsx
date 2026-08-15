'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Etiqueta de campo. 13 px en medium, que es lo que fija la escala del sistema
 * de diseño para los labels.
 */
function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn(
        'flex items-center gap-2 text-[13px] leading-tight font-medium text-foreground select-none',
        'group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Label };
