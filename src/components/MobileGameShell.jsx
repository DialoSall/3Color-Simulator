import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import GameIcon from "./GameIcon";
import AppearanceControl from "./AppearanceControl";
import "./MobileGameShell.css";

function GameMenu({ settings, content, description, onReplayTutorial }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef(null), trigger = useRef(null), closeButton = useRef(null);
  const id = useId();
  const location = useLocation();
  useEffect(() => { setOpen(false); }, [location.key]);
  useLayoutEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const opener = trigger.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    closeButton.current.focus();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);
  return <>
    <button ref={trigger} type="button" className="gameIconButton menuTrigger" aria-label="Open game menu" aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={() => setOpen(true)}><GameIcon name="menu" /></button>
    <dialog ref={dialog} id={id} className="gameMenu" aria-label="Game menu" onCancel={() => setOpen(false)} onClose={() => { if (!dialog.current?.open) setOpen(false); }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setOpen(false);
    }}>
      {open && <>
        <header className="gameMenuHeading"><Link to="/" onClick={() => setOpen(false)}>3Color</Link><button type="button" ref={closeButton} className="gameIconButton" aria-label="Close game menu" onClick={() => setOpen(false)}><GameIcon name="close" /></button></header>
        <nav className="gameMenuModes" aria-label="Game modes">
          <NavLink to="/levels" onClick={() => setOpen(false)}>Campaign</NavLink>
          <NavLink to="/daily" onClick={() => setOpen(false)}>Daily</NavLink>
          <NavLink to="/custom" onClick={() => setOpen(false)}>Random</NavLink>
        </nav>
        {content && <section className="gameMenuSection">{content(() => setOpen(false))}</section>}
        <section className="gameMenuSection"><h2>Settings</h2>{settings ? settings() : <AppearanceControl />}</section>
        <section className="gameMenuSection gameHelp"><h2>How to play</h2><p>3 colors. Connected circles can’t match.</p>{description && <p>{description}</p>}<p>Tap a circle to change its color. Hold it to trace its connections. Mobile play starts zoomed for larger circles. Drag to explore, or use Fit to see the whole graph.</p>{onReplayTutorial ? <button type="button" onClick={() => { onReplayTutorial(); setOpen(false); }}>Replay tutorial</button> : <Link to="/levels/1" onClick={() => setOpen(false)}>Learn in Level 1 →</Link>}</section>
      </>}
    </dialog>
  </>;
}

export default function MobileGameShell({ title, subtitle, time, conflicts = 0, recolors = 0, settings, menuContent, description, onReplayTutorial, boardRef, children }) {
  return <main className="mobileGameShell">
    <header className="mobileGameHeader">
      <div className="mobileGameIdentity"><p>{subtitle}</p><h1>{title}</h1></div>
      <GameMenu settings={settings} content={menuContent} description={description} onReplayTutorial={onReplayTutorial} />
      <div className="mobileGameStats">
        {time !== undefined && <span className="gameTime" aria-label={`Time: ${time}`}>{time}</span>}
        <span>Recolors <strong>{recolors}</strong></span>
        <span className="conflictStat" role="status" aria-live="polite" aria-atomic="true">Conflicts <strong>{conflicts}</strong></span>
      </div>
    </header>
    <div ref={boardRef} className="mobileGameContent">{children}</div>
  </main>;
}
