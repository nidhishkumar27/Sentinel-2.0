
export const AUTHORITY_DEPARTMENTS = [
  {
    value: 'POLICE',
    label: 'Police Department',
  },
  {
    value: 'MEDICAL',
    label: 'Medical / Ambulance',
  },
  {
    value: 'FIRE',
    label: 'Fire & Rescue',
  },
  {
    value: 'DISASTER',
    label: 'Disaster Management',
  },
  {
    value: 'OTHER',
    label: 'Other Emergency Services',
  },
] as const;

export type AuthorityDepartment =
  (typeof AUTHORITY_DEPARTMENTS)[number]['value'];
