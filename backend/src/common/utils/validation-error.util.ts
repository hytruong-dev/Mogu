import { ValidationError } from 'class-validator';

export interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: unknown;
}

/** Làm phẳng cây lỗi class-validator (kể cả mảng lồng nhau) thành danh sách field + message. */
export function formatValidationErrors(
  errors: ValidationError[],
): ValidationErrorDetail[] {
  const details: ValidationErrorDetail[] = [];

  const walk = (errs: ValidationError[], prefix = '') => {
    for (const err of errs) {
      const field = prefix ? `${prefix}.${err.property}` : err.property;

      if (err.constraints) {
        for (const message of Object.values(err.constraints)) {
          details.push({ field, message, value: err.value });
        }
      }

      if (err.children?.length) {
        walk(err.children, field);
      }
    }
  };

  walk(errors);
  return details;
}
