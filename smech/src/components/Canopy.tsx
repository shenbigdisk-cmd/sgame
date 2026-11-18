import { memo } from 'react';

/** A slim cockpit rim, kept outside the combat view and the sight. */
export default memo(function Canopy() {
  // Leave the lower edge open so the HUD floats over the actual scene.
  const aperture = 'M96 18H1344L1425 95V803L1363 861V900H77V861L15 803V95Z';
  return (
    <svg className="cp-canopy" aria-hidden="true" viewBox="0 0 1440 900" preserveAspectRatio="none">
      <defs>
        <linearGradient id="canopy-rim" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#111922" />
          <stop offset=".45" stopColor="#080d12" />
          <stop offset="1" stopColor="#0b1117" />
        </linearGradient>
      </defs>
      <path d={`M0 0H1440V900H0Z ${aperture}`} fill="url(#canopy-rim)" fillRule="evenodd" />
      <path d={aperture} fill="none" stroke="#53636a" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <path
        d={aperture}
        fill="none"
        stroke="var(--cp-accent)"
        opacity=".28"
        strokeWidth=".7"
        vectorEffect="non-scaling-stroke"
      />
      <path d="M0 35H84L99 20H0ZM1440 35H1356L1341 20H1440Z" fill="#1d2a30" opacity=".6" />
      <path d="M553 0H887L873 9H567Z" fill="#1c2930" />
      <path
        d="M602 9H649M791 9H838"
        stroke="var(--cp-accent)"
        opacity=".5"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M16 789V803L76 860H109M1424 789V803L1364 860H1331"
        fill="none"
        stroke="var(--cp-accent)"
        opacity=".24"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
});
