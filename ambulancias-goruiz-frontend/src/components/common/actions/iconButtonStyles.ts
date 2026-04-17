const ICON_BUTTON_INTERACTION_CLASS =
  "border border-transparent hover:border-orange-400 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0.5 active:shadow-sm";

export function withCommonIconButtonInteraction(baseClassName: string) {
  return `${baseClassName} ${ICON_BUTTON_INTERACTION_CLASS}`;
}

