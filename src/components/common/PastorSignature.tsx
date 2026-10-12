import React from 'react';

interface PastorSignatureProps {
  className?: string;
  color?: string;
  width?: number | string;
  height?: number | string;
  alt?: string;
}

/**
 * Official handwritten ecclesiastical signature of Prophet Elisha K. Richard
 * General Overseer & Senior Pastor, Greater Works City Church Worldwide
 */
export const PastorSignature: React.FC<PastorSignatureProps> = ({
  className = 'h-10 sm:h-12 w-auto object-contain',
  color = '#0f388a',
  width,
  height,
  alt = 'Prophet Elisha K. Richard Official Signature',
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1080 320"
      className={className}
      style={{
        width: width ?? undefined,
        height: height ?? undefined,
        maxHeight: '100%',
      }}
      fill="none"
      aria-label={alt}
      role="img"
    >
      <g stroke={color} strokeLinecap="round" strokeLinejoin="round">
        {/* Capital 'E' */}
        <path
          d="M 125,82 C 115,55 135,32 165,30 C 195,28 220,50 205,85 C 195,108 160,118 140,122 C 158,122 182,126 188,142 C 196,165 178,198 142,216 C 105,235 62,238 35,215 C 10,192 12,148 42,112 C 78,70 148,45 220,55"
          strokeWidth="6.5"
          fill="none"
        />

        {/* Flourish underline extending from bottom of E across entire signature */}
        <path
          d="M 108,220 C 145,236 195,248 250,250 C 330,253 430,246 540,238 C 650,230 760,220 870,210 C 930,205 990,198 1035,190"
          strokeWidth="5.8"
          fill="none"
        />
        <path d="M 270,285 C 310,282 360,278 400,272" strokeWidth="4.5" fill="none" />

        {/* 'l' in Elisha */}
        <path
          d="M 195,145 C 205,115 225,58 245,62 C 255,64 252,95 240,140 C 230,175 225,198 238,198 C 248,198 255,182 260,165"
          strokeWidth="5.5"
          fill="none"
        />

        {/* 'i' in Elisha */}
        <path
          d="M 260,165 C 265,150 270,145 275,150 C 280,158 275,185 285,195 C 292,198 298,190 302,180"
          strokeWidth="5.2"
          fill="none"
        />
        <circle cx="282" cy="126" r="4.2" fill={color} stroke="none" />

        {/* 's' in Elisha */}
        <path
          d="M 302,180 C 308,160 320,145 328,148 C 335,152 332,170 322,185 C 315,196 322,202 334,196 C 342,190 348,178 352,165"
          strokeWidth="5.2"
          fill="none"
        />

        {/* 'h' in Elisha */}
        <path
          d="M 352,165 C 362,130 380,68 395,70 C 405,72 400,105 388,155 C 382,180 380,198 385,198 C 392,198 405,168 418,168 C 428,168 424,185 428,196 C 432,200 440,195 448,182"
          strokeWidth="5.5"
          fill="none"
        />

        {/* 'a' in Elisha */}
        <path
          d="M 448,182 C 445,170 435,165 428,172 C 420,180 422,195 432,198 C 442,200 450,188 454,175 C 456,185 458,196 465,196 C 472,196 480,185 488,168"
          strokeWidth="5.2"
          fill="none"
        />

        {/* Capital 'K' */}
        <path
          d="M 545,55 C 532,110 508,210 488,310 C 484,330 480,338 476,332"
          strokeWidth="6.8"
          fill="none"
        />
        <path
          d="M 522,145 C 542,118 575,82 585,88 C 592,94 580,120 545,160 C 535,172 522,182 515,188"
          strokeWidth="6.0"
          fill="none"
        />
        <path d="M 520,182 C 538,198 565,225 585,242" strokeWidth="5.8" fill="none" />
        <circle cx="598" cy="205" r="4.6" fill={color} stroke="none" />

        {/* Capital 'R' in Richard */}
        <path
          d="M 640,185 C 655,130 682,50 705,52 C 720,54 715,90 695,150 C 678,205 668,260 662,285"
          strokeWidth="6.5"
          fill="none"
        />
        <path
          d="M 700,55 C 730,55 775,70 778,105 C 780,135 750,165 705,172 C 690,175 680,172 682,170"
          strokeWidth="6.2"
          fill="none"
        />
        <path
          d="M 700,172 C 715,185 735,215 750,238 C 758,245 765,242 770,228"
          strokeWidth="5.8"
          fill="none"
        />

        {/* 'i' in Richard */}
        <path
          d="M 770,228 C 778,205 788,188 794,195 C 798,202 792,225 802,234 C 808,236 814,228 820,215"
          strokeWidth="5.2"
          fill="none"
        />
        <circle cx="798" cy="168" r="4.2" fill={color} stroke="none" />

        {/* 'c' in Richard */}
        <path
          d="M 822,212 C 825,198 835,190 842,192 C 848,195 842,215 835,225 C 828,235 838,238 848,230 C 855,225 860,215 865,202"
          strokeWidth="5.2"
          fill="none"
        />

        {/* 'h' in Richard */}
        <path
          d="M 865,202 C 875,160 892,105 906,108 C 915,110 910,140 898,190 C 894,212 892,232 896,232 C 904,232 915,205 926,205 C 934,205 932,220 936,230 C 940,235 948,230 955,218"
          strokeWidth="5.5"
          fill="none"
        />

        {/* 'a' in Richard */}
        <path
          d="M 955,218 C 952,205 942,200 936,208 C 930,216 932,228 942,232 C 950,234 958,224 962,212 C 964,220 966,230 972,230 C 978,230 985,222 990,210"
          strokeWidth="5.2"
          fill="none"
        />

        {/* 'r' in Richard */}
        <path
          d="M 990,210 C 994,198 1002,195 1008,198 C 1012,200 1008,212 1004,224 C 1002,230 1008,234 1016,228 C 1022,222 1026,212 1030,202"
          strokeWidth="5.2"
          fill="none"
        />

        {/* 'd' in Richard */}
        <path
          d="M 1030,202 C 1026,192 1018,190 1012,198 C 1006,206 1008,218 1016,222 C 1022,224 1030,216 1034,205 L 1034,130 C 1034,115 1040,112 1045,116 C 1048,122 1045,160 1044,210 C 1044,225 1048,230 1056,226 C 1064,220 1072,205 1078,192"
          strokeWidth="5.5"
          fill="none"
        />
      </g>
    </svg>
  );
};
