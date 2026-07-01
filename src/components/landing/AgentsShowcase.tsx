import { motion, AnimatePresence, useInView } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  THE WORKING STUDIO                                                  */
/*  Robot AI agents + human stakeholders + chat bubbles +               */
/*  cumulative spotlight + Challenger loop + backward feedback.         */
/* ------------------------------------------------------------------ */

type PropKind =
  | "magnifier"
  | "checklist"
  | "compass"
  | "blueprint"
  | "scales"
  | "gavel"
  | "puzzle"
  | "database"
  | "plug"
  | "shield"
  | "telescope"
  | "lifebuoy"
  | "server"
  | "chart"
  | "warning"
  | "verify"
  | "document"
  | "wrench";

type Mode = "ai" | "human" | "hybrid";

interface Agent {
  name: string;
  role: string;
  prop: PropKind;
  mode: Mode;
  artifact: string;
  /** Marks the Evaluator/Challenger for the dramatic loop */
  challenger?: boolean;
}

interface PhaseDef {
  key: string;
  label: string;
  hue: number;
  agents: Agent[];
  /** Big artifact that flies into the next phase */
  handoff: { label: string; icon: string };
  /** Conversational snippets shown on intra-phase data packets */
  chatter: string[];
}

/* ------------------------------------------------------------------ */
/*  PHASE / AGENT DATA                                                 */
/* ------------------------------------------------------------------ */

const PHASES: PhaseDef[] = [
  {
    key: "requirements",
    label: "Requirements",
    hue: 217,
    handoff: { label: "Requirements Pack", icon: "📋" },
    chatter: ["Login takes 8s", "Need GDPR consent", "Who owns this flow?", "Conflict on SLA"],
    agents: [
      {
        name: "Req. Analyst",
        role: "Captures needs",
        prop: "magnifier",
        mode: "ai",
        artifact: "REQ-014",
      },
      {
        name: "Stakeholder",
        role: "Voices the need",
        prop: "checklist",
        mode: "human",
        artifact: "INPUT",
      },
      {
        name: "Driver Extractor",
        role: "Ranks drivers",
        prop: "compass",
        mode: "ai",
        artifact: "DRV-01",
      },
    ],
  },
  {
    key: "design",
    label: "Design",
    hue: 262,
    handoff: { label: "Architecture Decision", icon: "🏛️" },
    chatter: [
      "Try modular monolith?",
      "Cache the read path",
      "Postgres or Mongo?",
      "Reject — couples too tight",
    ],
    agents: [
      {
        name: "Style Recommender",
        role: "Picks the style",
        prop: "blueprint",
        mode: "ai",
        artifact: "STYLE",
      },
      {
        name: "Synthetic Architect",
        role: "Weighs trade-offs",
        prop: "scales",
        mode: "ai",
        artifact: "ADR-07",
      },
      {
        name: "Evaluator Architect",
        role: "Challenges choices",
        prop: "gavel",
        mode: "hybrid",
        artifact: "REVIEW",
        challenger: true,
      },
      {
        name: "Decomposer",
        role: "Splits the system",
        prop: "puzzle",
        mode: "ai",
        artifact: "MOD-06",
      },
      {
        name: "Data Architect",
        role: "Models the data",
        prop: "database",
        mode: "ai",
        artifact: "ER-12",
      },
      {
        name: "API Designer",
        role: "Defines contracts",
        prop: "plug",
        mode: "ai",
        artifact: "API-08",
      },
    ],
  },
  {
    key: "validation",
    label: "Validation",
    hue: 38,
    handoff: { label: "Validation Report", icon: "✅" },
    chatter: [
      "What if DB fails?",
      "Add circuit breaker",
      "p99 latency too high",
      "Score: 8.5 / 10",
    ],
    agents: [
      {
        name: "Security Architect",
        role: "Hardens the system",
        prop: "shield",
        mode: "ai",
        artifact: "SEC",
      },
      {
        name: "Observability Eng.",
        role: "Sees the unseen",
        prop: "telescope",
        mode: "ai",
        artifact: "TRACE",
      },
      {
        name: "Resilience Eng.",
        role: "Plans for failure",
        prop: "lifebuoy",
        mode: "ai",
        artifact: "FAIL",
      },
      {
        name: "Infra Planner",
        role: "Designs the topology",
        prop: "server",
        mode: "ai",
        artifact: "TOPO",
      },
      {
        name: "Quality Assessor",
        role: "Scores quality",
        prop: "chart",
        mode: "ai",
        artifact: "8.5/10",
      },
      {
        name: "Risk Analyst",
        role: "Spots the dangers",
        prop: "warning",
        mode: "ai",
        artifact: "RSK-03",
      },
    ],
  },
  {
    key: "delivery",
    label: "Delivery",
    hue: 160,
    handoff: { label: "Delivery Bundle", icon: "🚀" },
    chatter: ["All 47 reqs traced", "Approved ✓", "Ship it", "Doc generated"],
    agents: [
      {
        name: "Approver",
        role: "Signs off the design",
        prop: "verify",
        mode: "human",
        artifact: "SIGN",
      },
      {
        name: "Doc Generator",
        role: "Writes the record",
        prop: "document",
        mode: "ai",
        artifact: "DOC-01",
      },
      {
        name: "Code Scaffolder",
        role: "Lays the foundation",
        prop: "wrench",
        mode: "ai",
        artifact: "BUILD",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  HUMAN VARIATION — deterministic per-agent diversity                */
/* ------------------------------------------------------------------ */

type HairStyle = "short" | "long" | "curly" | "bun" | "bald" | "buzz";

interface PersonStyle {
  hair: HairStyle;
  skin: { light: string; shade: string };
  hairColor: string;
  glasses: boolean;
  beard: boolean;
}

const SKIN_TONES = [
  { light: "hsl(28, 50%, 82%)", shade: "hsl(28, 50%, 70%)" }, // light
  { light: "hsl(28, 45%, 68%)", shade: "hsl(28, 45%, 56%)" }, // medium
  { light: "hsl(24, 40%, 50%)", shade: "hsl(24, 40%, 38%)" }, // tan
  { light: "hsl(22, 35%, 32%)", shade: "hsl(22, 35%, 22%)" }, // deep
];

const HAIR_COLORS = [
  "hsl(28, 60%, 20%)", // dark brown
  "hsl(35, 70%, 35%)", // chestnut
  "hsl(220, 12%, 14%)", // black
  "hsl(40, 55%, 55%)", // blond
  "hsl(220, 8%, 60%)", // gray
];

const HAIR_STYLES: HairStyle[] = ["short", "long", "curly", "bun", "bald", "buzz"];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function personStyleFor(agent: Agent): PersonStyle {
  const h = hashStr(agent.name);
  const hair = HAIR_STYLES[h % HAIR_STYLES.length];
  const skin = SKIN_TONES[(h >>> 3) % SKIN_TONES.length];
  const hairColor = HAIR_COLORS[(h >>> 6) % HAIR_COLORS.length];
  // Specific role tells: challenger + security + analyst types wear glasses
  const roleGlasses =
    agent.challenger ||
    agent.prop === "shield" ||
    agent.prop === "magnifier" ||
    agent.prop === "scales" ||
    agent.prop === "verify";
  const glasses = roleGlasses || (h >>> 9) % 3 === 0;
  const beard = hair !== "long" && hair !== "bun" && (h >>> 12) % 4 === 0;
  return { hair, skin, hairColor, glasses, beard };
}

/* ------------------------------------------------------------------ */
/*  HAIR PATHS                                                          */
/* ------------------------------------------------------------------ */

function HairPath({ style, color }: { style: HairStyle; color: string }) {
  switch (style) {
    case "short":
      return (
        <path
          d="M21 18 Q22 8 30 8 Q38 8 39 18 Q39 14 36 12 Q33 11 30 11 Q26 11 23 13 Q21 15 21 18 Z"
          fill={color}
        />
      );
    case "long":
      return (
        <g>
          <path
            d="M20 18 Q21 7 30 7 Q39 7 40 18 L40 26 Q38 24 36 24 L24 24 Q22 24 20 26 Z"
            fill={color}
          />
          <path d="M20 24 Q19 32 21 38 L23 30 Z" fill={color} opacity="0.85" />
          <path d="M40 24 Q41 32 39 38 L37 30 Z" fill={color} opacity="0.85" />
        </g>
      );
    case "curly":
      return (
        <g fill={color}>
          <ellipse cx="30" cy="11" rx="10" ry="5" />
          <circle cx="22" cy="14" r="3" />
          <circle cx="38" cy="14" r="3" />
          <circle cx="26" cy="9" r="2.5" />
          <circle cx="34" cy="9" r="2.5" />
          <circle cx="30" cy="8" r="3" />
        </g>
      );
    case "bun":
      return (
        <g fill={color}>
          <path d="M21 18 Q22 9 30 9 Q38 9 39 18 Q39 14 36 12 Q33 11 30 11 Q26 11 23 13 Q21 15 21 18 Z" />
          <circle cx="30" cy="6" r="3.2" />
        </g>
      );
    case "bald":
      // very subtle hairline / dome shading
      return (
        <path
          d="M21 17 Q23 14 30 14 Q37 14 39 17"
          stroke={color}
          strokeWidth="0.6"
          fill="none"
          opacity="0.4"
        />
      );
    case "buzz":
      return <path d="M21 17 Q22 11 30 11 Q38 11 39 17 Z" fill={color} opacity="0.85" />;
  }
}

/* ------------------------------------------------------------------ */
/*  HUMAN FIGURE                                                        */
/* ------------------------------------------------------------------ */

function HumanFigure({
  hue,
  active,
  prop,
  mode,
  style,
  challenger,
}: {
  hue: number;
  active: boolean;
  prop: PropKind;
  mode: Mode;
  style: PersonStyle;
  challenger?: boolean;
}) {
  const skin = style.skin.light;
  const skinShade = style.skin.shade;
  // Challenger gets a red-tinted shirt; everyone else uses phase hue
  const shirtHue = challenger ? 0 : hue;
  const shirt = `hsl(${shirtHue}, ${challenger ? 75 : 70}%, ${active ? 55 : 38}%)`;
  const shirtShade = `hsl(${shirtHue}, 70%, ${active ? 42 : 28}%)`;
  const trousers = "hsl(220, 18%, 22%)";
  const accent = `hsl(${hue}, 90%, 70%)`;

  return (
    <svg
      viewBox="0 0 60 96"
      className="w-12 h-[76px] sm:w-14 sm:h-[88px]"
      style={{
        filter: active
          ? `drop-shadow(0 0 8px hsl(${challenger ? 0 : hue} 90% 60% / 0.55))`
          : "none",
      }}
    >
      {/* Soft floor shadow */}
      <ellipse
        cx="30"
        cy="92"
        rx="14"
        ry="2.2"
        fill="hsl(220 30% 5%)"
        opacity={active ? 0.5 : 0.25}
      />

      {/* Legs */}
      <path d="M22 60 L21 86 L26 86 L28 60 Z" fill={trousers} />
      <path d="M38 60 L39 86 L34 86 L32 60 Z" fill={trousers} />
      <ellipse cx="23.5" cy="87" rx="3.5" ry="1.5" fill="hsl(220 18% 12%)" />
      <ellipse cx="36.5" cy="87" rx="3.5" ry="1.5" fill="hsl(220 18% 12%)" />

      {/* Torso */}
      <path
        d="M16 38 Q16 32 24 30 L36 30 Q44 32 44 38 L44 60 Q44 62 42 62 L18 62 Q16 62 16 60 Z"
        fill={shirt}
      />
      <path d="M30 30 L30 62" stroke={shirtShade} strokeWidth="0.6" opacity="0.6" />
      <path d="M24 30 L30 38 L36 30 Z" fill="hsl(220 25% 96%)" opacity="0.92" />
      {/* Lanyard */}
      <line x1="30" y1="38" x2="30" y2="44" stroke={accent} strokeWidth="0.8" opacity="0.7" />
      <rect x="28" y="44" width="4" height="2.5" rx="0.6" fill={accent} opacity="0.8" />

      {/* Arms */}
      <path
        d="M16 38 Q11 48 12 58"
        stroke={shirt}
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M44 38 Q49 48 48 58"
        stroke={shirt}
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="12" cy="58" r="2.4" fill={skin} />
      <circle cx="48" cy="58" r="2.4" fill={skin} />

      {/* Neck */}
      <rect x="26" y="26" width="8" height="6" rx="1.5" fill={skinShade} />

      {/* Head */}
      <ellipse cx="30" cy="20" rx="9" ry="10" fill={skin} />

      {/* Hair */}
      <HairPath style={style.hair} color={style.hairColor} />

      {/* Beard */}
      {style.beard && (
        <path
          d="M22 24 Q22 30 30 31 Q38 30 38 24 Q36 27 30 27 Q24 27 22 24 Z"
          fill={style.hairColor}
          opacity="0.85"
        />
      )}

      {/* Eyes */}
      <circle cx="27" cy="21" r="0.8" fill="hsl(220 25% 14%)" />
      <circle cx="33" cy="21" r="0.8" fill="hsl(220 25% 14%)" />

      {/* Eyebrows — slight downward tilt for challenger (skeptical) */}
      {challenger ? (
        <>
          <line
            x1="25"
            y1="18.5"
            x2="28.5"
            y2="19.4"
            stroke={style.hairColor}
            strokeWidth="0.9"
            strokeLinecap="round"
          />
          <line
            x1="35"
            y1="18.5"
            x2="31.5"
            y2="19.4"
            stroke={style.hairColor}
            strokeWidth="0.9"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <line
            x1="25"
            y1="18.8"
            x2="28.5"
            y2="18.6"
            stroke={style.hairColor}
            strokeWidth="0.7"
            strokeLinecap="round"
            opacity="0.85"
          />
          <line
            x1="35"
            y1="18.8"
            x2="31.5"
            y2="18.6"
            stroke={style.hairColor}
            strokeWidth="0.7"
            strokeLinecap="round"
            opacity="0.85"
          />
        </>
      )}

      {/* Mouth — skeptical frown for challenger, soft smile for others */}
      {challenger ? (
        <path
          d="M27.5 25.5 Q30 24.5 32.5 25.5"
          stroke="hsl(220 25% 18%)"
          strokeWidth="0.6"
          fill="none"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M28 25 Q30 26 32 25"
          stroke="hsl(220 25% 18%)"
          strokeWidth="0.6"
          fill="none"
          strokeLinecap="round"
        />
      )}

      {/* Glasses */}
      {style.glasses && (
        <g stroke="hsl(220 20% 10%)" strokeWidth="0.7" fill="none">
          <circle cx="27" cy="21" r="2.2" />
          <circle cx="33" cy="21" r="2.2" />
          <line x1="29.2" y1="21" x2="30.8" y2="21" />
          <line x1="24.8" y1="20.5" x2="23.5" y2="20" />
          <line x1="35.2" y1="20.5" x2="36.5" y2="20" />
        </g>
      )}

      {/* Mode dot */}
      <circle
        cx="36"
        cy="36"
        r="1.5"
        fill={
          mode === "ai"
            ? "hsl(262 80% 65%)"
            : mode === "human"
              ? "hsl(217 90% 65%)"
              : "hsl(38 95% 60%)"
        }
      />

      {/* Held prop */}
      <g transform="translate(8, 50)">
        <PropGlyph kind={prop} hue={hue} active={active} />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  ROBOT FIGURE — for AI agents                                       */
/* ------------------------------------------------------------------ */

function RobotFigure({
  hue,
  active,
  prop,
  challenger,
}: {
  hue: number;
  active: boolean;
  prop: PropKind;
  challenger?: boolean;
}) {
  const bodyHue = challenger ? 0 : hue;
  const chassis = `hsl(${bodyHue}, ${active ? 30 : 20}%, ${active ? 88 : 72}%)`;
  const chassisShade = `hsl(${bodyHue}, ${active ? 25 : 18}%, ${active ? 70 : 55}%)`;
  const panel = `hsl(${bodyHue}, 35%, ${active ? 25 : 18}%)`;
  const eyeGlow = `hsl(${bodyHue}, 95%, ${active ? 70 : 55}%)`;
  const accent = `hsl(${hue}, 90%, 70%)`;

  return (
    <svg
      viewBox="0 0 60 96"
      className="w-12 h-[76px] sm:w-14 sm:h-[88px]"
      style={{
        filter: active ? `drop-shadow(0 0 8px hsl(${bodyHue} 90% 60% / 0.55))` : "none",
      }}
    >
      <ellipse
        cx="30"
        cy="92"
        rx="14"
        ry="2.2"
        fill="hsl(220 30% 5%)"
        opacity={active ? 0.5 : 0.25}
      />
      {/* Wheeled base */}
      <rect x="18" y="78" width="24" height="6" rx="2" fill={chassisShade} />
      <circle cx="22" cy="86" r="3" fill="hsl(220 25% 14%)" />
      <circle cx="38" cy="86" r="3" fill="hsl(220 25% 14%)" />
      <circle cx="22" cy="86" r="1.2" fill={accent} opacity="0.8" />
      <circle cx="38" cy="86" r="1.2" fill={accent} opacity="0.8" />
      {/* Torso chassis */}
      <rect x="16" y="38" width="28" height="42" rx="6" fill={chassis} />
      <rect
        x="16"
        y="38"
        width="28"
        height="42"
        rx="6"
        fill="none"
        stroke={chassisShade}
        strokeWidth="0.6"
      />
      <rect x="22" y="46" width="16" height="10" rx="1.5" fill={panel} />
      <circle cx="26" cy="51" r="1" fill={accent} />
      <circle cx="30" cy="51" r="1" fill={eyeGlow} opacity="0.85" />
      <circle cx="34" cy="51" r="1" fill="hsl(142 80% 60%)" opacity="0.85" />
      <circle cx="19" cy="42" r="0.6" fill={chassisShade} />
      <circle cx="41" cy="42" r="0.6" fill={chassisShade} />
      <circle cx="19" cy="76" r="0.6" fill={chassisShade} />
      <circle cx="41" cy="76" r="0.6" fill={chassisShade} />
      {/* Arms */}
      <line
        x1="16"
        y1="42"
        x2="11"
        y2="58"
        stroke={chassisShade}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="44"
        y1="42"
        x2="49"
        y2="58"
        stroke={chassisShade}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="16" cy="42" r="2" fill={chassisShade} />
      <circle cx="44" cy="42" r="2" fill={chassisShade} />
      <rect
        x="9"
        y="56"
        width="4"
        height="4"
        rx="0.8"
        fill={chassis}
        stroke={chassisShade}
        strokeWidth="0.5"
      />
      <rect
        x="47"
        y="56"
        width="4"
        height="4"
        rx="0.8"
        fill={chassis}
        stroke={chassisShade}
        strokeWidth="0.5"
      />
      {/* Neck */}
      <rect x="28" y="32" width="4" height="6" fill={chassisShade} />
      <circle cx="30" cy="32" r="1.2" fill={panel} />
      {/* Head */}
      <rect x="20" y="14" width="20" height="20" rx="5" fill={chassis} />
      <rect
        x="20"
        y="14"
        width="20"
        height="20"
        rx="5"
        fill="none"
        stroke={chassisShade}
        strokeWidth="0.6"
      />
      {/* Antenna */}
      <line x1="30" y1="14" x2="30" y2="9" stroke={chassisShade} strokeWidth="0.8" />
      <circle cx="30" cy="8" r="1.4" fill={eyeGlow}>
        {active && (
          <animate attributeName="opacity" values="0.4;1;0.4" dur="1.6s" repeatCount="indefinite" />
        )}
      </circle>
      {/* Visor */}
      <rect x="22" y="20" width="16" height="6" rx="1.5" fill="hsl(220 30% 10%)" />
      {challenger ? (
        <>
          <path d="M25 23.5 L28 22.5" stroke={eyeGlow} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M35 23.5 L32 22.5" stroke={eyeGlow} strokeWidth="1.2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="26" cy="23" r="1.2" fill={eyeGlow}>
            {active && (
              <animate
                attributeName="opacity"
                values="1;0.3;1"
                dur="3.2s"
                repeatCount="indefinite"
              />
            )}
          </circle>
          <circle cx="34" cy="23" r="1.2" fill={eyeGlow}>
            {active && (
              <animate
                attributeName="opacity"
                values="1;0.3;1"
                dur="3.2s"
                repeatCount="indefinite"
                begin="0.15s"
              />
            )}
          </circle>
        </>
      )}
      <line x1="27" y1="29" x2="33" y2="29" stroke={chassisShade} strokeWidth="0.4" />
      <line x1="27" y1="30.5" x2="33" y2="30.5" stroke={chassisShade} strokeWidth="0.4" />
      <circle cx="20" cy="24" r="1.2" fill={chassisShade} />
      <circle cx="40" cy="24" r="1.2" fill={chassisShade} />
      {/* Held prop */}
      <g transform="translate(8, 50)">
        <PropGlyph kind={prop} hue={hue} active={active} />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  AGENT FIGURE — picks robot vs human based on mode                   */
/* ------------------------------------------------------------------ */

function AgentFigure({
  agent,
  hue,
  active,
  pStyle,
}: {
  agent: Agent;
  hue: number;
  active: boolean;
  pStyle: PersonStyle;
}) {
  if (agent.mode === "ai") {
    return (
      <RobotFigure hue={hue} active={active} prop={agent.prop} challenger={agent.challenger} />
    );
  }
  return (
    <HumanFigure
      hue={hue}
      active={active}
      prop={agent.prop}
      mode={agent.mode}
      style={pStyle}
      challenger={agent.challenger}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  PROP GLYPHS                                                         */
/* ------------------------------------------------------------------ */

function PropGlyph({ kind, hue, active }: { kind: PropKind; hue: number; active: boolean }) {
  const stroke = `hsl(${hue}, ${active ? 90 : 60}%, ${active ? 75 : 55}%)`;
  const fill = `hsl(${hue}, ${active ? 80 : 50}%, ${active ? 35 : 22}%)`;
  const sw = 0.9;

  switch (kind) {
    case "magnifier":
      return (
        <g>
          <circle cx="3" cy="3" r="3" fill={fill} stroke={stroke} strokeWidth={sw} />
          <line
            x1="5"
            y1="5"
            x2="8"
            y2="8"
            stroke={stroke}
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </g>
      );
    case "checklist":
      return (
        <g>
          <rect
            x="0"
            y="0"
            width="7"
            height="9"
            rx="0.8"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
          />
          <line
            x1="2"
            y1="3"
            x2="5"
            y2="3"
            stroke={stroke}
            strokeWidth="0.8"
            strokeLinecap="round"
          />
          <line
            x1="2"
            y1="5"
            x2="5"
            y2="5"
            stroke={stroke}
            strokeWidth="0.8"
            strokeLinecap="round"
          />
          <line
            x1="2"
            y1="7"
            x2="4"
            y2="7"
            stroke={stroke}
            strokeWidth="0.8"
            strokeLinecap="round"
          />
        </g>
      );
    case "compass":
      return (
        <g>
          <circle cx="4" cy="4" r="4" fill={fill} stroke={stroke} strokeWidth={sw} />
          <path d="M4 1.5 L5 4 L4 6.5 L3 4 Z" fill={stroke} />
        </g>
      );
    case "blueprint":
      return (
        <g>
          <rect
            x="0"
            y="0"
            width="9"
            height="7"
            rx="0.6"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
          />
          <rect
            x="1.5"
            y="1.5"
            width="2.5"
            height="2"
            fill="none"
            stroke={stroke}
            strokeWidth="0.5"
          />
          <rect
            x="5"
            y="1.5"
            width="2.5"
            height="4"
            fill="none"
            stroke={stroke}
            strokeWidth="0.5"
          />
          <rect
            x="1.5"
            y="4.5"
            width="2.5"
            height="1"
            fill="none"
            stroke={stroke}
            strokeWidth="0.5"
          />
        </g>
      );
    case "scales":
      return (
        <g>
          <line x1="4" y1="0" x2="4" y2="8" stroke={stroke} strokeWidth="1" strokeLinecap="round" />
          <line
            x1="0"
            y1="2"
            x2="8"
            y2="2"
            stroke={stroke}
            strokeWidth="0.8"
            strokeLinecap="round"
          />
          <path d="M0 2 L-1 5 L1 5 Z" fill={fill} stroke={stroke} strokeWidth="0.6" />
          <path d="M8 2 L7 5 L9 5 Z" fill={fill} stroke={stroke} strokeWidth="0.6" />
        </g>
      );
    case "gavel":
      return (
        <g>
          <rect
            x="0"
            y="0"
            width="6"
            height="3"
            rx="0.6"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            transform="rotate(-30 3 1.5)"
          />
          <line
            x1="4"
            y1="3"
            x2="8"
            y2="7"
            stroke={stroke}
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </g>
      );
    case "puzzle":
      return (
        <g>
          <rect
            x="0"
            y="0"
            width="4"
            height="4"
            rx="0.4"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
          />
          <rect
            x="4.5"
            y="0"
            width="4"
            height="4"
            rx="0.4"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            opacity="0.85"
          />
          <rect
            x="0"
            y="4.5"
            width="4"
            height="4"
            rx="0.4"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            opacity="0.7"
          />
          <rect
            x="4.5"
            y="4.5"
            width="4"
            height="4"
            rx="0.4"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            opacity="0.55"
          />
        </g>
      );
    case "database":
      return (
        <g>
          <ellipse cx="4" cy="1" rx="4" ry="1.2" fill={fill} stroke={stroke} strokeWidth={sw} />
          <path
            d="M0 1 L0 6 Q0 7.2 4 7.2 Q8 7.2 8 6 L8 1"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
          />
          <ellipse cx="4" cy="3.5" rx="4" ry="1.2" fill="none" stroke={stroke} strokeWidth="0.5" />
        </g>
      );
    case "plug":
      return (
        <g>
          <circle cx="2" cy="4" r="2" fill={fill} stroke={stroke} strokeWidth={sw} />
          <line x1="4" y1="4" x2="8" y2="4" stroke={stroke} strokeWidth="1" strokeLinecap="round" />
          <circle cx="2" cy="2.5" r="0.4" fill={stroke} />
          <circle cx="2" cy="5.5" r="0.4" fill={stroke} />
        </g>
      );
    case "shield":
      return (
        <g>
          <path
            d="M4 0 L8 1.5 L8 4.5 Q8 7.5 4 9 Q0 7.5 0 4.5 L0 1.5 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
          />
          <path
            d="M2.5 4.5 L3.7 5.7 L5.8 3.2"
            stroke={stroke}
            strokeWidth="0.9"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      );
    case "telescope":
      return (
        <g>
          <rect
            x="0"
            y="3"
            width="8"
            height="2"
            rx="0.6"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            transform="rotate(-25 4 4)"
          />
          <circle cx="0.5" cy="6" r="0.8" fill="none" stroke={stroke} strokeWidth="0.6" />
        </g>
      );
    case "lifebuoy":
      return (
        <g>
          <circle cx="4" cy="4" r="4" fill={fill} stroke={stroke} strokeWidth={sw} />
          <circle cx="4" cy="4" r="1.5" fill="hsl(220 25% 12%)" />
          <line x1="4" y1="0" x2="4" y2="8" stroke={stroke} strokeWidth="0.8" />
          <line x1="0" y1="4" x2="8" y2="4" stroke={stroke} strokeWidth="0.8" />
        </g>
      );
    case "server":
      return (
        <g>
          <rect
            x="0"
            y="0"
            width="8"
            height="3"
            rx="0.5"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
          />
          <rect
            x="0"
            y="3.5"
            width="8"
            height="3"
            rx="0.5"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
          />
          <circle cx="6.5" cy="1.5" r="0.4" fill={stroke} />
          <circle cx="6.5" cy="5" r="0.4" fill={stroke} />
        </g>
      );
    case "chart":
      return (
        <g>
          <line x1="0" y1="8" x2="8" y2="8" stroke={stroke} strokeWidth="0.8" />
          <rect x="1" y="5" width="1.4" height="3" fill={fill} stroke={stroke} strokeWidth="0.5" />
          <rect
            x="3.2"
            y="3"
            width="1.4"
            height="5"
            fill={fill}
            stroke={stroke}
            strokeWidth="0.5"
          />
          <rect
            x="5.4"
            y="1"
            width="1.4"
            height="7"
            fill={fill}
            stroke={stroke}
            strokeWidth="0.5"
          />
        </g>
      );
    case "warning":
      return (
        <g>
          <path d="M4 0 L8 7 L0 7 Z" fill={fill} stroke={stroke} strokeWidth={sw} />
          <line
            x1="4"
            y1="2.5"
            x2="4"
            y2="5"
            stroke={stroke}
            strokeWidth="0.9"
            strokeLinecap="round"
          />
          <circle cx="4" cy="6" r="0.5" fill={stroke} />
        </g>
      );
    case "verify":
      return (
        <g>
          <circle cx="4" cy="4" r="4" fill={fill} stroke={stroke} strokeWidth={sw} />
          <path
            d="M2 4.2 L3.6 5.8 L6.2 2.6"
            stroke={stroke}
            strokeWidth="1"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      );
    case "document":
      return (
        <g>
          <path d="M0 0 L6 0 L8 2 L8 9 L0 9 Z" fill={fill} stroke={stroke} strokeWidth={sw} />
          <line x1="2" y1="3" x2="6" y2="3" stroke={stroke} strokeWidth="0.6" />
          <line x1="2" y1="5" x2="6" y2="5" stroke={stroke} strokeWidth="0.6" />
          <line x1="2" y1="7" x2="5" y2="7" stroke={stroke} strokeWidth="0.6" />
        </g>
      );
    case "wrench":
      return (
        <g>
          <path
            d="M1 1 Q3 -0.5 5 1.5 L8 4.5 L6.5 6 L3.5 3 Q1.5 1 1 1 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
          />
        </g>
      );
  }
}

/* ------------------------------------------------------------------ */
/*  ARTIFACT TOKEN                                                      */
/* ------------------------------------------------------------------ */

function ArtifactToken({
  label,
  hue,
  variant = "default",
}: {
  label: string;
  hue: number;
  variant?: "default" | "rejected" | "accepted";
}) {
  const ringHue = variant === "rejected" ? 0 : variant === "accepted" ? 142 : hue;
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full px-2 py-[3px] font-mono text-[8px] font-bold tracking-wide whitespace-nowrap"
      style={{
        backgroundColor: `hsl(${ringHue} 80% 18% / 0.95)`,
        color: `hsl(${ringHue} 90% 80%)`,
        border: `1px solid hsl(${ringHue} 80% 50% / 0.7)`,
        boxShadow: `0 0 12px hsl(${ringHue} 90% 55% / 0.55)`,
      }}
    >
      <span
        className="inline-block h-1 w-1 rounded-full"
        style={{ backgroundColor: `hsl(${ringHue} 95% 70%)` }}
      />
      {label}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AGENT CELL                                                          */
/* ------------------------------------------------------------------ */

function AgentCell({
  agent,
  hue,
  active,
  delay,
  pStyle,
  packetIncoming,
  col,
  row,
  cols,
  rows,
}: {
  agent: Agent;
  hue: number;
  active: boolean;
  delay: number;
  pStyle: PersonStyle;
  packetIncoming: boolean;
  col: number;
  row: number;
  cols: number;
  rows: number;
}) {
  const cellRef = useRef<HTMLDivElement | null>(null);
  const figureRef = useRef<HTMLDivElement | null>(null);
  // Runtime overlap-aware amplitude scale (1 = full drift, 0 = frozen)
  const [ampScale, setAmpScale] = useState(1);
  // Entrance: agents start scattered OUTSIDE the box, then walk into their cell.
  // Triggered when the cell scrolls into view (not on mount), so the user actually sees the walk.
  const inView = useInView(cellRef, { once: true, margin: "-10% 0px -10% 0px" });
  const [arrived, setArrived] = useState(false);
  const entrance = useMemo(() => {
    const h = hashStr(agent.name + ":entrance");
    // Pick a side to come in from, biased by cell position so motion looks natural
    const sideRoll = h % 4;
    // 0=left, 1=right, 2=top, 3=bottom
    const side = col === 0 ? 0 : col === cols - 1 ? 1 : sideRoll;
    const jitterX = ((h >>> 5) % 80) - 40;
    const jitterY = ((h >>> 11) % 80) - 40;
    let x = 0,
      y = 0;
    if (side === 0) {
      x = -260 - ((h >>> 3) % 120);
      y = jitterY;
    } else if (side === 1) {
      x = 260 + ((h >>> 3) % 120);
      y = jitterY;
    } else if (side === 2) {
      x = jitterX;
      y = -180 - ((h >>> 7) % 100);
    } else {
      x = jitterX;
      y = 180 + ((h >>> 7) % 100);
    }
    const walkDuration = 1.6 + ((h >>> 17) % 100) / 80; // 1.6s – 2.85s
    const walkDelay = delay + 0.15 + ((h >>> 19) % 100) / 120; // staggered
    return { x, y, walkDuration, walkDelay };
  }, [agent.name, col, cols, delay]);

  useEffect(() => {
    if (!inView) return;
    const t = window.setTimeout(
      () => setArrived(true),
      (entrance.walkDelay + entrance.walkDuration) * 1000,
    );
    return () => window.clearTimeout(t);
  }, [inView, entrance.walkDelay, entrance.walkDuration]);

  useEffect(() => {
    const measure = () => {
      const figure = figureRef.current;
      const cell = cellRef.current;
      if (!figure || !cell) return;
      const grid = cell.parentElement;
      if (!grid) return;

      const fRect = figure.getBoundingClientRect();
      if (fRect.width === 0 || fRect.height === 0) return;

      // Only inspect the 4 orthogonally adjacent cells (left/right/up/down) — O(4) per cell.
      const neighborCoords: Array<[number, number]> = [
        [col - 1, row],
        [col + 1, row],
        [col, row - 1],
        [col, row + 1],
      ].filter(([c, r]) => c >= 0 && c < cols && r >= 0 && r < rows) as Array<[number, number]>;

      const SAFETY = 2; // px buffer used when scaling drift
      const FREEZE_THRESHOLD = 4; // px — below this clearance, fully freeze
      let minScale = 1;
      let freeze = false;

      for (const [c, r] of neighborCoords) {
        const sib = grid.querySelector<HTMLElement>(
          `[data-agent-figure="true"][data-col="${c}"][data-row="${r}"]`,
        );
        if (!sib) continue;
        const sRect = sib.getBoundingClientRect();
        const dx = Math.max(0, Math.max(sRect.left - fRect.right, fRect.left - sRect.right));
        const dy = Math.max(0, Math.max(sRect.top - fRect.bottom, fRect.top - sRect.bottom));

        // Hard freeze: any neighbor already within the safety threshold (overlap / near-touch)
        if (dx < FREEZE_THRESHOLD && dy < FREEZE_THRESHOLD) {
          freeze = true;
          break;
        }

        const intendedX = Number(figure.dataset.ampx || 0);
        const intendedY = Number(figure.dataset.ampy || 0);
        // Horizontal neighbor → constrain X drift; Vertical neighbor → constrain Y drift.
        if (r === row && intendedX > 0) {
          const allowedX = Math.max(0, dx / 2 - SAFETY);
          minScale = Math.min(minScale, allowedX / intendedX);
        }
        if (c === col && intendedY > 0) {
          const allowedY = Math.max(0, dy / 2 - SAFETY);
          minScale = Math.min(minScale, allowedY / intendedY);
        }
      }

      setAmpScale(freeze ? 0 : Math.max(0, Math.min(1, minScale)));
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (cellRef.current?.parentElement) ro.observe(cellRef.current.parentElement);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [cols, rows, col, row]);

  return (
    <motion.div ref={cellRef} className="relative flex flex-col items-center text-center group">
      {/* Challenger badge */}
      {agent.challenger && active && (
        <motion.div
          className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 px-1.5 py-0.5 rounded-sm text-[7px] font-mono font-bold tracking-wider"
          style={{
            backgroundColor: "hsl(0 75% 45%)",
            color: "hsl(0 0% 100%)",
            boxShadow: "0 0 8px hsl(0 90% 55% / 0.7)",
          }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        >
          CHALLENGER
        </motion.div>
      )}

      <div className="relative">
        {(() => {
          // Deterministic per-agent drift, collision-aware (see bounds below)
          const h = hashStr(agent.name);

          // Collision-aware bounds: cap to half the grid gap (gap-x-2=8px, gap-y-3=12px)
          // so neighboring cells can never overlap, and bias direction inward at edges.
          const HALF_GAP_X = 3; // < gap-x-2/2 to leave breathing room
          const HALF_GAP_Y = 5; // < gap-y-3/2
          const baseAmpX = 6 + (h % 5);
          const baseAmpY = 5 + ((h >>> 3) % 4);
          const ampX = Math.min(baseAmpX, HALF_GAP_X) * ampScale;
          const ampY = Math.min(baseAmpY, HALF_GAP_Y) * ampScale;
          // Edge bias: leftmost col only drifts right, rightmost only drifts left
          const atLeft = col === 0;
          const atRight = col === cols - 1;
          const xDirRaw = (h >>> 6) % 2 === 0 ? 1 : -1;
          const sgnX = atLeft ? 1 : atRight ? -1 : xDirRaw;
          const atTop = row === 0;
          const atBottom = row === rows - 1;
          const yDirRaw = (h >>> 9) % 2 === 0 ? 1 : -1;
          const sgnY = atTop ? 1 : atBottom ? -1 : yDirRaw;
          const duration = 7 + ((h >>> 12) % 6);
          const startDelay = ((h >>> 15) % 100) / 25;

          // Asymmetric path: when biased, stay on one side of origin
          const xMid = sgnX === xDirRaw ? -ampX * sgnX * 0.6 : 0;
          const yMid = sgnY === yDirRaw ? ampY * sgnY * 0.4 : 0;
          const driftX = [0, ampX * sgnX, ampX * sgnX * 0.3, xMid, 0];
          const driftY = [0, -ampY * sgnY * 0.6, -ampY * sgnY, yMid, 0];

          return (
            <motion.div
              ref={figureRef}
              data-agent-figure="true"
              data-col={col}
              data-row={row}
              data-ampx={Math.min(baseAmpX, HALF_GAP_X)}
              data-ampy={Math.min(baseAmpY, HALF_GAP_Y)}
              initial={{ x: entrance.x, y: entrance.y, opacity: 0 }}
              animate={
                !inView
                  ? { x: entrance.x, y: entrance.y, opacity: 0 }
                  : packetIncoming && arrived
                    ? { x: 0, y: [0, -4, 0], scale: [1, 1.08, 1], opacity: 1 }
                    : !arrived
                      ? { x: 0, y: 0, opacity: 1 }
                      : { x: driftX, y: driftY, opacity: 1 }
              }
              transition={
                packetIncoming && arrived
                  ? { duration: 0.5, ease: "easeOut" }
                  : !arrived
                    ? {
                        x: {
                          duration: entrance.walkDuration,
                          delay: entrance.walkDelay,
                          ease: [0.22, 0.9, 0.3, 1],
                        },
                        y: {
                          duration: entrance.walkDuration,
                          delay: entrance.walkDelay,
                          ease: [0.22, 0.9, 0.3, 1],
                        },
                        opacity: { duration: 0.4, delay: entrance.walkDelay },
                      }
                    : {
                        duration,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: startDelay,
                        times: [0, 0.25, 0.5, 0.75, 1],
                      }
              }
            >
              <AgentFigure agent={agent} hue={hue} active={active} pStyle={pStyle} />
            </motion.div>
          );
        })()}
        {active && (
          <motion.span
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: `hsl(${hue} 90% 60%)` }}
            animate={{ scale: [1, 2.2, 1], opacity: [0.9, 0, 0.9] }}
            transition={{ duration: 2, repeat: Infinity, delay }}
          />
        )}
      </div>
      <span
        className="mt-1 font-mono text-[8px] sm:text-[9px] font-semibold leading-tight px-1"
        style={{ color: active ? `hsl(${hue} 30% 92%)` : "hsl(220 12% 70%)" }}
      >
        {agent.name}
      </span>
      <span
        className="text-[7px] sm:text-[8px] leading-tight px-1 mt-0.5"
        style={{ color: active ? `hsl(${hue} 30% 75%)` : "hsl(220 10% 55%)" }}
      >
        {agent.role}
      </span>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  INTRA-PHASE PACKETS — curved SVG paths between agents in a column  */
/* ------------------------------------------------------------------ */

function IntraPhasePackets({ phase, active }: { phase: PhaseDef; active: boolean }) {
  // Build edges: agent[i] -> agent[i+1], paired in 3-col grid
  const n = phase.agents.length;
  const edges = useMemo(() => {
    const cols = 3;
    const positions = phase.agents.map((_, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      // Map to SVG viewBox 100x100, agent grid area inside column
      const x = 20 + col * 30; // 20, 50, 80
      const y = 22 + row * 38; // 22, 60
      return { x, y };
    });
    const result: Array<{
      from: { x: number; y: number };
      to: { x: number; y: number };
      idx: number;
    }> = [];
    for (let i = 0; i < n - 1; i++) {
      result.push({ from: positions[i], to: positions[i + 1], idx: i });
    }
    return result;
  }, [phase.agents, n]);

  if (!active) return null;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {edges.map((edge, i) => {
        const midX = (edge.from.x + edge.to.x) / 2;
        const midY = (edge.from.y + edge.to.y) / 2 - 6; // curve upward
        const pathId = `${phase.key}-edge-${i}`;
        const d = `M ${edge.from.x} ${edge.from.y} Q ${midX} ${midY} ${edge.to.x} ${edge.to.y}`;
        return (
          <g key={i}>
            <path
              id={pathId}
              d={d}
              fill="none"
              stroke={`hsl(${phase.hue} 80% 60%)`}
              strokeWidth="0.25"
              opacity="0.35"
              strokeDasharray="0.8 0.8"
              vectorEffect="non-scaling-stroke"
            />
            <circle r="0.9" fill={`hsl(${phase.hue} 95% 70%)`}>
              <animateMotion
                dur={`${2 + i * 0.3}s`}
                repeatCount="indefinite"
                begin={`${i * 0.7}s`}
                path={d}
              />
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                dur={`${2.6 + i * 0.4}s`}
                repeatCount="indefinite"
                begin={`${i * 0.9}s`}
              />
            </circle>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  CHAT BUBBLES — conversational snippets floating over the phase      */
/* ------------------------------------------------------------------ */

function ChatBubbles({ phase, active }: { phase: PhaseDef; active: boolean }) {
  if (!active || !phase.chatter?.length) return null;

  // Anchor bubbles near agent positions inside the column (percent of column box)
  const anchors = [
    { left: "18%", top: "22%" },
    { left: "62%", top: "30%" },
    { left: "30%", top: "60%" },
    { left: "68%", top: "68%" },
  ];

  return (
    <div className="absolute inset-0 pointer-events-none z-[3]">
      {phase.chatter.slice(0, 4).map((msg, i) => {
        const a = anchors[i % anchors.length];
        return (
          <motion.div
            key={`${phase.key}-chat-${i}`}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: a.left, top: a.top }}
            initial={{ opacity: 0, y: 6, scale: 0.85 }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: [6, 0, -2, -8],
              scale: [0.85, 1, 1, 0.9],
            }}
            transition={{
              duration: 3.4,
              delay: 0.6 + i * 1.4,
              repeat: Infinity,
              repeatDelay: phase.chatter.length * 1.4,
              ease: "easeInOut",
              times: [0, 0.18, 0.78, 1],
            }}
          >
            <div
              className="relative px-2 py-1 rounded-lg text-[9px] font-medium leading-tight max-w-[120px] whitespace-nowrap shadow-lg backdrop-blur-sm"
              style={{
                backgroundColor: `hsl(${phase.hue} 30% 18% / 0.95)`,
                color: `hsl(${phase.hue} 30% 92%)`,
                border: `1px solid hsl(${phase.hue} 70% 50% / 0.45)`,
              }}
            >
              <span style={{ color: `hsl(${phase.hue} 90% 75%)` }}>“</span>
              {msg}
              <span style={{ color: `hsl(${phase.hue} 90% 75%)` }}>”</span>
              {/* tail */}
              <span
                className="absolute -bottom-1 left-3 h-2 w-2 rotate-45"
                style={{
                  backgroundColor: `hsl(${phase.hue} 30% 18% / 0.95)`,
                  borderRight: `1px solid hsl(${phase.hue} 70% 50% / 0.45)`,
                  borderBottom: `1px solid hsl(${phase.hue} 70% 50% / 0.45)`,
                }}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PHASE COLUMN                                                        */
/* ------------------------------------------------------------------ */

function PhaseColumn({
  phase,
  active,
  visited,
  index,
  challengerEvent,
}: {
  phase: PhaseDef;
  active: boolean;
  visited: boolean;
  index: number;
  challengerEvent: "idle" | "intercept" | "revise";
}) {
  const dim = active ? 1 : visited ? 0.78 : 0.42;
  const lit = active || visited;

  return (
    <motion.div
      className="relative flex flex-col rounded-2xl border"
      style={{
        background: active
          ? `linear-gradient(180deg, hsl(${phase.hue} 60% 14% / 0.55) 0%, hsl(${phase.hue} 50% 8% / 0.35) 100%)`
          : visited
            ? `linear-gradient(180deg, hsl(${phase.hue} 45% 10% / 0.4) 0%, hsl(${phase.hue} 40% 6% / 0.25) 100%)`
            : `linear-gradient(180deg, hsl(220 30% 10% / 0.5) 0%, hsl(220 30% 6% / 0.3) 100%)`,
        borderColor: active
          ? `hsl(${phase.hue} 80% 55% / 0.55)`
          : visited
            ? `hsl(${phase.hue} 60% 40% / 0.4)`
            : "hsl(220 20% 22% / 0.6)",
        boxShadow: active
          ? `0 0 40px hsl(${phase.hue} 85% 50% / 0.18), inset 0 1px 0 hsl(${phase.hue} 90% 70% / 0.15)`
          : visited
            ? `0 0 18px hsl(${phase.hue} 80% 50% / 0.1)`
            : "none",
      }}
      animate={{ opacity: dim }}
      transition={{ duration: 1.2, ease: "easeInOut" }}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: dim, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 border-b flex items-center justify-between"
        style={{
          borderColor: active ? `hsl(${phase.hue} 70% 45% / 0.4)` : "hsl(220 20% 20% / 0.5)",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor: `hsl(${phase.hue} 90% 60%)`,
              boxShadow: active ? `0 0 8px hsl(${phase.hue} 90% 60%)` : "none",
            }}
          />
          <span
            className="font-mono text-[9px] uppercase tracking-[0.18em] font-semibold"
            style={{ color: lit ? `hsl(${phase.hue} 90% 80%)` : "hsl(220 15% 65%)" }}
          >
            {phase.label}
          </span>
          {visited && !active && (
            <span
              className="ml-1 inline-flex items-center justify-center h-3 w-3 rounded-full text-[7px] font-bold"
              style={{
                backgroundColor: `hsl(${phase.hue} 70% 30%)`,
                color: `hsl(${phase.hue} 90% 85%)`,
                border: `1px solid hsl(${phase.hue} 70% 50% / 0.6)`,
              }}
            >
              ✓
            </span>
          )}
        </div>
        <span className="font-mono text-[9px] text-muted-foreground/70">
          {String(index + 1).padStart(2, "0")} / 04
        </span>
      </div>

      {/* Agents grid + intra-phase packet overlay */}
      <div className="relative flex-1 p-3">
        <div className="grid grid-cols-3 gap-x-2 gap-y-3 content-start relative z-[2]">
          {phase.agents.map((agent, i) => {
            const pStyle = personStyleFor(agent);
            const cols = 3;
            const rows = Math.ceil(phase.agents.length / cols);
            const col = i % cols;
            const row = Math.floor(i / cols);
            // Light up the synthetic architect when the challenger sends back a revision
            const isSynthetic = agent.name === "Synthetic Architect";
            const packetIncoming =
              active && phase.key === "design" && isSynthetic && challengerEvent === "revise";
            return (
              <AgentCell
                key={agent.name}
                agent={agent}
                hue={phase.hue}
                active={active}
                delay={i * 0.06}
                pStyle={pStyle}
                packetIncoming={packetIncoming}
                col={col}
                row={row}
                cols={cols}
                rows={rows}
              />
            );
          })}
        </div>
        <IntraPhasePackets phase={phase} active={active} />
        <ChatBubbles phase={phase} active={active} />
      </div>

      {/* Sweep stripe */}
      {active && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-[2px]"
          style={{
            background: `linear-gradient(90deg, transparent, hsl(${phase.hue} 90% 60%), transparent)`,
          }}
          animate={{ x: ["-100%", "100%"] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
        />
      )}

      {/* Active artifact tokens */}
      {active && (
        <div className="px-3 pb-3 pt-1 flex flex-wrap gap-1.5 justify-center min-h-[26px]">
          <AnimatePresence mode="popLayout">
            {phase.key === "design" && challengerEvent === "intercept" && (
              <motion.div
                key="rejected"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
              >
                <ArtifactToken label="REVISION REQUESTED" hue={phase.hue} variant="rejected" />
              </motion.div>
            )}
            {phase.key === "design" && challengerEvent === "revise" && (
              <motion.div
                key="accepted"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
              >
                <ArtifactToken label="ADR-07 v2" hue={phase.hue} variant="accepted" />
              </motion.div>
            )}
            {challengerEvent === "idle" &&
              phase.agents.slice(0, 3).map((a, i) => (
                <motion.div
                  key={a.name}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: [0, 1, 1, 0], y: [6, 0, 0, -4] }}
                  transition={{
                    duration: 3,
                    delay: i * 0.7,
                    repeat: Infinity,
                    repeatDelay: 1.5,
                    ease: "easeInOut",
                  }}
                >
                  <ArtifactToken label={a.artifact} hue={phase.hue} />
                </motion.div>
              ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  INTER-PHASE HANDOFF — big artifact card flying between columns      */
/* ------------------------------------------------------------------ */

function InterPhaseHandoff({
  fromIdx,
  toIdx,
  trigger,
}: {
  fromIdx: number;
  toIdx: number;
  trigger: number; // changes to retrigger
}) {
  const fromPhase = PHASES[fromIdx];
  const toPhase = PHASES[toIdx];
  // 4 columns, evenly spaced: 12.5%, 37.5%, 62.5%, 87.5%
  const xs = [12.5, 37.5, 62.5, 87.5];
  const fromX = xs[fromIdx];
  const toX = xs[toIdx];

  return (
    <div className="absolute inset-0 pointer-events-none hidden lg:block">
      <AnimatePresence>
        <motion.div
          key={trigger}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
          initial={{ left: `${fromX}%`, opacity: 0, scale: 0.6 }}
          animate={{
            left: [`${fromX}%`, `${toX}%`],
            opacity: [0, 1, 1, 0],
            scale: [0.6, 1.05, 1, 0.85],
          }}
          transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1], times: [0, 0.2, 0.8, 1] }}
        >
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg border shadow-2xl backdrop-blur-sm"
            style={{
              background: `linear-gradient(135deg, hsl(${fromPhase.hue} 70% 22% / 0.95), hsl(${toPhase.hue} 70% 22% / 0.95))`,
              borderColor: `hsl(${toPhase.hue} 80% 60% / 0.7)`,
              boxShadow: `0 0 28px hsl(${toPhase.hue} 90% 55% / 0.55)`,
            }}
          >
            <span className="text-base">{fromPhase.handoff.icon}</span>
            <div className="flex flex-col leading-tight">
              <span
                className="font-mono text-[8px] uppercase tracking-wider"
                style={{ color: `hsl(${fromPhase.hue} 60% 80%)` }}
              >
                Handoff
              </span>
              <span className="font-display text-[11px] font-bold text-white">
                {fromPhase.handoff.label}
              </span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  BACKWARD FEEDBACK EDGES — faint dashed return paths                 */
/* ------------------------------------------------------------------ */

function BackwardFeedback({ pulseTrigger }: { pulseTrigger: number }) {
  // Risk Analyst (validation, idx=2) -> Driver Extractor (req, idx=0)
  // Validator (delivery, idx=3) -> Req. Analyst (req, idx=0)
  const xs = [12.5, 37.5, 62.5, 87.5];

  return (
    <div className="absolute inset-0 pointer-events-none hidden lg:block">
      <svg
        className="w-full h-full absolute inset-0"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {/* validation -> requirements */}
        <path
          d={`M ${xs[2]} 70 Q 50 92 ${xs[0]} 70`}
          fill="none"
          stroke="hsl(38 80% 60%)"
          strokeWidth="0.18"
          strokeDasharray="1 1.2"
          opacity="0.35"
          vectorEffect="non-scaling-stroke"
        />
        {/* delivery -> requirements */}
        <path
          d={`M ${xs[3]} 78 Q 50 99 ${xs[0]} 78`}
          fill="none"
          stroke="hsl(160 80% 55%)"
          strokeWidth="0.18"
          strokeDasharray="1 1.2"
          opacity="0.3"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Animated FEEDBACK token traveling backward */}
      <AnimatePresence>
        <motion.div
          key={pulseTrigger}
          className="absolute top-[78%] -translate-x-1/2 -translate-y-1/2"
          initial={{ left: `${xs[3]}%`, opacity: 0 }}
          animate={{ left: [`${xs[3]}%`, `${xs[0]}%`], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 2.4, ease: "easeInOut", times: [0, 0.15, 0.85, 1] }}
        >
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-full border font-mono text-[8px] font-bold tracking-wider"
            style={{
              backgroundColor: "hsl(160 70% 18% / 0.95)",
              color: "hsl(160 90% 75%)",
              borderColor: "hsl(160 80% 50% / 0.65)",
              boxShadow: "0 0 14px hsl(160 90% 55% / 0.55)",
            }}
          >
            ↩ FEEDBACK
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LEGEND                                                              */
/* ------------------------------------------------------------------ */

function ModeLegend() {
  const items = [
    { label: "AI", color: "hsl(262 80% 65%)" },
    { label: "Human", color: "hsl(217 90% 65%)" },
    { label: "Hybrid", color: "hsl(38 95% 60%)" },
  ];
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-6 text-[10px] font-mono text-muted-foreground">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: it.color }} />
          <span>{it.label}</span>
        </div>
      ))}
      <span className="text-muted-foreground/50">·</span>
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "hsl(0 75% 55%)" }} />
        <span>Challenger loop</span>
      </div>
      <span className="text-muted-foreground/50">·</span>
      <div className="flex items-center gap-1.5">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: "hsl(160 80% 55%)" }}
        />
        <span>Backward feedback</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN                                                                */
/* ------------------------------------------------------------------ */

export default function AgentsShowcase() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [visitedSet, setVisitedSet] = useState<Set<number>>(new Set([0]));
  const [handoff, setHandoff] = useState<{ from: number; to: number; trigger: number } | null>(
    null,
  );
  const [feedbackPulse, setFeedbackPulse] = useState(0);
  const [challengerEvent, setChallengerEvent] = useState<"idle" | "intercept" | "revise">("idle");
  const [cycleCount, setCycleCount] = useState(0);

  // Spotlight cycle — cumulative: each phase stays lit until the cycle resets
  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveIdx((i) => {
        const next = (i + 1) % PHASES.length;
        setHandoff({ from: i, to: next, trigger: Date.now() });
        setCycleCount((c) => c + 1);
        setVisitedSet((prev) => {
          // When we wrap back to 0, reset visited; otherwise add the new active phase
          if (next === 0) return new Set([0]);
          const nx = new Set(prev);
          nx.add(next);
          return nx;
        });
        return next;
      });
    }, 3000);
    return () => window.clearInterval(id);
  }, []);

  // Challenger loop — fires when we land on Design phase, every other time
  useEffect(() => {
    if (activeIdx !== 1) {
      setChallengerEvent("idle");
      return;
    }
    if (cycleCount % 2 !== 1) return; // every other Design visit

    const t1 = window.setTimeout(() => setChallengerEvent("intercept"), 800);
    const t2 = window.setTimeout(() => setChallengerEvent("revise"), 1500);
    const t3 = window.setTimeout(() => setChallengerEvent("idle"), 2400);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [activeIdx, cycleCount]);

  // Backward feedback pulse
  useEffect(() => {
    const id = window.setInterval(() => setFeedbackPulse((p) => p + 1), 16000);
    return () => window.clearInterval(id);
  }, []);

  const activeHue = PHASES[activeIdx].hue;

  return (
    <section className="py-20 sm:py-24 relative overflow-hidden">
      {/* Phase-tinted backdrop */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: `radial-gradient(ellipse at 50% 40%, hsl(${activeHue} 60% 12% / 0.55) 0%, hsl(220 30% 6% / 0) 60%)`,
        }}
        transition={{ duration: 1.2, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--background))_0%,hsl(var(--background))_60%)] opacity-40" />

      <div className="container relative">
        {/* Header */}
        <motion.div
          className="text-center mb-10 sm:mb-12"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-card/60 backdrop-blur-sm text-[10px] font-mono font-medium tracking-wider uppercase text-muted-foreground mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            The Working Studio
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-tight mb-3">
            Watch the Work <span className="text-gradient-brand">Move Through the Studio</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
            Agents hand artifacts to each other inside their phase, ship deliverables forward
            between phases, and route through a Challenger who can send work back for revision —
            governance you can see in motion.
          </p>
        </motion.div>

        {/* Studio: 4 phase columns + flow overlays */}
        <div className="relative">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 relative z-[1]">
            {PHASES.map((phase, i) => (
              <PhaseColumn
                key={phase.key}
                phase={phase}
                active={i === activeIdx}
                visited={visitedSet.has(i) && i !== activeIdx}
                index={i}
                challengerEvent={i === 1 ? challengerEvent : "idle"}
              />
            ))}
          </div>

          {/* Inter-phase handoff card */}
          {handoff && (
            <InterPhaseHandoff
              fromIdx={handoff.from}
              toIdx={handoff.to}
              trigger={handoff.trigger}
            />
          )}

          {/* Backward feedback edges */}
          <BackwardFeedback pulseTrigger={feedbackPulse} />
        </div>

        <ModeLegend />
      </div>
    </section>
  );
}
