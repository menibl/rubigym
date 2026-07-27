/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';

interface RubisLogoProps {
  className?: string;
  size?: number;
}

export const RubisLogo: React.FC<RubisLogoProps> = ({ className = '', size = 120 }) => {
  const [logoPathIndex, setLogoPathIndex] = useState(0);

  // List of paths and formats we try in order to load the uploaded logo.
  const logoPaths = [
    '/logo.png',
    '/logo.jpg',
    '/logo.jpeg',
    '/logo.webp',
    '/logo.PNG',
    '/logo.JPG',
    '/logo.JPEG',
    '/logo.WEBP',
    'logo.png',
    'logo.jpg',
    '/assets/logo.png',
    '/src/assets/logo.png'
  ];

  const handleImgError = () => {
    setLogoPathIndex((prevIndex) => prevIndex + 1);
  };

  // If we haven't exhausted our candidate paths, attempt to load the current path
  if (logoPathIndex < logoPaths.length) {
    return (
      <div className={`flex flex-col items-center justify-center ${className}`}>
        <img
          src={logoPaths[logoPathIndex]}
          alt="BALY WELLNESS Logo"
          style={{ width: size, height: size }}
          className="object-contain transition-transform duration-300 hover:scale-105 rounded-full"
          onError={handleImgError}
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="transition-transform duration-300 hover:scale-105"
      >
        {/* White background circle to make it look exactly like the image paper/sticker */}
        <circle cx="100" cy="100" r="95" fill="#ffffff" />
        
        {/* Outer thick circular border frame */}
        <circle cx="100" cy="100" r="94" stroke="#000000" strokeWidth="5" />
        
        {/* Inner thin circular frame line */}
        <circle cx="100" cy="100" r="88" stroke="#000000" strokeWidth="1.2" opacity="0.4" />

        {/* Barbell Rack Stand / Support on Left */}
        <g id="rack-stand">
          {/* Vertical stand post */}
          <rect x="42" y="80" width="3" height="40" fill="#000000" />
          {/* Support pin hook */}
          <path d="M 45,98 L 38,98 L 38,103 L 45,103 Z" fill="#000000" />
          {/* Stand holes */}
          <circle cx="43.5" cy="85" r="0.8" fill="#ffffff" />
          <circle cx="43.5" cy="91" r="0.8" fill="#ffffff" />
          <circle cx="43.5" cy="97" r="0.8" fill="#ffffff" />
          <circle cx="43.5" cy="103" r="0.8" fill="#ffffff" />
          <circle cx="43.5" cy="109" r="0.8" fill="#ffffff" />
          <circle cx="43.5" cy="115" r="0.8" fill="#ffffff" />
        </g>

        {/* Barbell Horizontal Shaft */}
        <rect x="15" y="101" width="170" height="4.5" fill="#000000" />

        {/* Barbell Plates Left */}
        <g id="left-plates">
          {/* Outer thin plate */}
          <rect x="18" y="93" width="2.5" height="20.5" rx="0.8" fill="#000000" />
          {/* Main heavy plate */}
          <rect x="22.5" y="83" width="7" height="40.5" rx="1.5" fill="#000000" />
          {/* Inner thin plate */}
          <rect x="31.5" y="88" width="3" height="30.5" rx="1" fill="#000000" />
          {/* Collar/Sleeve */}
          <rect x="36.5" y="100.5" width="4.5" height="5.5" fill="#000000" />
        </g>

        {/* Barbell Plates Right */}
        <g id="right-plates">
          {/* Outer thin plate */}
          <rect x="179.5" y="93" width="2.5" height="20.5" rx="0.8" fill="#000000" />
          {/* Main heavy plate */}
          <rect x="170.5" y="83" width="7" height="40.5" rx="1.5" fill="#000000" />
          {/* Inner thin plate */}
          <rect x="165.5" y="88" width="3" height="30.5" rx="1" fill="#000000" />
          {/* Collar/Sleeve */}
          <rect x="159" y="100.5" width="4.5" height="5.5" fill="#000000" />
        </g>

        {/* BODYBUILDER SILHOUETTE MASK */}
        {/* This white path covers the barbell behind the bodybuilder so lines don't overlap */}
        <path
          d="M 45,134 
             C 34,124 24,120 14,124
             C 9,126 9,138 24,138
             C 38,138 52,118 64,103
             C 68,83 76,55 80,45
             C 82,37 88,25 100,25
             C 112,25 118,37 120,45
             C 124,55 132,83 136,103
             C 148,118 162,138 167,138
             C 181,138 181,126 172,124
             C 162,120 152,124 141,134
             Z"
          fill="#ffffff"
        />

        {/* Athlete Head, Face Contour & Spiky Hair */}
        <g id="athlete-head">
          {/* Spiky Hair Silhouette */}
          <path
            d="M 85,44
               C 85,39 87,33 90,27
               L 91.5,33
               L 94.5,23
               L 96.5,31
               L 100,17
               L 103.5,31
               L 105.5,23
               L 108.5,33
               L 110,27
               C 113,33 115,39 115,44
               Z"
            fill="#000000"
          />
          {/* Face Contour */}
          <path
            d="M 85,44
               C 84.5,49 85,54 86,56
               C 87,58 85,62 87,64
               C 89,67 92.5,72.5 100,74.5
               C 107.5,72.5 111,67 113,64
               C 115,62 113,58 114,56
               C 115,54 115.5,49 115,44"
            stroke="#000000"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Eyes */}
          <path d="M 91.5,51.5 Q 94,53 96,51.5" stroke="#000000" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <path d="M 104,51.5 Q 106.5,53 109,51.5" stroke="#000000" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          {/* Eyebrows */}
          <path d="M 90,48.5 Q 93.5,49.5 96.5,48" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <path d="M 103.5,48 Q 106.5,49.5 110,48.5" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          {/* Nose */}
          <path d="M 99.5,49.5 L 100.5,57.5 L 98,60.5 L 102.5,60.5" stroke="#000000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {/* Lips / Mouth */}
          <path d="M 95.5,65.5 Q 100,67.5 104.5,65.5" stroke="#000000" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <path d="M 97,68.5 Q 100,69.5 103,68.5" stroke="#000000" strokeWidth="1.2" strokeLinecap="round" fill="none" />
        </g>

        {/* Neck Chain & Traps */}
        <g id="athlete-neck">
          {/* Neck side lines */}
          <path d="M 87,58 C 84,66 76,76 72,80" stroke="#000000" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M 113,58 C 116,66 124,76 128,80" stroke="#000000" strokeWidth="3" strokeLinecap="round" fill="none" />
          {/* Thick Chain Necklace */}
          <path
            d="M 88,61 C 92,72 108,72 112,61"
            stroke="#000000"
            strokeWidth="3.2"
            strokeDasharray="1.2 3"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        {/* Left Arm (Viewer's Left - Athlete's Flexing & Extended Arm) */}
        <g id="athlete-left-arm">
          {/* Upper shoulder line to bicep */}
          <path d="M 72,80 C 58,80 46,86 36,96 C 26,106 21,115 14,121" stroke="#000000" strokeWidth="4.5" strokeLinecap="round" fill="none" />
          {/* Forearm lower line */}
          <path d="M 54,101 C 48,108 40,116 28,126" stroke="#000000" strokeWidth="3.2" strokeLinecap="round" fill="none" />
          {/* Muscle separation line */}
          <path d="M 50,89 C 43,93 42,100 43,106" stroke="#000000" strokeWidth="2" strokeLinecap="round" fill="none" />
          
          {/* Clenched Fist with detailed fingers curled */}
          <path
            d="M 14,121
               C 10,123 10,131 17,133
               C 23,135 28,131 28,126"
            stroke="#000000"
            strokeWidth="3.2"
            fill="#000000"
          />
          {/* Finger lines highlighting the fist knuckles */}
          <path d="M 15,125 C 13,127 14,130 17,130" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <path d="M 18,124 C 17,126 18,129 21,128" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <path d="M 21,122 C 20,124 21,127 24,126" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </g>

        {/* Right Arm (Viewer's Right - Athlete's Left Flexed Arm) */}
        <g id="athlete-right-arm">
          {/* Massive shoulder and outer arm curve */}
          <path d="M 128,80 C 142,80 154,90 160,103 C 164,113 162,126 154,133" stroke="#000000" strokeWidth="4.5" strokeLinecap="round" fill="none" />
          {/* Inner arm/tricep curve */}
          <path d="M 134,99 C 142,104 148,113 146,123" stroke="#000000" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        </g>

        {/* Chest & Torso */}
        <g id="athlete-torso">
          {/* Sternum / Pectoral divider */}
          <path d="M 100,74.5 L 100,113.5" stroke="#000000" strokeWidth="3" strokeLinecap="round" fill="none" />
          
          {/* Left Pectoral (Viewer's Left) */}
          <path d="M 82,83.5 C 80,96.5 94,105.5 100,105.5" stroke="#000000" strokeWidth="4.5" strokeLinecap="round" fill="none" />
          {/* Left chest striation */}
          <path d="M 87,90.5 C 91,92.5 95,92.5 97,90.5" stroke="#000000" strokeWidth="1.8" strokeLinecap="round" fill="none" />

          {/* Right Pectoral (Viewer's Right) */}
          <path d="M 118,83.5 C 120,96.5 106,105.5 100,105.5" stroke="#000000" strokeWidth="4.5" strokeLinecap="round" fill="none" />
          {/* Right chest striation */}
          <path d="M 113,90.5 C 109,92.5 105,92.5 103,90.5" stroke="#000000" strokeWidth="1.8" strokeLinecap="round" fill="none" />

          {/* Highly defined 6-Pack Abs */}
          {/* Row 1 */}
          <path d="M 88,112.5 C 94,115.5 100,115.5 100,115.5 C 100,115.5 106,115.5 112,112.5" stroke="#000000" strokeWidth="2.8" strokeLinecap="round" fill="none" />
          {/* Row 2 */}
          <path d="M 89,121.5 C 94,124.5 100,124.5 100,124.5 C 100,124.5 106,124.5 111,121.5" stroke="#000000" strokeWidth="2.8" strokeLinecap="round" fill="none" />
          {/* Row 3 */}
          <path d="M 91,130.5 C 95,133.5 100,133.5 100,133.5 C 100,133.5 105,133.5 109,130.5" stroke="#000000" strokeWidth="2" strokeLinecap="round" fill="none" />
          {/* Ab Line center divider */}
          <line x1="100" y1="112.5" x2="100" y2="133.5" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" />
        </g>

        {/* THE BLACK BANNER ("RUBIS") */}
        <g id="rubis-banner">
          {/* Banner solid body */}
          <polygon
            points="16,130 184,130 176,160 24,160"
            fill="#000000"
            stroke="#000000"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          {/* Brand fallback */}
          <text
            x="100"
            y="153"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="23.5"
            fontWeight="900"
            fontFamily="'Heebo', 'Inter', 'Arial Black', sans-serif"
            letterSpacing="4"
          >
            BALY
          </text>
        </g>

        {/* BOTTOM SECTION: KETTLEBELL & MOTION WING ACCENTS */}
        <g id="bottom-kettlebell">
          {/* Kettlebell shape */}
          <path
            d="M 93.5,170.5 
               C 93.5,164.5 106.5,164.5 106.5,170.5 
               L 104.5,173.5 
               L 95.5,173.5 Z"
            fill="#000000"
          />
          {/* Inner cutout hole of kettlebell handle */}
          <path d="M 96.5,173.5 C 96.5,169.5 103.5,169.5 103.5,173.5 Z" fill="#ffffff" />
          {/* Kettlebell heavy bell body */}
          <circle cx="100" cy="180.5" r="7.5" fill="#000000" />
        </g>

        {/* Wings / Speed lines at the bottom curve */}
        <g id="bottom-wings" stroke="#000000" fill="none" strokeLinecap="round">
          {/* Left Wing Lines */}
          <path d="M 83,175.5 C 75,174.5 67,171.5 59,167.5" strokeWidth="2.5" />
          <path d="M 81,181.5 C 74,180.5 68,178.5 62,175.5" strokeWidth="1.5" />
          <path d="M 79,186.5 C 75,185.5 71,184.5 67,182.5" strokeWidth="1" />

          {/* Right Wing Lines */}
          <path d="M 117,175.5 C 125,174.5 133,171.5 141,167.5" strokeWidth="2.5" />
          <path d="M 119,181.5 C 126,180.5 132,178.5 138,175.5" strokeWidth="1.5" />
          <path d="M 121,186.5 C 125,185.5 129,184.5 133,182.5" strokeWidth="1" />
        </g>
      </svg>
    </div>
  );
};
