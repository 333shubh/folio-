/**
 * The glass refraction filter.
 *
 * `backdrop-filter: blur()` alone gives frosted glass - even, flat, and
 * nothing like a lens. Real glass bends what is behind it by an amount
 * that varies across the surface, and splits the colours slightly at the
 * edges where it bends hardest. That is what this filter does, and it is
 * the difference between a translucent panel and something that looks like
 * an object sitting on the page.
 *
 * How it works, in order:
 *
 *  1. `feTurbulence` makes a low-frequency noise field - the "surface" of
 *     the glass, stretched four times wider than it is tall so the
 *     distortion runs along the panel rather than pooling in blobs.
 *  2. `feComponentTransfer` pushes that noise through a steep gamma, which
 *     turns a soft cloud into something with definite highs and lows.
 *  3. `feGaussianBlur` smooths it into a displacement map. A sharp map
 *     would tear the image; a blurred one bends it.
 *  4. `feDisplacementMap` bends the backdrop by that map.
 *  5. The chromatic aberration branch does the same thing three more
 *     times, once per channel, each offset by about a pixel, and screens
 *     them back together - which is why the edges fringe red and blue the
 *     way a real lens does.
 *
 * It is a filter definition only: nothing renders, and it costs nothing
 * until something references `url(#glass-distortion)`.
 */
export default function GlassFilter() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      // Zero-sized and taken out of the flow: this is a definition, not a
      // graphic, and it must not occupy a single pixel of the page.
      style={{
        position: "absolute",
        width: 0,
        height: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <defs>
        <filter
          id="glass-distortion"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          filterUnits="objectBoundingBox"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.0015 0.006"
            numOctaves={1}
            seed={24}
            result="turbulence"
          />
          <feComponentTransfer in="turbulence" result="mapped">
            <feFuncR type="gamma" amplitude={1} exponent={10} offset={0.5} />
            <feFuncG type="gamma" amplitude={0} exponent={1} offset={0} />
            <feFuncB type="gamma" amplitude={0} exponent={1} offset={0.5} />
          </feComponentTransfer>

          <feGaussianBlur in="turbulence" stdDeviation={8} result="softMap" />

          <feSpecularLighting
            in="softMap"
            surfaceScale={5}
            specularConstant={1}
            specularExponent={100}
            lightingColor="white"
            result="specLight"
          >
            <fePointLight x={-200} y={-200} z={200} />
          </feSpecularLighting>

          <feComposite
            in="specLight"
            operator="arithmetic"
            k1={0}
            k2={1}
            k3={1}
            k4={0}
            result="litImage"
          />

          <feDisplacementMap
            in="SourceGraphic"
            in2="softMap"
            scale={72}
            xChannelSelector="R"
            yChannelSelector="A"
            result="disp1"
          />

          {/* Chromatic aberration: the same bend, once per channel. */}
          <feOffset in="softMap" dx={0.35} dy={0} result="softMapCA" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="softMapCA"
            scale={72}
            xChannelSelector="R"
            yChannelSelector="A"
            result="dispCA"
          />

          <feColorMatrix
            in="dispCA"
            type="matrix"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="caRed"
          />
          <feColorMatrix
            in="dispCA"
            type="matrix"
            values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="caGreen"
          />
          <feColorMatrix
            in="dispCA"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
            result="caBlue"
          />

          <feOffset in="caRed" dx={1.1} dy={0} result="caRedOffset" />
          <feOffset in="caGreen" dx={-1} dy={0} result="caGreenOffset" />
          <feOffset in="caBlue" dx={-1.1} dy={0} result="caBlueOffset" />

          <feBlend
            in="caRedOffset"
            in2="caGreenOffset"
            mode="screen"
            result="caMix1"
          />
          <feBlend in="caMix1" in2="caBlueOffset" mode="screen" result="caFinal" />
          <feGaussianBlur in="caFinal" stdDeviation={0.25} result="caSoft" />
          <feComposite
            in="caSoft"
            in2="SourceGraphic"
            operator="in"
            result="caClipped"
          />
          <feBlend in="disp1" in2="caClipped" mode="lighten" result="finalGlass" />
        </filter>
      </defs>
    </svg>
  );
}
