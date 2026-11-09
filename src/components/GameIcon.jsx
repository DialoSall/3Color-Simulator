const paths = {
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "m6 6 12 12M6 18 18 6",
  maximize: "M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5",
  minimize: "M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5",
  fit: "M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5M8 12h8m-4-4v8",
  plus: "M5 12h14M12 5v14",
  minus: "M5 12h14",
  reset: "M4 10a8 8 0 1 1 1 7M4 4v6h6",
  previous: "m14 5-7 7 7 7",
  next: "m10 5 7 7-7 7",
};
export default function GameIcon({ name }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>;
}
