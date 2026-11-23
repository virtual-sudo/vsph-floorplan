// Small line icons (24 x 24 grid, 1.6 stroke)
const P: Record<string, string> = {
  home: 'M4 11 12 4l8 7M6 9.5V20h12V9.5',
  rooms: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  palette: 'M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.2-1.8-.5-1-.1-2.2 1.2-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10zM7.5 11.5h.01M10 7.5h.01M15 7.5h.01M17 11h.01',
  camera: 'M3 8h4l2-3h6l2 3h4v11H3zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.2a2.6 2.6 0 0 1 5 1c0 1.8-2.5 2.2-2.5 3.8M12 17h.01',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  sunset: 'M3 18h18M6 14a6 6 0 0 1 12 0M12 4v3M4.6 8.6l1.6 1.2M19.4 8.6l-1.6 1.2M8 21h8',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  walls: 'M3 20h18M5 20V8l7-4 7 4v12M9 20v-6h6v6',
  cut: 'M3 20h18M5 20v-7h14v7M5 13l2-2M9 13l2-2M13 13l2-2M17 13l2-2',
  top: 'M12 3v4M12 17v4M3 12h4M17 12h4M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  reset: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4',
  x: 'M6 6l12 12M18 6 6 18',
  chevL: 'M15 6l-6 6 6 6',
  chevR: 'M9 6l6 6-6 6',
  chevD: 'M6 9l6 6 6-6',
  pano: 'M3 7c3 1.3 6 2 9 2s6-.7 9-2v10c-3-1.3-6-2-9-2s-6 .7-9 2zM12 9v6',
  focus: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  area: 'M4 4h16v16H4zM4 9h3M4 14h3M9 4v3M14 4v3',
  ruler: 'M3 16 16 3l5 5L8 21zM7 12l2 2M10 9l2 2M13 6l2 2',
  height: 'M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4',
  floor: 'M3 17 12 21l9-4-9-4zM3 12l9 4 9-4',
  pin: 'M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  // room icons
  lift: 'M6 3h12v18H6zM12 3v18M9 9l-1.5 2h3zM15 13l1.5-2h-3z',
  sofa: 'M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M3 12a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3zM5 17v2M19 17v2',
  lounge: 'M6 11V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4M4 11h3v4h10v-4h3v7H4zM6 18v2M18 18v2',
  glass: 'M6 4h12l-6 7zM12 11v8M8 20h8',
  dining: 'M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10M17 3c-1.7 1-3 3-3 6h3v12',
  kitchen: 'M4 10h16v10H4zM4 14h16M8 10V6a4 4 0 0 1 8 0v4M9 17h.01M15 17h.01',
  leaf: 'M5 19C5 10 10 5 20 4c-1 10-6 15-15 15zM5 19l7-7',
  study: 'M4 20h16M7 20v-5h10v5M12 15V9M9 5l3 4 3-4',
  hall: 'M5 21V9a7 7 0 0 1 14 0v12M3 21h18M12 21v-6',
  bed: 'M3 18V7M3 13h18v5M21 18v-3a3 3 0 0 0-3-3h-7v4M7 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  bath: 'M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM6 12V6a2 2 0 0 1 4 0M7 19l-1 2M17 19l1 2',
  closet: 'M12 8a2 2 0 1 1 2-2M12 8v1.5L3 16h18l-9-6.5',
  layers: 'M12 3 3 8l9 5 9-5zM3 13l9 5 9-5',
  tower: 'M8 21V5l4-2 4 2v16M5 21h14M10.5 8h3M10.5 11h3M10.5 14h3M10.5 17h3',
  up: 'M6 15l6-6 6 6',
  street: 'M4 21 9 3M20 21 15 3M12 5v2M12 11v2M12 17v2',
  pool: 'M3 17c2 0 2-1.5 4.5-1.5S10 17 12 17s2-1.5 4.5-1.5S19 17 21 17M7 14V5a2 2 0 0 1 4 0M13 14V5a2 2 0 0 1 4 0M7 8h6M7 11h6',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a14.6 14.6 0 0 1-3.1 3.8M6.2 6.2C3.6 8 2 12 2 12s3.5 7 10 7c1.2 0 2.2-.2 3.2-.6',
  plan: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15'
};

export function Icon({ name, size = 18, stroke = 1.6 }: { name: string; size?: number; stroke?: number }) {
  const d = P[name] || P.pin;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
