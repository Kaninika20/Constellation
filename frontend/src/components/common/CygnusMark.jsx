import React from 'react';

export const CygnusMark = ({ className = '' }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M32 7L32 31L32 57M32 31L11 22M32 31L53 22"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity=".72"
    />
    <circle cx="32" cy="7" r="3" fill="currentColor" />
    <circle cx="11" cy="22" r="2.6" fill="currentColor" />
    <circle cx="53" cy="22" r="2.6" fill="currentColor" />
    <circle cx="32" cy="57" r="3" fill="currentColor" />
    <path
      d="M32 23L34.2 28.8L40 31L34.2 33.2L32 39L29.8 33.2L24 31L29.8 28.8L32 23Z"
      fill="#F6D27A"
    />
    <circle cx="32" cy="31" r="7.5" stroke="#F6D27A" strokeOpacity=".3" />
  </svg>
);
