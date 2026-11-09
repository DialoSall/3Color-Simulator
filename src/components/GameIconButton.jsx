import GameIcon from "./GameIcon";

export default function GameIconButton({ icon, label, ...props }) {
  return <button type="button" className="gameIconButton" aria-label={label} title={label} {...props}><GameIcon name={icon} /></button>;
}
