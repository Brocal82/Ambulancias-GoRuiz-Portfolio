// frontend/src/modules/diensts/utils/classNames.ts

export const mergeClasses = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(" ");
