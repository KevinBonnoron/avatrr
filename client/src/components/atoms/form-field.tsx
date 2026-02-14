import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface FormFieldProps {
  label: React.ReactNode;
  labelClassName?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({ label, labelClassName, children, className }: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className={labelClassName}>{label}</Label>
      {children}
    </div>
  );
}
